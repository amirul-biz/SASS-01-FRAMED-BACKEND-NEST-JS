import { Injectable, Logger } from '@nestjs/common';
import {
  OrderDeliveryRepository,
  UndeliveredPaidOrder,
} from '../../../core/order-delivery/order-delivery.repository';
import { TransitionSource } from '../../../../../generated/prisma/enums';

const STUCK_ORDER_GRACE_MINUTES = 15;

export interface RedeliverStuckOrdersSummary {
  checked: number;
  delivered: number;
}

@Injectable()
export class ToyyibPayOrderDeliverySweepService {
  private readonly logger = new Logger(ToyyibPayOrderDeliverySweepService.name);

  constructor(
    private readonly orderDeliveryRepository: OrderDeliveryRepository,
  ) {}

  async redeliverStuckOrders(): Promise<RedeliverStuckOrdersSummary> {
    const olderThan = new Date(Date.now() - STUCK_ORDER_GRACE_MINUTES * 60_000);
    const stuckOrders =
      await this.orderDeliveryRepository.getUndeliveredPaidOrders(olderThan);

    let delivered = 0;
    for (const order of stuckOrders) {
      const wasDelivered = await this.redeliverSafely(order);
      if (wasDelivered) {
        delivered++;
      }
    }

    this.logger.log(
      `Redelivered ${stuckOrders.length} stuck ToyyibPay order(s): ${delivered} delivered.`,
    );
    return { checked: stuckOrders.length, delivered };
  }

  private async redeliverSafely(order: UndeliveredPaidOrder): Promise<boolean> {
    try {
      return await this.orderDeliveryRepository.deliverOrder({
        orderId: order.orderId,
        paymentId: order.paymentId,
        email: order.email,
        amount: order.amount,
        source: TransitionSource.SYSTEM,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to redeliver stuck order ${order.orderId}: ${(error as Error).message}`,
      );
      return false;
    }
  }
}
