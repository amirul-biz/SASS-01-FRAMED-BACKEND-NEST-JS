import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type { OrderStatus } from '../../generated/prisma/enums';
import { COMMISSION_CHARGE_INCLUDE } from '../commission/commission-config/commission-charge.include';
import { OrderPaymentTracking } from './order.constants';
import type { CreateOrderRecord } from './order.interface';

const ORDER_INCLUDE = {
  items: { include: { photo: { select: { originalName: true, key: true } } } },
  payments: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    include: { commissionCharge: { include: COMMISSION_CHARGE_INCLUDE } },
  },
} satisfies Prisma.OrderInclude;

const PHOTOGRAPHER_ORDER_INCLUDE = {
  ...ORDER_INCLUDE,
  event: { select: { id: true, title: true } },
} satisfies Prisma.OrderInclude;

export type OrderPayload = Prisma.OrderGetPayload<{
  include: typeof ORDER_INCLUDE;
}>;

export interface CreateOrderResult {
  order: OrderPayload;
  isNew: boolean;
}

export type PhotographerOrderPayload = Prisma.OrderGetPayload<{
  include: typeof PHOTOGRAPHER_ORDER_INCLUDE;
}>;

const ORDER_OWNERSHIP_SELECT = {
  id: true,
  createdAt: true,
  event: { select: { photographerId: true } },
} satisfies Prisma.OrderSelect;

export type OrderOwnershipPayload = Prisma.OrderGetPayload<{
  select: typeof ORDER_OWNERSHIP_SELECT;
}>;

export interface PhotographerOrderPage {
  items: PhotographerOrderPayload[];
  totalItemCount: number;
  totalRevenue: number;
}

export function getPaymentTrackingWhere(
  paymentTracking?: OrderPaymentTracking,
): Prisma.OrderWhereInput {
  const isTracked = paymentTracking === OrderPaymentTracking.TRACKED;
  const isLegacy = paymentTracking === OrderPaymentTracking.LEGACY;

  if (isTracked) {
    return { payments: { some: {} } };
  }
  if (isLegacy) {
    return { payments: { none: {} } };
  }
  return {};
}

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOrderOwnershipById(
    id: string,
  ): Promise<OrderOwnershipPayload | null> {
    return await this.prisma.order.findUnique({
      where: { id },
      select: ORDER_OWNERSHIP_SELECT,
    });
  }

  async countUploadedPhotosForEvent(
    eventId: string,
    photoIds: string[],
  ): Promise<number> {
    return await this.prisma.photo.count({
      where: {
        id: { in: photoIds },
        eventId,
        status: 'UPLOADED',
        deletedAt: null,
      },
    });
  }

  async listOrdersByPhotographer(
    photographerId: string,
    {
      skip,
      take,
      eventId,
      status,
      paymentTracking,
    }: {
      skip: number;
      take: number;
      eventId?: string;
      status?: OrderStatus;
      paymentTracking?: OrderPaymentTracking;
    },
  ): Promise<PhotographerOrderPage> {
    const where = {
      event: { photographerId, deletedAt: null },
      ...(eventId && { eventId }),
      ...(status && { status }),
      ...getPaymentTrackingWhere(paymentTracking),
    } satisfies Prisma.OrderWhereInput;

    const [items, totalItemCount, totals] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: PHOTOGRAPHER_ORDER_INCLUDE,
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.aggregate({ where, _sum: { total: true } }),
    ]);

    return {
      items,
      totalItemCount,
      totalRevenue: Number(totals._sum.total ?? 0),
    };
  }

  // Creates the order, or — if `idempotencyKey` was already used (a retried checkout request) —
  // returns the order that first used it instead of failing. Relies on the DB's unique constraint
  // to be correct under two truly concurrent requests, not on a check-then-insert query (which
  // would still race).
  async createOrder(record: CreateOrderRecord): Promise<CreateOrderResult> {
    const { pricing } = record;

    try {
      const order = await this.prisma.order.create({
        data: {
          eventId: record.eventId,
          email: record.email,
          countryCode: record.countryCode,
          phone: record.phone,
          idempotencyKey: record.idempotencyKey,
          subtotal: pricing.subtotal,
          discountAmount: pricing.discountAmount,
          total: pricing.total,
          priceBreakdown: {
            subtotal: pricing.subtotal,
            discountAmount: pricing.discountAmount,
            total: pricing.total,
          },
          voucherId: pricing.voucherId,
          voucherName: pricing.voucherName,
          items: {
            create: pricing.items.map((item) => ({
              photoId: item.photoId,
              formatLabel: item.formatLabel,
              price: item.price,
            })),
          },
          payments: { create: record.payment },
        },
        include: ORDER_INCLUDE,
      });
      return { order, isNew: true };
    } catch (error) {
      const isDuplicateIdempotencyKey = this.isUniqueConstraintViolationOn(
        error,
        'idempotency_key',
      );
      if (!isDuplicateIdempotencyKey) {
        throw error;
      }
      const existingOrder = await this.prisma.order.findUniqueOrThrow({
        where: { idempotencyKey: record.idempotencyKey },
        include: ORDER_INCLUDE,
      });
      return { order: existingOrder, isNew: false };
    }
  }

  // The driver adapter (@prisma/adapter-pg) does not use the classic `error.meta.target` array —
  // the real Postgres constraint name comes back nested at
  // `error.meta.driverAdapterError.cause.constraint.index` (confirmed against a real P2002 from
  // this exact setup). That shape isn't part of Prisma's stable public API, so this also falls
  // back to a substring search over the whole meta object, to stay correct across Prisma/adapter
  // versions rather than silently stop matching and re-throw a 500 on every retry.
  private isUniqueConstraintViolationOn(
    error: unknown,
    columnName: string,
  ): boolean {
    const isKnownRequestError =
      error instanceof Prisma.PrismaClientKnownRequestError;
    if (!isKnownRequestError || error.code !== 'P2002') {
      return false;
    }
    return JSON.stringify(error.meta ?? {}).includes(columnName);
  }
}
