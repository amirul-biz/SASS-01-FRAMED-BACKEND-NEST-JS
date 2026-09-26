import { Injectable, Logger } from '@nestjs/common';
import { CommissionService } from '../../../../commission/commission-config/commission.service';
import type { CommissionCalculation } from '../../../../commission/commission-config/commission.interface';
import { TransitionSource } from '../../../../../generated/prisma/enums';
import { OrderDeliveryRepository } from '../../../core/order-delivery/order-delivery.repository';
import { PaymentForMarkingPayload } from '../../../core/payment-transition/payment-transition.repository';
import { ToyyibPayPrePaymentRepository } from '../../pre-payment/toyyibpay-pre-payment.repository';
import { ToyyibPayWebhookRepository } from '../webhook/toyyibpay-webhook.repository';

// Shared by every caller that can learn a ToyyibPay payment's outcome: the real-time webhook,
// the cron reconciliation sweep, and the photographer's manual resync button. Each caller passes
// its own TransitionSource so the audit log records who actually observed the outcome.
@Injectable()
export class ToyyibPayPaymentFinalizationService {
  private readonly logger = new Logger(
    ToyyibPayPaymentFinalizationService.name,
  );

  constructor(
    private readonly commissionService: CommissionService,
    private readonly toyyibPayPrePaymentRepository: ToyyibPayPrePaymentRepository,
    private readonly toyyibPayWebhookRepository: ToyyibPayWebhookRepository,
    private readonly orderDeliveryRepository: OrderDeliveryRepository,
  ) {}

  async finalizeAsPaid(
    payment: PaymentForMarkingPayload,
    source: TransitionSource,
  ): Promise<boolean> {
    const lockedCommission =
      await this.toyyibPayPrePaymentRepository.getSplitCommissionByPaymentId(
        payment.id,
      );
    const commission =
      lockedCommission ?? (await this.getFreshCommission(payment));

    const commissionSourceLabel = lockedCommission
      ? 'locked split'
      : 'computed fresh';
    this.logger.log(
      `Finalizing payment ${payment.id} as PAID (source=${source}, commission=${commissionSourceLabel})`,
    );

    const wasApplied = await this.toyyibPayWebhookRepository.markPaymentAsPaid(
      payment,
      commission,
      source,
    );
    if (!wasApplied) {
      this.logger.log(
        `Payment ${payment.id} was already handled — finalizeAsPaid no-op`,
      );
      return false;
    }

    await this.orderDeliveryRepository.deliverOrder(
      payment.orderId,
      payment.order.email,
    );
    return true;
  }

  // Only reached when there's no locked split commission for this payment — ToyyibPay
  // split-enabled bills already deducted a fixed-cents commission at bill-creation time (it can't
  // change afterward), so that stored figure is the source of truth instead, checked in
  // finalizeAsPaid before this is ever called.
  private async getFreshCommission(
    payment: PaymentForMarkingPayload,
  ): Promise<CommissionCalculation | null> {
    return await this.commissionService.getCommissionForPayment({
      paymentPlatformOptionId: payment.merchantPaymentPlatformOptionId,
      isImposeCommission:
        payment.merchantPaymentPlatformOption.isImposeCommission,
      order: {
        amountPaid: Number(payment.amount),
        itemPrices: payment.order.items.map((item) => Number(item.price)),
      },
    });
  }

  async finalizeAsFailed(
    payment: PaymentForMarkingPayload,
    source: TransitionSource,
  ): Promise<boolean> {
    this.logger.log(
      `Finalizing payment ${payment.id} as FAILED (source=${source})`,
    );
    const wasApplied =
      await this.toyyibPayWebhookRepository.markPaymentAsFailed(
        payment,
        source,
      );
    if (!wasApplied) {
      this.logger.log(
        `Payment ${payment.id} was already handled — finalizeAsFailed no-op`,
      );
    }
    return wasApplied;
  }

  async finalizeAsProcessing(
    payment: PaymentForMarkingPayload,
    source: TransitionSource,
  ): Promise<boolean> {
    this.logger.log(
      `Finalizing payment ${payment.id} as PROCESSING (source=${source})`,
    );
    const wasApplied =
      await this.toyyibPayWebhookRepository.markPaymentAsProcessing(
        payment,
        source,
      );
    if (!wasApplied) {
      this.logger.log(
        `Payment ${payment.id} was already handled — finalizeAsProcessing no-op`,
      );
    }
    return wasApplied;
  }
}
