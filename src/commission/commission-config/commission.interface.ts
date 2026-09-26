import type { Prisma } from '../../../generated/prisma/client';
import type { CommissionType } from '../../../generated/prisma/enums';
import type { CommissionPlanPayload } from './commission.repository';

export interface CommissionOrderBasis {
  amountPaid: number;
  itemPrices: number[];
}

export type CommissionChargeDetailCreateInput = Pick<
  Prisma.CommissionChargeCreateInput,
  | 'percentagePerTransaction'
  | 'amountPerTransaction'
  | 'percentagePerUnit'
  | 'amountPerUnit'
>;

export interface CommissionBreakdown {
  commissionType: CommissionType;
  commissionBaseAmount: number;
  commissionAmount: number;
  chargeDetail: CommissionChargeDetailCreateInput;
}

export interface CommissionCalculation extends CommissionBreakdown {
  commissionPlanId: string;
  originalPaymentAmount: number;
}

export interface CommissionCalculator {
  readonly type: CommissionType;
  getPlanValue(plan: CommissionPlanPayload): number | null;
  calculate(value: number, order: CommissionOrderBasis): CommissionBreakdown;
}
