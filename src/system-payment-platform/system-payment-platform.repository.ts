import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { PaymentProvider } from '../../generated/prisma/enums';

const SYSTEM_PLATFORM_INCLUDE = {
  toyyibPaySystemAccount: true,
  cashSystemAccount: true,
} as const;

export type SystemPlatformPayload = Prisma.SystemPaymentPlatformGetPayload<{
  include: typeof SYSTEM_PLATFORM_INCLUDE;
}>;

interface ToyyibPaySystemAccountFields {
  splitRecipientId: string;
  encryptedSecretKey: string;
  categoryCode: string;
  verifiedAt: Date;
}

@Injectable()
export class SystemPaymentPlatformRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSystemPlatforms(): Promise<SystemPlatformPayload[]> {
    return await this.prisma.systemPaymentPlatform.findMany({
      include: SYSTEM_PLATFORM_INCLUDE,
      orderBy: [{ provider: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async isSystemPlatformRegisteredForProvider(
    provider: PaymentProvider,
  ): Promise<boolean> {
    const count = await this.prisma.systemPaymentPlatform.count({
      where: { provider },
    });
    return count > 0;
  }

  async getToyyibPaySystemPlatformByAccountId(
    accountId: string,
  ): Promise<SystemPlatformPayload | null> {
    return await this.prisma.systemPaymentPlatform.findFirst({
      where: {
        provider: PaymentProvider.TOYYIBPAY,
        toyyibPaySystemAccount: { id: accountId },
      },
      include: SYSTEM_PLATFORM_INCLUDE,
    });
  }

  // Resolves a system platform from either of its provider-specific account rows.
  async getSystemPlatformByAccountId(
    accountId: string,
  ): Promise<SystemPlatformPayload | null> {
    return await this.prisma.systemPaymentPlatform.findFirst({
      where: {
        OR: [
          { toyyibPaySystemAccount: { id: accountId } },
          { cashSystemAccount: { id: accountId } },
        ],
      },
      include: SYSTEM_PLATFORM_INCLUDE,
    });
  }

  async countBillsForToyyibPayAccount(accountId: string): Promise<number> {
    return await this.prisma.systemToyyibPayPaymentPlatformBill.count({
      where: { category: { systemPlatformAccountId: accountId } },
    });
  }

  async countCommissionSplitsForAccount(accountId: string): Promise<number> {
    return await this.prisma.commissionToyyibPayMerchantOption.count({
      where: { systemToyyibPayPlatformAccountId: accountId },
    });
  }

  // Cascades to the provider-specific account row and its categories.
  async deleteSystemPlatform(id: string): Promise<void> {
    await this.prisma.systemPaymentPlatform.delete({ where: { id } });
  }

  async isToyyibPayUsernameTaken(
    splitRecipientId: string,
    excludeAccountId?: string,
  ): Promise<boolean> {
    const hasExcludeAccountId = excludeAccountId !== undefined;
    const count = await this.prisma.systemToyyibPayPaymentPlatformAccount.count(
      {
        where: {
          splitRecipientId,
          ...(hasExcludeAccountId && { id: { not: excludeAccountId } }),
        },
      },
    );
    return count > 0;
  }

  async createCashSystemPlatform(): Promise<SystemPlatformPayload> {
    return await this.prisma.systemPaymentPlatform.create({
      data: {
        provider: PaymentProvider.CASH,
        isDefault: true,
        cashSystemAccount: { create: {} },
      },
      include: SYSTEM_PLATFORM_INCLUDE,
    });
  }

  async createToyyibPaySystemPlatform(
    isDefault: boolean,
    fields: ToyyibPaySystemAccountFields,
  ): Promise<SystemPlatformPayload> {
    return await this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await this.setOtherToyyibPaySystemPlatformsAsNotDefault(tx);
      }

      return await tx.systemPaymentPlatform.create({
        data: {
          provider: PaymentProvider.TOYYIBPAY,
          isDefault,
          toyyibPaySystemAccount: {
            create: {
              splitRecipientId: fields.splitRecipientId,
              secretKey: fields.encryptedSecretKey,
              categoryCode: fields.categoryCode,
              verifiedAt: fields.verifiedAt,
            },
          },
        },
        include: SYSTEM_PLATFORM_INCLUDE,
      });
    });
  }

  async updateToyyibPaySystemPlatform(
    systemPlatformId: string,
    isDefault: boolean | undefined,
    fields: Partial<ToyyibPaySystemAccountFields>,
  ): Promise<SystemPlatformPayload> {
    return await this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await this.setOtherToyyibPaySystemPlatformsAsNotDefault(
          tx,
          systemPlatformId,
        );
      }

      return await tx.systemPaymentPlatform.update({
        where: { id: systemPlatformId },
        data: {
          ...(isDefault !== undefined && { isDefault }),
          toyyibPaySystemAccount: {
            update: this.getToyyibPaySystemAccountUpdateData(fields),
          },
        },
        include: SYSTEM_PLATFORM_INCLUDE,
      });
    });
  }

  private async setOtherToyyibPaySystemPlatformsAsNotDefault(
    tx: Prisma.TransactionClient,
    excludeSystemPlatformId?: string,
  ): Promise<void> {
    const hasExcludeSystemPlatformId = excludeSystemPlatformId !== undefined;

    await tx.systemPaymentPlatform.updateMany({
      where: {
        provider: PaymentProvider.TOYYIBPAY,
        isDefault: true,
        ...(hasExcludeSystemPlatformId && {
          id: { not: excludeSystemPlatformId },
        }),
      },
      data: { isDefault: false },
    });
  }

  private getToyyibPaySystemAccountUpdateData(
    fields: Partial<ToyyibPaySystemAccountFields>,
  ): Prisma.SystemToyyibPayPaymentPlatformAccountUpdateInput {
    const hasSplitRecipientId = fields.splitRecipientId !== undefined;
    const hasEncryptedSecretKey = fields.encryptedSecretKey !== undefined;
    const hasCategoryCode = fields.categoryCode !== undefined;
    const hasVerifiedAt = fields.verifiedAt !== undefined;

    return {
      ...(hasSplitRecipientId && { splitRecipientId: fields.splitRecipientId }),
      ...(hasEncryptedSecretKey && { secretKey: fields.encryptedSecretKey }),
      ...(hasCategoryCode && { categoryCode: fields.categoryCode }),
      ...(hasVerifiedAt && { verifiedAt: fields.verifiedAt }),
    };
  }
}
