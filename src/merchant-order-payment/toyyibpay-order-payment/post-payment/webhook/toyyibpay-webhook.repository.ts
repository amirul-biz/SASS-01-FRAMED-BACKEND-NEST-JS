import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/database/prisma.service';
import type { CommissionCalculation } from '../../../../commission/commission-config/commission.interface';
import {
  PaymentForMarkingPayload,
  PaymentTransitionRepository,
} from '../../../core/payment-transition/payment-transition.repository';
import {
  OrderStatus,
  PaymentBillStatus,
  TransitionSource,
} from '../../../../../generated/prisma/enums';

// Cash only ever transitions PENDING -> PAID, so its guard only matches PENDING. ToyyibPay can
// pass through PROCESSING first (a "pending" callback), so the success/fail guards below have to
// match either open state — otherwise a real success callback arriving after an earlier pending
// one would find the payment already moved off PENDING and wrongly treat it as already handled,
// silently never delivering the order or recording commission.
const OPEN_PAYMENT_STATUSES: PaymentBillStatus[] = [
  PaymentBillStatus.PENDING,
  PaymentBillStatus.PROCESSING,
];

@Injectable()
export class ToyyibPayWebhookRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentTransitionRepository: PaymentTransitionRepository,
  ) {}

  async markPaymentAsPaid(
    payment: PaymentForMarkingPayload,
    commission: CommissionCalculation | null,
    source: TransitionSource,
  ): Promise<boolean> {
    return await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.merchantPayment.updateMany({
        where: { id: payment.id, status: { in: OPEN_PAYMENT_STATUSES } },
        data: { status: PaymentBillStatus.PAID },
      });
      const isAlreadyHandled = count === 0;
      if (isAlreadyHandled) {
        return false;
      }

      await this.paymentTransitionRepository.recordSuccessfulPayment(tx, {
        paymentId: payment.id,
        orderId: payment.orderId,
        fromPaymentStatus: payment.status,
        fromOrderStatus: payment.order.status,
        source,
        commission,
        // ToyyibPay delivers via email, not immediately — stops at PROCESSING until
        // ToyyibPayPaymentFinalizationService.finalizeAsPaid calls deliverOrder afterward.
        targetOrderStatus: OrderStatus.PROCESSING,
      });
      return true;
    });
  }

  async markPaymentAsFailed(
    payment: PaymentForMarkingPayload,
    source: TransitionSource,
  ): Promise<boolean> {
    return await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.merchantPayment.updateMany({
        where: { id: payment.id, status: { in: OPEN_PAYMENT_STATUSES } },
        data: { status: PaymentBillStatus.FAILED },
      });
      const isAlreadyHandled = count === 0;
      if (isAlreadyHandled) {
        return false;
      }

      await this.paymentTransitionRepository.recordFailedPayment(tx, {
        paymentId: payment.id,
        orderId: payment.orderId,
        fromPaymentStatus: payment.status,
        fromOrderStatus: payment.order.status,
        source,
      });
      return true;
    });
  }

  async markPaymentAsProcessing(
    payment: PaymentForMarkingPayload,
    source: TransitionSource,
  ): Promise<boolean> {
    return await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.merchantPayment.updateMany({
        where: { id: payment.id, status: PaymentBillStatus.PENDING },
        data: { status: PaymentBillStatus.PROCESSING },
      });
      const isAlreadyHandled = count === 0;
      if (isAlreadyHandled) {
        return false;
      }

      await this.paymentTransitionRepository.recordProcessingPayment(tx, {
        paymentId: payment.id,
        orderId: payment.orderId,
        fromPaymentStatus: payment.status,
        fromOrderStatus: payment.order.status,
        source,
      });
      return true;
    });
  }
}
