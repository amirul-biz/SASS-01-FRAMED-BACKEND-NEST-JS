import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/database/prisma.service';
import type { Prisma } from '../../../../generated/prisma/client';
import { PaymentProvider } from '../../../../generated/prisma/enums';
import type { CommissionCalculation } from '../../../commission/commission-config/commission.interface';

export interface CreateToyyibPayBillParams {
  paymentId: string;
  paymentPlatformOptionId: string;
  billCode: string;
  requestPayload: Record<string, string>;
  responsePayload: unknown;
  splitRecipientUsername: string | null;
  splitCommission: CommissionCalculation | null;
}

@Injectable()
export class ToyyibPayPrePaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createToyyibPayBill(params: CreateToyyibPayBillParams): Promise<void> {
    await this.prisma.merchantPaymentPlatformBill.create({
      data: {
        paymentId: params.paymentId,
        provider: PaymentProvider.TOYYIBPAY,
        paymentPlatformOptionId: params.paymentPlatformOptionId,
        toyyibPayDetail: {
          create: {
            billCode: params.billCode,
            requestPayload: params.requestPayload,
            responsePayload: params.responsePayload as Prisma.InputJsonValue,
            splitRecipientUsername: params.splitRecipientUsername,
            splitCommission: params.splitCommission as unknown as
              Prisma.InputJsonValue | undefined,
          },
        },
      },
    });
  }

  // Used on a retried checkout (duplicate idempotency key) to reuse the bill already created for
  // this payment, instead of asking ToyyibPay for a second one.
  async getBillCodeByPaymentId(paymentId: string): Promise<string | null> {
    const bill = await this.prisma.merchantPaymentPlatformBill.findUnique({
      where: { paymentId },
      include: { toyyibPayDetail: true },
    });
    return bill?.toyyibPayDetail?.billCode ?? null;
  }

  // The commission split is fixed-cents and locked in with ToyyibPay at bill creation — this is
  // the source of truth finalization must reuse, not recompute, so the recorded CommissionCharge
  // can never drift from what ToyyibPay actually split off the payment.
  async getSplitCommissionByPaymentId(
    paymentId: string,
  ): Promise<CommissionCalculation | null> {
    const bill = await this.prisma.merchantPaymentPlatformBill.findUnique({
      where: { paymentId },
      include: { toyyibPayDetail: true },
    });
    return (
      (bill?.toyyibPayDetail
        ?.splitCommission as CommissionCalculation | null) ?? null
    );
  }
}
