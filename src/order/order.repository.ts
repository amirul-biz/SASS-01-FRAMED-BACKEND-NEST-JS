import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import type { OrderStatus } from '../../generated/prisma/enums';
import type { CreateOrderDto } from './order.dto';

const PHOTOGRAPHER_ORDER_INCLUDE = {
  items: { include: { photo: { select: { originalName: true } } } },
  event: { select: { id: true, title: true } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countUploadedPhotosForEvent(eventId: string, photoIds: string[]): Promise<number> {
    return await this.prisma.photo.count({
      where: {
        id: { in: photoIds },
        eventId,
        status: 'UPLOADED',
        deletedAt: null,
      },
    });
  }

  async voucherExists(voucherId: string): Promise<boolean> {
    const count = await this.prisma.voucher.count({ where: { id: voucherId } });
    return count > 0;
  }

  async getManyByPhotographer(
    photographerId: string,
    {
      skip,
      take,
      eventId,
      status,
    }: { skip: number; take: number; eventId?: string; status?: OrderStatus },
  ) {
    const where = {
      event: { photographerId, deletedAt: null },
      ...(eventId && { eventId }),
      ...(status && { status }),
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

    return { items, totalItemCount, totalRevenue: Number(totals._sum.total ?? 0) };
  }

  async create(dto: CreateOrderDto) {
    return await this.prisma.order.create({
      data: {
        eventId: dto.eventId,
        email: dto.email,
        countryCode: dto.countryCode,
        phone: dto.phone,
        subtotal: dto.subtotal,
        discountAmount: dto.discountAmount,
        total: dto.total,
        priceBreakdown: {
          subtotal: dto.subtotal,
          discountAmount: dto.discountAmount,
          total: dto.total,
        },
        voucherId: dto.voucherId ?? null,
        voucherName: dto.voucherName,
        items: {
          create: dto.items.map((item) => ({
            photoId: item.photoId,
            formatLabel: item.formatLabel,
            price: item.price,
          })),
        },
      },
      include: { items: { include: { photo: { select: { originalName: true } } } } },
    });
  }
}
