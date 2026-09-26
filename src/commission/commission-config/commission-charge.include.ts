import type { Prisma } from '../../../generated/prisma/client';

export const COMMISSION_CHARGE_INCLUDE = {
  percentagePerTransaction: true,
  amountPerTransaction: true,
  percentagePerUnit: true,
  amountPerUnit: true,
} as const;

export type CommissionChargeWithDetailPayload =
  Prisma.CommissionChargeGetPayload<{
    include: typeof COMMISSION_CHARGE_INCLUDE;
  }>;
