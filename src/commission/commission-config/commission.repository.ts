import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/database/prisma.service';
import type { Prisma } from '../../../generated/prisma/client';
import type { PaymentProvider } from '../../../generated/prisma/enums';

const COMMISSION_PLAN_INCLUDE = {
  percentageCommissionPerTransaction: true,
  amountCommissionPerTransaction: true,
  percentageCommissionPerUnit: true,
  amountCommissionPerUnit: true,
} as const;

export type CommissionPlanPayload = Prisma.CommissionPlanGetPayload<{
  include: typeof COMMISSION_PLAN_INCLUDE;
}>;

@Injectable()
export class CommissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getActivePlanAssignedToOption(
    paymentPlatformOptionId: string,
  ): Promise<CommissionPlanPayload | null> {
    const assignment = await this.prisma.commissionAssignment.findUnique({
      where: { paymentPlatformOptionId },
      include: { commissionPlan: { include: COMMISSION_PLAN_INCLUDE } },
    });

    const assignedPlan = assignment?.commissionPlan ?? null;
    const isAssignedPlanActive = assignedPlan?.isActive === true;
    return isAssignedPlanActive ? assignedPlan : null;
  }

  // A plan with provider = null applies to any provider, so it is the fallback; a default made
  // for this exact provider wins over it.
  async getDefaultActivePlan(
    provider: PaymentProvider,
  ): Promise<CommissionPlanPayload | null> {
    return await this.prisma.commissionPlan.findFirst({
      where: {
        isDefault: true,
        isActive: true,
        OR: [{ provider }, { provider: null }],
      },
      orderBy: { provider: { sort: 'asc', nulls: 'last' } },
      include: COMMISSION_PLAN_INCLUDE,
    });
  }

  async getToyyibPaySplitRecipientForOption(
    paymentPlatformOptionId: string,
  ): Promise<string | null> {
    const link = await this.prisma.commissionToyyibPayMerchantOption.findFirst({
      where: { commissionAssignment: { paymentPlatformOptionId } },
      select: {
        systemToyyibPayPlatformAccount: { select: { splitRecipientId: true } },
      },
    });
    return link?.systemToyyibPayPlatformAccount.splitRecipientId ?? null;
  }
}
