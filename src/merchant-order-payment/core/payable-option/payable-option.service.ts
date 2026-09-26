import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  MerchantPaymentPlatformOptions,
  Prisma,
} from '../../../../generated/prisma/client';
import {
  PaymentBillStatus,
  PaymentProvider,
} from '../../../../generated/prisma/enums';
import { PayableOptionRepository } from './payable-option.repository';

const SUPPORTED_ORDER_PAYMENT_PROVIDERS: PaymentProvider[] = [
  PaymentProvider.CASH,
  PaymentProvider.TOYYIBPAY,
];

@Injectable()
export class PayableOptionService {
  constructor(
    private readonly payableOptionRepository: PayableOptionRepository,
  ) {}

  async getPayableOption(
    photographerProfileId: string,
  ): Promise<MerchantPaymentPlatformOptions> {
    const approvedOptions =
      await this.payableOptionRepository.getApprovedOptionsByPhotographerProfileId(
        photographerProfileId,
      );
    if (approvedOptions.length === 0) {
      throw new BadRequestException(
        'This photographer has not set up an approved payment method yet',
      );
    }

    const payableOption = approvedOptions.find((option) =>
      SUPPORTED_ORDER_PAYMENT_PROVIDERS.includes(option.provider),
    );
    if (!payableOption) {
      throw new BadRequestException(
        "This photographer's payment method is not supported for checkout yet",
      );
    }
    return payableOption;
  }

  getPendingPaymentCreateInput(
    option: MerchantPaymentPlatformOptions,
    amount: number,
  ): Prisma.MerchantPaymentCreateWithoutOrderInput {
    return {
      provider: option.provider,
      amount,
      status: PaymentBillStatus.PENDING,
      merchantPaymentPlatformOption: { connect: { id: option.id } },
    };
  }
}
