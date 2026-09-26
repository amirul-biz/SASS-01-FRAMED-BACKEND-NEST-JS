import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MerchantPaymentPlatformService } from '../../../../merchant-payment-platform/merchant-payment-platform.service';
import { ToyyibPayApiClient } from '../../../../merchant-payment-platform/toyyibpay-payment-platform/toyyibpay-payment-config/toyyibpay-api.client';
import { ToyyibPayPaymentConfigService } from '../../../../merchant-payment-platform/toyyibpay-payment-platform/toyyibpay-payment-config/toyyibpay-payment-config.service';
import {
  PaymentBillStatus,
  PaymentProvider,
  TransitionSource,
} from '../../../../../generated/prisma/enums';
import type { AuthenticatedUser } from '../../../../types/express';
import { PaymentTransitionRepository } from '../../../core/payment-transition/payment-transition.repository';
import { ToyyibPayPrePaymentRepository } from '../../pre-payment/toyyibpay-pre-payment.repository';
import { ToyyibPayPaymentFinalizationService } from '../finalization/toyyibpay-payment-finalization.service';
import { ToyyibPayPaymentSyncRepository } from './toyyibpay-payment-sync.repository';

const STALE_PAYMENT_GRACE_MINUTES = 15;

export interface SyncPaymentResult {
  synced: boolean;
}

export interface ConfirmToyyibPayReturnResult {
  paymentStatus: PaymentBillStatus;
}

export interface SyncAllStalePaymentsSummary {
  checked: number;
  finalized: number;
}

@Injectable()
export class ToyyibPayPaymentSyncService {
  private readonly logger = new Logger(ToyyibPayPaymentSyncService.name);

  constructor(
    private readonly paymentTransitionRepository: PaymentTransitionRepository,
    private readonly merchantPaymentPlatformService: MerchantPaymentPlatformService,
    private readonly toyyibPayPrePaymentRepository: ToyyibPayPrePaymentRepository,
    private readonly toyyibPayPaymentConfigService: ToyyibPayPaymentConfigService,
    private readonly toyyibPayApiClient: ToyyibPayApiClient,
    private readonly toyyibPayPaymentFinalizationService: ToyyibPayPaymentFinalizationService,
    private readonly toyyibPayPaymentSyncRepository: ToyyibPayPaymentSyncRepository,
  ) {}

  async resyncAsPhotographer(
    user: AuthenticatedUser,
    paymentId: string,
  ): Promise<SyncPaymentResult> {
    const payment =
      await this.paymentTransitionRepository.getPaymentForMarkingById(
        paymentId,
      );
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    this.merchantPaymentPlatformService.getAuthorizedUserPlatformId(
      user,
      payment.merchantPaymentPlatformOption.userPlatformId,
    );

    return await this.syncPayment(paymentId, TransitionSource.MANUAL);
  }

  // Called from the customer-facing return-URL landing page — no login exists for a customer, so
  // the billCode ToyyibPay redirected them with stands in for authorization: only whoever ToyyibPay
  // actually redirected (the real payer) knows it. Worst case on a wrong guess is a NotFoundException;
  // worst case on a correct-but-replayed call is a harmless no-op, since syncPayment's underlying
  // transitions are already idempotent.
  //
  // Returns the payment's actual current status rather than syncPayment's own { synced } result —
  // the page rendering off this needs to know what the payment really is (e.g. already PAID via a
  // webhook that beat the customer to it), not just whether this particular call changed anything.
  async confirmReturnAsCustomer(
    paymentId: string,
    billCode: string,
  ): Promise<ConfirmToyyibPayReturnResult> {
    const storedBillCode =
      await this.toyyibPayPrePaymentRepository.getBillCodeByPaymentId(
        paymentId,
      );
    const isBillCodeMatching =
      storedBillCode !== null && storedBillCode === billCode;
    if (!isBillCodeMatching) {
      throw new NotFoundException('Payment not found');
    }

    await this.syncPayment(paymentId, TransitionSource.CUSTOMER);

    const payment =
      await this.paymentTransitionRepository.getPaymentForMarkingById(
        paymentId,
      );
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return { paymentStatus: payment.status };
  }

  async syncPayment(
    paymentId: string,
    source: TransitionSource,
  ): Promise<SyncPaymentResult> {
    this.logger.log(`Syncing payment ${paymentId} (source=${source})`);

    const payment =
      await this.paymentTransitionRepository.getPaymentForMarkingById(
        paymentId,
      );
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const isToyyibPayPayment = payment.provider === PaymentProvider.TOYYIBPAY;
    if (!isToyyibPayPayment) {
      throw new BadRequestException('This payment is not a ToyyibPay payment');
    }

    const isStillOpen =
      payment.status === PaymentBillStatus.PENDING ||
      payment.status === PaymentBillStatus.PROCESSING;
    if (!isStillOpen) {
      this.logger.log(
        `Payment ${paymentId} is already ${payment.status} — sync no-op`,
      );
      return { synced: false };
    }

    const billCode =
      await this.toyyibPayPrePaymentRepository.getBillCodeByPaymentId(
        paymentId,
      );
    if (!billCode) {
      this.logger.log(
        `Payment ${paymentId} has no ToyyibPay bill yet — sync no-op`,
      );
      return { synced: false };
    }

    const credentials =
      await this.toyyibPayPaymentConfigService.getToyyibPayCredentialsForOption(
        payment.merchantPaymentPlatformOptionId,
      );
    const billStatus = await this.toyyibPayApiClient.getBillTransactionStatus(
      credentials.secretKey,
      billCode,
    );
    this.logger.log(
      `Payment ${paymentId} (bill ${billCode}): ToyyibPay reports isPaid=${billStatus.isPaid}, isFailed=${billStatus.isFailed}`,
    );

    if (billStatus.isPaid) {
      await this.toyyibPayPaymentFinalizationService.finalizeAsPaid(
        payment,
        source,
      );
      return { synced: true };
    }
    if (billStatus.isFailed) {
      await this.toyyibPayPaymentFinalizationService.finalizeAsFailed(
        payment,
        source,
      );
      return { synced: true };
    }
    this.logger.log(
      `Payment ${paymentId}: still nothing definitive — sync no-op`,
    );
    return { synced: false };
  }

  async syncAllStalePayments(): Promise<SyncAllStalePaymentsSummary> {
    const olderThan = new Date(
      Date.now() - STALE_PAYMENT_GRACE_MINUTES * 60_000,
    );
    const staleIds =
      await this.toyyibPayPaymentSyncRepository.getStaleOpenPaymentIds(
        olderThan,
      );

    let finalized = 0;
    for (const paymentId of staleIds) {
      const result = await this.syncPaymentSafely(paymentId);
      if (result.synced) {
        finalized++;
      }
    }

    this.logger.log(
      `Synced ${staleIds.length} stale ToyyibPay payment(s): ${finalized} finalized.`,
    );
    return { checked: staleIds.length, finalized };
  }

  private async syncPaymentSafely(
    paymentId: string,
  ): Promise<SyncPaymentResult> {
    try {
      return await this.syncPayment(paymentId, TransitionSource.SYSTEM);
    } catch (error) {
      this.logger.warn(
        `Failed to sync ToyyibPay payment ${paymentId}: ${(error as Error).message}`,
      );
      return { synced: false };
    }
  }
}
