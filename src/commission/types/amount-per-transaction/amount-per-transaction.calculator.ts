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
export class AmountPerTransactionCommissionCalculator implements CommissionCalculator {
  readonly type = CommissionType.AMOUNT_PER_TRANSACTION;

  getPlanValue(plan: CommissionPlanPayload): number | null {
    const valueRow = plan.amountCommissionPerTransaction;
    return valueRow ? Number(valueRow.amountValue) : null;
  }

  calculate(value: number, order: CommissionOrderBasis): CommissionBreakdown {
    const commissionAmount = roundToCents(value);

    return {
      commissionType: this.type,
      commissionBaseAmount: order.amountPaid,
      commissionAmount,
      chargeDetail: {
        amountPerTransaction: {
          create: {
            flatAmountApplied: value,
            transactionAmount: order.amountPaid,
            commissionAmount,
          },
        },
      },
    };
  }
}
