import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/database/prisma.service';
import type {
  Prisma,
  MerchantPaymentPlatformOptions,
} from '../../generated/prisma/client';
import type {
  ApprovalStatus,
  PaymentProvider,
} from '../../generated/prisma/enums';

// Admin approval queue: who submitted the option, and who reviewed it. The ToyyibPay secret key is
// deliberately not selected — only the (non-secret) category code is shown to the reviewer.
const APPROVAL_OPTION_INCLUDE = {
  userPlatform: {
    select: {
      user: { select: { email: true } },
      photographerProfile: { select: { name: true } },
    },
  },
  approvalStatusUpdatedByUserPlatform: {
    select: { adminProfile: { select: { name: true } } },
  },
  toyyibPayPaymentPlatformOption: {
    select: { categoryCode: true, verifiedAt: true },
  },
} as const;

export type ApprovalOptionPayload =
  Prisma.MerchantPaymentPlatformOptionsGetPayload<{
    include: typeof APPROVAL_OPTION_INCLUDE;
  }>;

export interface ApprovalOptionFilters {
  status?: ApprovalStatus;
  provider?: PaymentProvider;
  skip: number;
  take: number;
}

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

  async getOptionsForApproval(
    filters: ApprovalOptionFilters,
  ): Promise<{ items: ApprovalOptionPayload[]; totalItemCount: number }> {
    const where: Prisma.MerchantPaymentPlatformOptionsWhereInput = {
      ...(filters.status && { approvalStatus: filters.status }),
      ...(filters.provider && { provider: filters.provider }),
    };

    const [items, totalItemCount] = await Promise.all([
      this.prisma.merchantPaymentPlatformOptions.findMany({
        where,
        include: APPROVAL_OPTION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: filters.skip,
        take: filters.take,
      }),
      this.prisma.merchantPaymentPlatformOptions.count({ where }),
    ]);
    return { items, totalItemCount };
  }

  async getOptionForApprovalById(
    id: string,
  ): Promise<ApprovalOptionPayload | null> {
    return await this.prisma.merchantPaymentPlatformOptions.findUnique({
      where: { id },
      include: APPROVAL_OPTION_INCLUDE,
    });
  }

  // The approval include never selects the secret key, so the re-check on approve reads it here.
  async getToyyibPayCredentialsByOptionId(
    paymentPlatformOptionId: string,
  ): Promise<{ categoryCode: string; secretKey: string } | null> {
    return await this.prisma.merchantToyyibPayPaymentPlatformOption.findUnique({
      where: { paymentPlatformOptionId },
      select: { categoryCode: true, secretKey: true },
    });
  }

  async updateApprovalStatus(
    id: string,
    approvalStatus: ApprovalStatus,
    reviewerUserPlatformId: string,
    verifiedAt?: Date,
  ): Promise<ApprovalOptionPayload> {
    return await this.prisma.merchantPaymentPlatformOptions.update({
      where: { id },
      data: {
        approvalStatus,
        approvalStatusUpdatedAt: new Date(),
        approvalStatusUpdatedByUserPlatformId: reviewerUserPlatformId,
        ...(verifiedAt && {
          toyyibPayPaymentPlatformOption: { update: { verifiedAt } },
        }),
      },
      include: APPROVAL_OPTION_INCLUDE,
    });
  }
}
