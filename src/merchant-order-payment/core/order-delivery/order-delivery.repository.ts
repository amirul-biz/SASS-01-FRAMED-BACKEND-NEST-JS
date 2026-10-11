import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/database/prisma.service';
import { EmailService } from '../../../email/email.service';
import {
  OrderStatus,
  PaymentBillStatus,
  PaymentProvider,
  TransitionSource,
} from '../../../../generated/prisma/enums';

export interface UndeliveredPaidOrder {
  orderId: string;
  paymentId: string;
  email: string;
  amount: number;
}

export interface DeliverOrderParams {
  orderId: string;
  paymentId: string;
  email: string;
  amount: number;
  source: TransitionSource;
}

@Injectable()
export class OrderDeliveryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // The second half of ToyyibPay's delivery flow — cash never calls this, it goes straight to
  // DELIVERED in PaymentTransitionRepository.recordSuccessfulPayment. Guarded (updateMany + count
  // check) before the email call, not after, so a race between this and the reconciliation sweep
  // can only ever send one email: whichever caller actually flips PROCESSING -> DELIVERED is the
  // only one that emails. The order-status flip and its audit log row are written in one
  // transaction so the history timeline can never show a delivery that didn't actually happen (or
  // vice versa) — the email call stays outside the transaction since it's a network call, not a
  // DB write.
  async deliverOrder(params: DeliverOrderParams): Promise<boolean> {
    const wasDelivered = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: params.orderId, status: OrderStatus.PROCESSING },
        data: { status: OrderStatus.DELIVERED },
      });
      const wasAlreadyDelivered = count === 0;
      if (wasAlreadyDelivered) {
        return false;
      }

      await tx.merchantTransactionAuditLog.create({
        data: {
          paymentId: params.paymentId,
          orderId: params.orderId,
          // The payment itself doesn't change here — still PAID before and after. This row
          // exists to record the order-status transition, not a payment-status one.
          fromStatus: PaymentBillStatus.PAID,
          toStatus: PaymentBillStatus.PAID,
          fromOrderStatus: OrderStatus.PROCESSING,
          toOrderStatus: OrderStatus.DELIVERED,
          source: params.source,
        },
      });
      return true;
    });

    if (!wasDelivered) {
      return false;
    }

    await this.emailService.sendPhotosDeliveredEmail({
      orderId: params.orderId,
      email: params.email,
      amount: params.amount,
    });
    return true;
  }

  // Deliberately bypasses deliverOrder's "only once" guard — this exists for the customer's own
  // "didn't receive it?" retry on the return-URL page, where a duplicate email is an acceptable,
  // explicitly-requested outcome, not an accident. Never call this from an automatic path (webhook,
  // sweep) — only from a direct customer action.
  async resendDeliveryEmail(
    orderId: string,
    email: string,
    amount: number,
  ): Promise<void> {
    await this.emailService.sendPhotosDeliveredEmail({
      orderId,
      email,
      amount,
    });
  }

  // Orders where a ToyyibPay payment was marked PAID but the order never made it past
  // PROCESSING to DELIVERED — the reconciliation gap opened up by splitting delivery into two
  // steps. Cash never appears here since it never sets PROCESSING in the first place; the
  // provider filter is defensive, not load-bearing.
  async getUndeliveredPaidOrders(
    olderThan: Date,
  ): Promise<UndeliveredPaidOrder[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PROCESSING,
        payments: {
          some: {
            provider: PaymentProvider.TOYYIBPAY,
            status: PaymentBillStatus.PAID,
            updatedAt: { lt: olderThan },
          },
        },
      },
      select: {
        id: true,
        email: true,
        payments: {
          where: {
            provider: PaymentProvider.TOYYIBPAY,
            status: PaymentBillStatus.PAID,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, amount: true },
        },
      },
    });
    return orders.map((order) => ({
      orderId: order.id,
      paymentId: order.payments[0]?.id ?? '',
      email: order.email,
      amount: Number(order.payments[0]?.amount ?? 0),
    }));
  }
}
