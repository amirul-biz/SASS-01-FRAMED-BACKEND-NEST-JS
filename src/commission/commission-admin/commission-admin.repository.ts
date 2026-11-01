import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/database/prisma.service';
import type { Prisma } from '../../../generated/prisma/client';
import {
  CommissionType,
  PaymentBillStatus,
  PaymentProvider,
} from '../../../generated/prisma/enums';
import { COMMISSION_CHARGE_INCLUDE } from '../commission-config/commission-charge.include';

const PLAN_INCLUDE = {
  percentageCommissionPerTransaction: true,
  amountCommissionPerTransaction: true,
  percentageCommissionPerUnit: true,
  amountCommissionPerUnit: true,
  _count: { select: { assignments: true } },
} as const;

export type CommissionAdminPlanPayload = Prisma.CommissionPlanGetPayload<{
  include: typeof PLAN_INCLUDE;
}>;

// One row per payment option: who owns it, the plan assigned to it (if any), and the split link.
const ASSIGNMENT_ROW_INCLUDE = {
  userPlatform: {
    select: {
      user: { select: { email: true } },
      photographerProfile: { select: { name: true } },
    },
  },
  commissionAssignment: {
    select: {
      commissionPlan: { select: { id: true, name: true } },
      toyyibPayMerchantOption: {
        select: {
          systemToyyibPayPlatformAccount: {
            select: { id: true, splitRecipientId: true },
          },
        },
      },
    },
  },
} as const;

export type CommissionAssignmentRowPayload =
  Prisma.MerchantPaymentPlatformOptionsGetPayload<{
    include: typeof ASSIGNMENT_ROW_INCLUDE;
  }>;

// One row per paid payment, with everything the report needs to recompute its charge.
const REPORT_PAYMENT_INCLUDE = {
  order: {
    select: {
      items: { select: { price: true } },
      event: {
        select: {
          title: true,
          photographerProfile: { select: { id: true, name: true } },
        },
      },
    },
  },
  commissionCharge: {
    include: {
      ...COMMISSION_CHARGE_INCLUDE,
      commissionPlan: { select: { name: true } },
    },
  },
} as const;

export type CommissionReportPaymentPayload = Prisma.MerchantPaymentGetPayload<{
  include: typeof REPORT_PAYMENT_INCLUDE;
}>;

export interface CommissionReportFilters {
  provider: PaymentProvider;
  from?: Date;
  to?: Date;
}

export interface CommissionReportDbTotals {
  grossPaid: number;
  commission: number;
}

export interface CreateCommissionPlanData {
  name: string;
  type: CommissionType;
  provider: PaymentProvider | null;
  isDefault: boolean;
  value: number;
}

export interface UpdateCommissionPlanData {
  name?: string;
  value?: number;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface AssignCommissionPlanData {
  paymentPlatformOptionId: string;
  commissionPlanId: string;
  split: {
    toyyibPayPaymentPlatformOptionId: string;
    systemToyyibPayPlatformAccountId: string;
  } | null;
}

@Injectable()
export class CommissionAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getPlans(): Promise<CommissionAdminPlanPayload[]> {
    return await this.prisma.commissionPlan.findMany({
      include: PLAN_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  async getPlanById(id: string): Promise<CommissionAdminPlanPayload | null> {
    return await this.prisma.commissionPlan.findUnique({
      where: { id },
      include: PLAN_INCLUDE,
    });
  }

  async createPlan(
    data: CreateCommissionPlanData,
  ): Promise<CommissionAdminPlanPayload> {
    return await this.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await this.setOtherPlansInProviderScopeAsNotDefault(tx, data.provider);
      }

      return await tx.commissionPlan.create({
        data: {
          name: data.name,
          type: data.type,
          provider: data.provider,
          isDefault: data.isDefault,
          ...this.getValueRowCreateData(data.type, data.name, data.value),
        },
        include: PLAN_INCLUDE,
      });
    });
  }

  async updatePlan(
    plan: {
      id: string;
      type: CommissionType;
      provider: PaymentProvider | null;
    },
    data: UpdateCommissionPlanData,
  ): Promise<CommissionAdminPlanPayload> {
    return await this.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await this.setOtherPlansInProviderScopeAsNotDefault(
          tx,
          plan.provider,
          plan.id,
        );
      }

      return await tx.commissionPlan.update({
        where: { id: plan.id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...this.getValueRowUpdateData(plan.type, data.name, data.value),
        },
        include: PLAN_INCLUDE,
      });
    });
  }

  async getAssignmentRows(filters: {
    provider?: PaymentProvider;
    skip: number;
    take: number;
  }): Promise<{
    items: CommissionAssignmentRowPayload[];
    totalItemCount: number;
  }> {
    const where: Prisma.MerchantPaymentPlatformOptionsWhereInput = {
      ...(filters.provider && { provider: filters.provider }),
    };

    const [items, totalItemCount] = await Promise.all([
      this.prisma.merchantPaymentPlatformOptions.findMany({
        where,
        include: ASSIGNMENT_ROW_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: filters.skip,
        take: filters.take,
      }),
      this.prisma.merchantPaymentPlatformOptions.count({ where }),
    ]);
    return { items, totalItemCount };
  }

  async getAssignmentRowByOptionId(
    paymentPlatformOptionId: string,
  ): Promise<CommissionAssignmentRowPayload | null> {
    return await this.prisma.merchantPaymentPlatformOptions.findUnique({
      where: { id: paymentPlatformOptionId },
      include: ASSIGNMENT_ROW_INCLUDE,
    });
  }

  async getOptionForAssignment(paymentPlatformOptionId: string) {
    return await this.prisma.merchantPaymentPlatformOptions.findUnique({
      where: { id: paymentPlatformOptionId },
      select: {
        id: true,
        provider: true,
        toyyibPayPaymentPlatformOption: { select: { id: true } },
      },
    });
  }

  async getPlanForAssignment(commissionPlanId: string) {
    return await this.prisma.commissionPlan.findUnique({
      where: { id: commissionPlanId },
      select: { id: true, isActive: true, provider: true },
    });
  }

  async isToyyibPaySystemAccountExisting(accountId: string): Promise<boolean> {
    const count = await this.prisma.systemToyyibPayPaymentPlatformAccount.count(
      { where: { id: accountId } },
    );
    return count > 0;
  }

  async getAssignmentByOptionId(paymentPlatformOptionId: string) {
    return await this.prisma.commissionAssignment.findUnique({
      where: { paymentPlatformOptionId },
      select: {
        id: true,
        toyyibPayMerchantOption: { select: { id: true } },
      },
    });
  }

  // The split link hangs off the assignment (one row per option), so both are written together —
  // there is never an assignment-less split or a stale split left behind.
  async assignPlan(data: AssignCommissionPlanData): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const assignment = await tx.commissionAssignment.upsert({
        where: { paymentPlatformOptionId: data.paymentPlatformOptionId },
        create: {
          paymentPlatformOptionId: data.paymentPlatformOptionId,
          commissionPlanId: data.commissionPlanId,
        },
        update: { commissionPlanId: data.commissionPlanId },
      });

      if (!data.split) {
        await tx.commissionToyyibPayMerchantOption.deleteMany({
          where: { commissionAssignmentId: assignment.id },
        });
        return;
      }

      await tx.commissionToyyibPayMerchantOption.upsert({
        where: { commissionAssignmentId: assignment.id },
        create: {
          commissionAssignmentId: assignment.id,
          toyyibPayPaymentPlatformOptionId:
            data.split.toyyibPayPaymentPlatformOptionId,
          systemToyyibPayPlatformAccountId:
            data.split.systemToyyibPayPlatformAccountId,
        },
        update: {
          systemToyyibPayPlatformAccountId:
            data.split.systemToyyibPayPlatformAccountId,
        },
      });
    });
  }

  async deleteAssignment(paymentPlatformOptionId: string): Promise<void> {
    await this.prisma.commissionAssignment.delete({
      where: { paymentPlatformOptionId },
    });
  }

  async countChargesForPlan(planId: string): Promise<number> {
    return await this.prisma.commissionCharge.count({
      where: { commissionPlanId: planId },
    });
  }

  // Deletes the plan and its owned value row together — the value row would otherwise be left
  // orphaned (the plan holds the FK; nothing cascades in that direction).
  async deletePlan(plan: CommissionAdminPlanPayload): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.commissionPlan.delete({ where: { id: plan.id } });

      switch (plan.type) {
        case CommissionType.PERCENTAGE_PER_TRANSACTION:
          if (plan.percentageCommissionPerTransaction) {
            await tx.percentageCommissionPerTransaction.delete({
              where: { id: plan.percentageCommissionPerTransaction.id },
            });
          }
          break;
        case CommissionType.AMOUNT_PER_TRANSACTION:
          if (plan.amountCommissionPerTransaction) {
            await tx.amountCommissionPerTransaction.delete({
              where: { id: plan.amountCommissionPerTransaction.id },
            });
          }
          break;
        case CommissionType.PERCENTAGE_PER_UNIT:
          if (plan.percentageCommissionPerUnit) {
            await tx.percentageCommissionPerUnit.delete({
              where: { id: plan.percentageCommissionPerUnit.id },
            });
          }
          break;
        case CommissionType.AMOUNT_PER_UNIT:
          if (plan.amountCommissionPerUnit) {
            await tx.amountCommissionPerUnit.delete({
              where: { id: plan.amountCommissionPerUnit.id },
            });
          }
          break;
      }
    });
  }

  // ponytail: loads every paid payment in range; move the grouping to SQL if ranges get huge.
  async getPaidPaymentsForReport(
    filters: CommissionReportFilters,
  ): Promise<CommissionReportPaymentPayload[]> {
    return await this.prisma.merchantPayment.findMany({
      where: this.getPaidPaymentWhere(filters),
      include: REPORT_PAYMENT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  // Independent of the rows above, so the period check compares two separate reads.
  async getPaidTotalsForReport(
    filters: CommissionReportFilters,
  ): Promise<CommissionReportDbTotals> {
    const where = this.getPaidPaymentWhere(filters);
    const [payments, charges] = await Promise.all([
      this.prisma.merchantPayment.aggregate({ where, _sum: { amount: true } }),
      this.prisma.commissionCharge.aggregate({
        where: { payment: where },
        _sum: { commissionAmount: true },
      }),
    ]);
    return {
      grossPaid: Number(payments._sum.amount ?? 0),
      commission: Number(charges._sum.commissionAmount ?? 0),
    };
  }

  private getPaidPaymentWhere(
    filters: CommissionReportFilters,
  ): Prisma.MerchantPaymentWhereInput {
    const hasDateRange = filters.from !== undefined || filters.to !== undefined;
    return {
      provider: filters.provider,
      status: PaymentBillStatus.PAID,
      ...(hasDateRange && {
        createdAt: {
          ...(filters.from && { gte: filters.from }),
          ...(filters.to && { lte: filters.to }),
        },
      }),
    };
  }

  // provider = null is its own scope (the "any provider" default), so `provider: null` matches
  // exactly those plans rather than every plan.
  private async setOtherPlansInProviderScopeAsNotDefault(
    tx: Prisma.TransactionClient,
    provider: PaymentProvider | null,
    excludePlanId?: string,
  ): Promise<void> {
    const hasExcludePlanId = excludePlanId !== undefined;

    await tx.commissionPlan.updateMany({
      where: {
        isDefault: true,
        provider,
        ...(hasExcludePlanId && { id: { not: excludePlanId } }),
      },
      data: { isDefault: false },
    });
  }

  // The DB CHECK constraint needs exactly one value row matching `type`, so the plan and its
  // value row are always created together in one nested write.
  private getValueRowCreateData(
    type: CommissionType,
    name: string,
    value: number,
  ): Pick<
    Prisma.CommissionPlanCreateInput,
    | 'percentageCommissionPerTransaction'
    | 'amountCommissionPerTransaction'
    | 'percentageCommissionPerUnit'
    | 'amountCommissionPerUnit'
  > {
    switch (type) {
      case CommissionType.PERCENTAGE_PER_TRANSACTION:
        return {
          percentageCommissionPerTransaction: {
            create: { name, percentageValue: value },
          },
        };
      case CommissionType.AMOUNT_PER_TRANSACTION:
        return {
          amountCommissionPerTransaction: {
            create: { name, amountValue: value },
          },
        };
      case CommissionType.PERCENTAGE_PER_UNIT:
        return {
          percentageCommissionPerUnit: {
            create: { name, percentageValue: value },
          },
        };
      case CommissionType.AMOUNT_PER_UNIT:
        return {
          amountCommissionPerUnit: { create: { name, amountValue: value } },
        };
    }
  }

  private getValueRowUpdateData(
    type: CommissionType,
    name: string | undefined,
    value: number | undefined,
  ): Prisma.CommissionPlanUpdateInput {
    const hasName = name !== undefined;
    const hasValue = value !== undefined;
    if (!hasName && !hasValue) {
      return {};
    }

    switch (type) {
      case CommissionType.PERCENTAGE_PER_TRANSACTION:
        return {
          percentageCommissionPerTransaction: {
            update: {
              ...(hasName && { name }),
              ...(hasValue && { percentageValue: value }),
            },
          },
        };
      case CommissionType.AMOUNT_PER_TRANSACTION:
        return {
          amountCommissionPerTransaction: {
            update: {
              ...(hasName && { name }),
              ...(hasValue && { amountValue: value }),
            },
          },
        };
      case CommissionType.PERCENTAGE_PER_UNIT:
        return {
          percentageCommissionPerUnit: {
            update: {
              ...(hasName && { name }),
              ...(hasValue && { percentageValue: value }),
            },
          },
        };
      case CommissionType.AMOUNT_PER_UNIT:
        return {
          amountCommissionPerUnit: {
            update: {
              ...(hasName && { name }),
              ...(hasValue && { amountValue: value }),
            },
          },
        };
    }
  }
}
