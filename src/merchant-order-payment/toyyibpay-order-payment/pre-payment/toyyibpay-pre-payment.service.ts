import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  ToyyibPayApiClient,
  ToyyibPayBillCreationError,
} from '../../../merchant-payment-platform/toyyibpay-payment-platform/toyyibpay-payment-config/toyyibpay-api.client';
import { ToyyibPayPaymentConfigService } from '../../../merchant-payment-platform/toyyibpay-payment-platform/toyyibpay-payment-config/toyyibpay-payment-config.service';
import { CommissionService } from '../../../commission/commission-config/commission.service';
import type { CommissionCalculation } from '../../../commission/commission-config/commission.interface';
import { ToyyibPayPrePaymentRepository } from './toyyibpay-pre-payment.repository';

export interface CreateToyyibPayBillForPaymentParams {
  paymentId: string;
  paymentPlatformOptionId: string;
  amount: number;
  itemPrices: number[];
  isImposeCommission: boolean;
  externalReferenceNo: string;
  billName: string;
  billDescription: string;
  payerName: string;
  payerEmail: string;
  payerPhone: string;
}

interface ResolvedSplitPayment {
  recipientUsername: string;
  amountInCents: number;
  commission: CommissionCalculation;
}

@Injectable()
export class ToyyibPayPrePaymentService {
  private readonly logger = new Logger(ToyyibPayPrePaymentService.name);

  constructor(
    private readonly toyyibPayPaymentConfigService: ToyyibPayPaymentConfigService,
    private readonly toyyibPayApiClient: ToyyibPayApiClient,
    private readonly commissionService: CommissionService,
    private readonly toyyibPayPrePaymentRepository: ToyyibPayPrePaymentRepository,
  ) {}

  async createBillForPayment(
    params: CreateToyyibPayBillForPaymentParams,
  ): Promise<string> {
    const credentials =
      await this.toyyibPayPaymentConfigService.getToyyibPayCredentialsForOption(
        params.paymentPlatformOptionId,
      );
    const splitPayment = await this.resolveSplitPayment(params);

    const { billCode, requestPayload, responsePayload } =
      await this.createBillOrThrow({
        secretKey: credentials.secretKey,
        categoryCode: credentials.categoryCode,
        billName: params.billName,
        billDescription: params.billDescription,
        amountInCents: Math.round(params.amount * 100),
        returnUrl: this.getReturnUrl(),
        callbackUrl: this.getCallbackUrl(),
        externalReferenceNo: params.externalReferenceNo,
        payerName: params.payerName,
        payerEmail: params.payerEmail,
        payerPhone: params.payerPhone,
        chargeFeeToCustomer: credentials.chargeFpxToCustomer,
        splitPayment: splitPayment
          ? {
              recipientUsername: splitPayment.recipientUsername,
              amountInCents: splitPayment.amountInCents,
            }
          : undefined,
      });

    await this.toyyibPayPrePaymentRepository.createToyyibPayBill({
      paymentId: params.paymentId,
      paymentPlatformOptionId: params.paymentPlatformOptionId,
      billCode,
      requestPayload,
      responsePayload,
      splitRecipientUsername: splitPayment?.recipientUsername ?? null,
      splitCommission: splitPayment?.commission ?? null,
    });

    const splitLogSuffix = splitPayment
      ? `split ${splitPayment.amountInCents} cents to ${splitPayment.recipientUsername}`
      : 'no split';
    this.logger.log(
      `Created ToyyibPay bill ${billCode} for payment ${params.paymentId} (${splitLogSuffix})`,
    );

    return this.toyyibPayApiClient.getBillPaymentUrl(billCode);
  }

  // ToyyibPay's split payment is fixed-cents and locked in at bill creation, so the commission
  // that will actually be deducted has to be known now — not after payment succeeds, which is
  // when every other provider (and non-split ToyyibPay options) computes it. Only options with a
  // CommissionToyyibPayMerchantOption link go through this; everything else behaves exactly as
  // before (commission computed post-payment).
  private async resolveSplitPayment(
    params: CreateToyyibPayBillForPaymentParams,
  ): Promise<ResolvedSplitPayment | null> {
    const recipientUsername =
      await this.commissionService.getToyyibPaySplitRecipient(
        params.paymentPlatformOptionId,
      );
    if (!recipientUsername) {
      return null;
    }

    const commission = await this.commissionService.getCommissionForPayment({
      paymentPlatformOptionId: params.paymentPlatformOptionId,
      isImposeCommission: params.isImposeCommission,
      order: { amountPaid: params.amount, itemPrices: params.itemPrices },
    });
    if (!commission) {
      return null;
    }

    return {
      recipientUsername,
      amountInCents: Math.round(commission.commissionAmount * 100),
      commission,
    };
  }

  // Used on a retried checkout (duplicate idempotency key) to hand back the same payment link
  // instead of creating a second bill. Returns null when no bill exists yet for this payment (the
  // previous attempt died between the order commit and the bill write) — the caller falls back to
  // createBillForPayment in that case, which is safe since nothing was written yet.
  async getExistingBillPaymentUrl(paymentId: string): Promise<string | null> {
    const billCode =
      await this.toyyibPayPrePaymentRepository.getBillCodeByPaymentId(
        paymentId,
      );
    return billCode
      ? this.toyyibPayApiClient.getBillPaymentUrl(billCode)
      : null;
  }

  // Read lazily (per-call), not as a module-level constant — a top-level `const X =
  // process.env.Y` is evaluated the instant this file is imported, which happens while Node is
  // still resolving the module graph, before NestJS's ConfigModule has loaded .env into
  // process.env. Reading process.env inside a method runs at request time, long after bootstrap
  // has finished, so it sees the real value.
  private getReturnUrl(): string {
    return process.env.TOYYIBPAY_RETURN_URL ?? 'http://localhost:4200';
  }

  private getCallbackUrl(): string {
    return process.env.TOYYIBPAY_CALLBACK_URL ?? '';
  }

  private async createBillOrThrow(
    ...args: Parameters<ToyyibPayApiClient['createBill']>
  ): ReturnType<ToyyibPayApiClient['createBill']> {
    try {
      return await this.toyyibPayApiClient.createBill(...args);
    } catch (error) {
      if (error instanceof ToyyibPayBillCreationError) {
        throw new InternalServerErrorException(
          `Could not create the ToyyibPay bill: ${error.message}`,
        );
      }
      throw error;
    }
  }
}
