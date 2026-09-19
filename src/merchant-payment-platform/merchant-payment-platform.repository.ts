import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/database/prisma.service';
import type {
  Prisma,
  MerchantPaymentPlatformOptions,
} from '../../generated/prisma/client';
import type { PaymentProvider } from '../../generated/prisma/enums';

@Injectable()
export class MerchantPaymentPlatformRepository {
  constructor(private readonly prisma: PrismaService) {}

  async setOtherPaymentPlatformOptionsAsNotDefault(
    tx: Prisma.TransactionClient,
    userPlatformId: string,
    excludeOptionId?: string,
  ): Promise<void> {
    await tx.merchantPaymentPlatformOptions.updateMany({
      where: this.getOtherDefaultOptionsWhere(userPlatformId, excludeOptionId),
      data: { isDefaultPaymentPlatform: false },
    });
  }

  private getOtherDefaultOptionsWhere(
    userPlatformId: string,
    excludeOptionId?: string,
  ): Prisma.MerchantPaymentPlatformOptionsWhereInput {
    const hasExcludeOptionId = excludeOptionId !== undefined;

    return {
      userPlatformId,
      isDefaultPaymentPlatform: true,
      ...(hasExcludeOptionId && { id: { not: excludeOptionId } }),
    };
  }

  async isPaymentPlatformOptionRegisteredForProvider(
    userPlatformId: string,
    provider: PaymentProvider,
  ): Promise<boolean> {
    const count = await this.prisma.merchantPaymentPlatformOptions.count({
      where: { userPlatformId, provider },
    });
    return count > 0;
  }

  async getCurrentMerchantPaymentPlatformOptions(
    userPlatformId: string,
  ): Promise<MerchantPaymentPlatformOptions[]> {
    return await this.prisma.merchantPaymentPlatformOptions.findMany({
      where: { userPlatformId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
