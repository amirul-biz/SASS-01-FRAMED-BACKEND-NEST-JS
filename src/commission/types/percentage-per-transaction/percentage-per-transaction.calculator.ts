import { Injectable } from '@nestjs/common';
import { CommissionType } from '../../../../generated/prisma/enums';
import { roundToCents } from '../../../order/order-pricing.util';
import type {
  CommissionBreakdown,
  CommissionCalculator,
  CommissionOrderBasis,
} from '../../commission-config/commission.interface';
import type { CommissionPlanPayload } from '../../commission-config/commission.repository';

@Injectable()
export class PercentagePerTransactionCommissionCalculator implements CommissionCalculator {
  readonly type = CommissionType.PERCENTAGE_PER_TRANSACTION;

  getPlanValue(plan: CommissionPlanPayload): number | null {
    const valueRow = plan.percentageCommissionPerTransaction;
    return valueRow ? Number(valueRow.percentageValue) : null;
  }

  calculate(value: number, order: CommissionOrderBasis): CommissionBreakdown {
    const commissionAmount = roundToCents((order.amountPaid * value) / 100);

    return {
      commissionType: this.type,
      commissionBaseAmount: order.amountPaid,
      commissionAmount,
      chargeDetail: {
        percentagePerTransaction: {
          create: {
            percentageRateApplied: value,
            transactionAmount: order.amountPaid,
            commissionAmount,
          },
        },
      },
    };
  }
}
