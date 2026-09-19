import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/database/prisma.service';
import type { Prisma } from '../../../generated/prisma/client';
import {
  ApprovalStatus,
  PaymentProvider,
} from '../../../generated/prisma/enums';
import { MerchantPaymentPlatformRepository } from '../merchant-payment-platform.repository';

const TOYYIBPAY_OPTION_INCLUDE = {
  toyyibPayPaymentPlatformOption: true,
} as const;

type ToyyibPayPaymentPlatformOptionPayload =
  Prisma.MerchantPaymentPlatformOptionsGetPayload<{
    include: typeof TOYYIBPAY_OPTION_INCLUDE;
  }>;

interface ToyyibPayOptionFields {
  categoryCode: string;
  encryptedSecretKey: string;
  chargeFpxToCustomer?: boolean;
  chargeToPrepaid?: boolean;
}

@Injectable()
export class ToyyibPayPaymentPlatformRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantPaymentPlatformRepository: MerchantPaymentPlatformRepository,
  ) {}

  async getToyyibPayPaymentPlatformOptionById(
    id: string,
  ): Promise<ToyyibPayPaymentPlatformOptionPayload | null> {
    return await this.prisma.merchantPaymentPlatformOptions.findFirst({
      where: { id, provider: PaymentProvider.TOYYIBPAY },
      include: TOYYIBPAY_OPTION_INCLUDE,
    });
  }

  async createToyyibPayPaymentPlatformOption(
    userPlatformId: string,
    isDefaultPaymentPlatform: boolean,
    approvalStatus: ApprovalStatus,
    fields: ToyyibPayOptionFields,
  ): Promise<ToyyibPayPaymentPlatformOptionPayload> {
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
          provider: PaymentProvider.TOYYIBPAY,
          isDefaultPaymentPlatform,
          approvalStatus,
          toyyibPayPaymentPlatformOption: {
            create: {
              categoryCode: fields.categoryCode,
              secretKey: fields.encryptedSecretKey,
              chargeFpxToCustomer: fields.chargeFpxToCustomer ?? false,
              chargeToPrepaid: fields.chargeToPrepaid ?? false,
            },
          },
        },
        include: TOYYIBPAY_OPTION_INCLUDE,
      });
    });
  }

  async updateToyyibPayPaymentPlatformOption(
    id: string,
    userPlatformId: string,
    isDefaultPaymentPlatform: boolean | undefined,
    fields: Partial<ToyyibPayOptionFields>,
  ): Promise<ToyyibPayPaymentPlatformOptionPayload> {
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
        data: {
          ...(isDefaultPaymentPlatform !== undefined && {
            isDefaultPaymentPlatform,
          }),
          toyyibPayPaymentPlatformOption: {
            update: this.getToyyibPayOptionUpdateData(fields),
          },
        },
        include: TOYYIBPAY_OPTION_INCLUDE,
      });
    });
  }

  private getToyyibPayOptionUpdateData(
    fields: Partial<ToyyibPayOptionFields>,
  ): Prisma.MerchantToyyibPayPaymentPlatformOptionUpdateInput {
    const hasCategoryCode = fields.categoryCode !== undefined;
    const hasEncryptedSecretKey = fields.encryptedSecretKey !== undefined;
    const hasChargeFpxToCustomer = fields.chargeFpxToCustomer !== undefined;
    const hasChargeToPrepaid = fields.chargeToPrepaid !== undefined;

    return {
      ...(hasCategoryCode && { categoryCode: fields.categoryCode }),
      ...(hasEncryptedSecretKey && { secretKey: fields.encryptedSecretKey }),
      ...(hasChargeFpxToCustomer && {
        chargeFpxToCustomer: fields.chargeFpxToCustomer,
      }),
      ...(hasChargeToPrepaid && { chargeToPrepaid: fields.chargeToPrepaid }),
    };
  }
}
