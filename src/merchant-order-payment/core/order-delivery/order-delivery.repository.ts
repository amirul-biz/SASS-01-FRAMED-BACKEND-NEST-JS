import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/database/prisma.service';
import { EmailService } from '../../../email/email.service';
import {
  OrderStatus,
  PaymentBillStatus,
  PaymentProvider,
} from '../../../../generated/prisma/enums';

export interface UndeliveredPaidOrder {
  orderId: string;
  email: string;
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
  // only one that emails.
  async deliverOrder(orderId: string, email: string): Promise<boolean> {
    const { count } = await this.prisma.order.updateMany({
      where: { id: orderId, status: OrderStatus.PROCESSING },
      data: { status: OrderStatus.DELIVERED },
    });
    const wasAlreadyDelivered = count === 0;
    if (wasAlreadyDelivered) {
      return false;
    }

    await this.emailService.sendPhotosDeliveredEmail({ orderId, email });
    return true;
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
      select: { id: true, email: true },
    });
    return orders.map((order) => ({ orderId: order.id, email: order.email }));
  }
}
