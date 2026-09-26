import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/database/prisma.service';
import type { CommissionCalculation } from '../../commission/commission-config/commission.interface';
import {
  PaymentForMarkingPayload,
  PaymentTransitionRepository,
} from '../core/payment-transition/payment-transition.repository';
import type { MerchantPayment, Prisma } from '../../../generated/prisma/client';
import {
  OrderStatus,
  PaymentBillStatus,
  PaymentProvider,
  TransitionSource,
} from '../../../generated/prisma/enums';

export type { PaymentForMarkingPayload };

export interface MarkedAsPaidResult {
  payment: MerchantPayment;
  orderStatus: OrderStatus;
}

export interface MarkAsPaidParams {
  payment: PaymentForMarkingPayload;
  recordedByUserPlatformId: string;
  commission: CommissionCalculation | null;
  notes?: string;
}

@Injectable()
export class CashOrderPaymentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentTransitionRepository: PaymentTransitionRepository,
  ) {}

  async markPaymentAsPaid(
    params: MarkAsPaidParams,
  ): Promise<MarkedAsPaidResult | null> {
    const { payment } = params;

    return await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.merchantPayment.updateMany({
        where: { id: payment.id, status: PaymentBillStatus.PENDING },
        data: { status: PaymentBillStatus.PAID },
      });
      const isAlreadyHandled = count === 0;
      if (isAlreadyHandled) {
        return null;
      }

      await this.createCashBill(tx, params);
      await this.paymentTransitionRepository.recordSuccessfulPayment(tx, {
        paymentId: payment.id,
        orderId: payment.orderId,
        fromPaymentStatus: PaymentBillStatus.PENDING,
        fromOrderStatus: payment.order.status,
        source: TransitionSource.MANUAL,
        commission: params.commission,
        // Cash is handed off by the photographer over WhatsApp — nothing else has to happen.
        targetOrderStatus: OrderStatus.DELIVERED,
      });

      const paidPayment = await tx.merchantPayment.findUniqueOrThrow({
        where: { id: payment.id },
      });
      return { payment: paidPayment, orderStatus: OrderStatus.DELIVERED };
    });
  }

  private async createCashBill(
    tx: Prisma.TransactionClient,
    params: MarkAsPaidParams,
  ): Promise<void> {
    const { payment, recordedByUserPlatformId, notes } = params;

    await tx.merchantPaymentPlatformBill.create({
      data: {
        paymentId: payment.id,
        provider: PaymentProvider.CASH,
        paymentPlatformOptionId: payment.merchantPaymentPlatformOptionId,
        cashDetail: { create: { recordedByUserPlatformId, notes } },
      },
    });
  }
}
