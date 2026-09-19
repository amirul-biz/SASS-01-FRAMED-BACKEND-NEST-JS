import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/database/prisma.service';
import type { Prisma } from '../../../generated/prisma/client';
import {
  ApprovalStatus,
  PaymentProvider,
} from '../../../generated/prisma/enums';
import { MerchantPaymentPlatformRepository } from '../merchant-payment-platform.repository';

const CASH_OPTION_INCLUDE = { cashPaymentPlatformOption: true } as const;

type CashPaymentPlatformOptionPayload =
  Prisma.MerchantPaymentPlatformOptionsGetPayload<{
    include: typeof CASH_OPTION_INCLUDE;
  }>;

@Injectable()
export class CashPaymentPlatformRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantPaymentPlatformRepository: MerchantPaymentPlatformRepository,
  ) {}

  async getCashPaymentPlatformOptionById(
    id: string,
  ): Promise<CashPaymentPlatformOptionPayload | null> {
    return await this.prisma.merchantPaymentPlatformOptions.findFirst({
      where: { id, provider: PaymentProvider.CASH },
      include: CASH_OPTION_INCLUDE,
    });
  }

  async createCashPaymentPlatformOption(
    userPlatformId: string,
    isDefaultPaymentPlatform: boolean,
    approvalStatus: ApprovalStatus,
  ): Promise<CashPaymentPlatformOptionPayload> {
    return await this.prisma.$transaction(async (tx) => {
      if (isDefaultPaymentPlatform) {
        await this.merchantPaymentPlatformRepository.setOtherPaymentPlatformOptionsAsNotDefault(
          tx,
          userPlatformId,
        );
      }

      return await tx.merchantPaymentPlatformOptions.create({
        data: {
          userPlatformId,
          provider: PaymentProvider.CASH,
          isDefaultPaymentPlatform,
          approvalStatus,
          cashPaymentPlatformOption: { create: {} },
        },
        include: CASH_OPTION_INCLUDE,
      });
    });
  }

  async updateCashPaymentPlatformOption(
    id: string,
    userPlatformId: string,
    isDefaultPaymentPlatform?: boolean,
  ): Promise<CashPaymentPlatformOptionPayload> {
    return await this.prisma.$transaction(async (tx) => {
      if (isDefaultPaymentPlatform) {
        await this.merchantPaymentPlatformRepository.setOtherPaymentPlatformOptionsAsNotDefault(
          tx,
          userPlatformId,
          id,
        );
      }

      return await tx.merchantPaymentPlatformOptions.update({
        where: { id },
        data: this.getCashOptionUpdateData(isDefaultPaymentPlatform),
        include: CASH_OPTION_INCLUDE,
      });
    });
  }

  private getCashOptionUpdateData(
    isDefaultPaymentPlatform?: boolean,
  ): Prisma.MerchantPaymentPlatformOptionsUpdateInput {
    const hasIsDefaultPaymentPlatform = isDefaultPaymentPlatform !== undefined;

    return {
      ...(hasIsDefaultPaymentPlatform && { isDefaultPaymentPlatform }),
    };
  }
}
