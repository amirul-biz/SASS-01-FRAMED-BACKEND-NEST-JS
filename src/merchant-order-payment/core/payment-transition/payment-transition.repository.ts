import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/database/prisma.service';
import type { Prisma } from '../../../../generated/prisma/client';
import type { CommissionCalculation } from '../../../commission/commission-config/commission.interface';
import {
  OrderStatus,
  PaymentBillStatus,
  TransitionSource,
} from '../../../../generated/prisma/enums';

// Shared across every provider's own mark-as-paid/webhook flow (cash, ToyyibPay, ...): what's
// needed to compute commission and write the transition — the option's isImposeCommission, the
// order's current status, the customer's email (for providers that email delivery, e.g.
// ToyyibPay), and the undiscounted per-item prices.
const PAYMENT_FOR_MARKING_INCLUDE = {
  merchantPaymentPlatformOption: {
    select: { userPlatformId: true, isImposeCommission: true },
  },
  order: {
    select: { status: true, email: true, items: { select: { price: true } } },
  },
} as const;

export type PaymentForMarkingPayload = Prisma.MerchantPaymentGetPayload<{
  include: typeof PAYMENT_FOR_MARKING_INCLUDE;
}>;

export interface RecordSuccessfulPaymentParams {
  paymentId: string;
  orderId: string;
  fromPaymentStatus: PaymentBillStatus;
  fromOrderStatus: OrderStatus;
  source: TransitionSource;
  commission: CommissionCalculation | null;
  // Cash goes straight to DELIVERED (the photographer hands off photos over WhatsApp — nothing
  // else has to happen). ToyyibPay stops at PROCESSING instead, since delivery there means an
  // email being sent first — see OrderDeliveryRepository.deliverOrder.
  targetOrderStatus: OrderStatus;
}

export interface RecordFailedPaymentParams {
  paymentId: string;
  orderId: string;
  fromPaymentStatus: PaymentBillStatus;
  fromOrderStatus: OrderStatus;
  source: TransitionSource;
}

export interface RecordProcessingPaymentParams {
  paymentId: string;
  orderId: string;
  fromPaymentStatus: PaymentBillStatus;
  fromOrderStatus: OrderStatus;
  source: TransitionSource;
}

@Injectable()
export class PaymentTransitionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getPaymentForMarkingById(
    id: string,
  ): Promise<PaymentForMarkingPayload | null> {
    return await this.prisma.merchantPayment.findUnique({
      where: { id },
      include: PAYMENT_FOR_MARKING_INCLUDE,
    });
  }

  // Provider-agnostic side effects of a payment succeeding — every provider (cash today,
  // ToyyibPay later) records commission and audits the transition the same way; only how the
  // provider's own bill row gets written, and what order status it lands on, differs per provider
  // (see RecordSuccessfulPaymentParams.targetOrderStatus).
  async recordSuccessfulPayment(
    tx: Prisma.TransactionClient,
    params: RecordSuccessfulPaymentParams,
  ): Promise<void> {
    if (params.commission) {
      await this.createCommissionCharge(
        tx,
        params.paymentId,
        params.commission,
      );
    }
    await tx.order.update({
      where: { id: params.orderId },
      data: { status: params.targetOrderStatus },
    });
    await tx.merchantTransactionAuditLog.create({
      data: {
        paymentId: params.paymentId,
        orderId: params.orderId,
        fromStatus: params.fromPaymentStatus,
        toStatus: PaymentBillStatus.PAID,
        fromOrderStatus: params.fromOrderStatus,
        toOrderStatus: params.targetOrderStatus,
        source: params.source,
      },
    });
  }

  // A payment that ToyyibPay reports as failed — the order is cancelled, not left dangling; the
  // customer would need to check out again (a new order + new bill) to retry.
  async recordFailedPayment(
    tx: Prisma.TransactionClient,
    params: RecordFailedPaymentParams,
  ): Promise<void> {
    await tx.order.update({
      where: { id: params.orderId },
      data: { status: OrderStatus.CANCELLED },
    });
    await tx.merchantTransactionAuditLog.create({
      data: {
        paymentId: params.paymentId,
        orderId: params.orderId,
        fromStatus: params.fromPaymentStatus,
        toStatus: PaymentBillStatus.FAILED,
        fromOrderStatus: params.fromOrderStatus,
        toOrderStatus: OrderStatus.CANCELLED,
        source: params.source,
      },
    });
  }

  // An in-between callback (ToyyibPay's "pending") — the order isn't touched, just audited, so
  // the history timeline shows the payment was seen moving through processing.
  async recordProcessingPayment(
    tx: Prisma.TransactionClient,
    params: RecordProcessingPaymentParams,
  ): Promise<void> {
    await tx.merchantTransactionAuditLog.create({
      data: {
        paymentId: params.paymentId,
        orderId: params.orderId,
        fromStatus: params.fromPaymentStatus,
        toStatus: PaymentBillStatus.PROCESSING,
        fromOrderStatus: params.fromOrderStatus,
        toOrderStatus: params.fromOrderStatus,
        source: params.source,
      },
    });
  }

  private async createCommissionCharge(
    tx: Prisma.TransactionClient,
    paymentId: string,
    commission: CommissionCalculation,
  ): Promise<void> {
    await tx.commissionCharge.create({
      data: {
        payment: { connect: { id: paymentId } },
        commissionPlan: { connect: { id: commission.commissionPlanId } },
        commissionType: commission.commissionType,
        originalPaymentAmount: commission.originalPaymentAmount,
        commissionBaseAmount: commission.commissionBaseAmount,
        commissionAmount: commission.commissionAmount,
        ...commission.chargeDetail,
      },
    });
  }
}
