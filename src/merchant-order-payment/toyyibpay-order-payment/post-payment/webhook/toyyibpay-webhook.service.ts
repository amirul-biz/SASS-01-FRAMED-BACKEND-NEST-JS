import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ToyyibPayPaymentConfigService } from '../../../../merchant-payment-platform/toyyibpay-payment-platform/toyyibpay-payment-config/toyyibpay-payment-config.service';
import {
  PaymentProvider,
  TransitionSource,
} from '../../../../../generated/prisma/enums';
import {
  PaymentForMarkingPayload,
  PaymentTransitionRepository,
} from '../../../core/payment-transition/payment-transition.repository';
import {
  ToyyibPayCallbackStatus,
  ToyyibPayWebhookCallbackDto,
} from './toyyibpay-webhook.dto';
import { ToyyibPayPaymentFinalizationService } from '../finalization/toyyibpay-payment-finalization.service';
import { verifyToyyibPayCallbackHash } from './toyyibpay-webhook.util';

@Injectable()
export class ToyyibPayWebhookService {
  private readonly logger = new Logger(ToyyibPayWebhookService.name);

  constructor(
    private readonly paymentTransitionRepository: PaymentTransitionRepository,
    private readonly toyyibPayPaymentConfigService: ToyyibPayPaymentConfigService,
    private readonly toyyibPayPaymentFinalizationService: ToyyibPayPaymentFinalizationService,
  ) {}

  async handleCallback(dto: ToyyibPayWebhookCallbackDto): Promise<void> {
    this.logger.log(
      `Received ToyyibPay callback for payment ${dto.order_id}: status=${dto.status}`,
    );

    const payment =
      await this.paymentTransitionRepository.getPaymentForMarkingById(
        dto.order_id,
      );
    if (!payment) {
      throw new NotFoundException('Payment not found for this callback');
    }

    const isToyyibPayPayment = payment.provider === PaymentProvider.TOYYIBPAY;
    if (!isToyyibPayPayment) {
      throw new BadRequestException('This payment is not a ToyyibPay payment');
    }

    const credentials =
      await this.toyyibPayPaymentConfigService.getToyyibPayCredentialsForOption(
        payment.merchantPaymentPlatformOptionId,
      );

    const isHashValid = verifyToyyibPayCallbackHash(credentials.secretKey, dto);
    if (!isHashValid) {
      this.logger.warn(
        `Rejected ToyyibPay callback with an invalid hash for order_id=${dto.order_id}`,
      );
      throw new BadRequestException('Invalid callback signature');
    }

    if (dto.status === ToyyibPayCallbackStatus.SUCCESS) {
      this.logger.log(`Payment ${payment.id}: callback branch = SUCCESS`);
      await this.handleSuccess(payment, dto);
      return;
    }
    if (dto.status === ToyyibPayCallbackStatus.FAILED) {
      this.logger.log(`Payment ${payment.id}: callback branch = FAILED`);
      await this.toyyibPayPaymentFinalizationService.finalizeAsFailed(
        payment,
        TransitionSource.WEBHOOK,
      );
      return;
    }
    this.logger.log(`Payment ${payment.id}: callback branch = PROCESSING`);
    await this.toyyibPayPaymentFinalizationService.finalizeAsProcessing(
      payment,
      TransitionSource.WEBHOOK,
    );
  }

  private async handleSuccess(
    payment: PaymentForMarkingPayload,
    dto: ToyyibPayWebhookCallbackDto,
  ): Promise<void> {
    const receivedAmount = Number(dto.amount);
    const storedAmount = Number(payment.amount);
    const isAmountMismatch = receivedAmount !== storedAmount;
    if (isAmountMismatch) {
      this.logger.warn(
        `ToyyibPay callback amount (${receivedAmount}) differs from the stored payment amount (${storedAmount}) for payment ${payment.id} — proceeding using the stored amount`,
      );
    }

    await this.toyyibPayPaymentFinalizationService.finalizeAsPaid(
      payment,
      TransitionSource.WEBHOOK,
    );
  }
}
