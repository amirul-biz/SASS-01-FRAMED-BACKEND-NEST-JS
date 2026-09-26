import { Injectable } from '@nestjs/common';
import { CommissionType } from '../../../../generated/prisma/enums';
import {
  getAveragePerUnit,
  roundToCents,
} from '../../../order/order-pricing.util';
import type {
  CommissionBreakdown,
  CommissionCalculator,
  CommissionOrderBasis,
} from '../../commission-config/commission.interface';
import type { CommissionPlanPayload } from '../../commission-config/commission.repository';

@Injectable()
export class AmountPerUnitCommissionCalculator implements CommissionCalculator {
  readonly type = CommissionType.AMOUNT_PER_UNIT;

  getPlanValue(plan: CommissionPlanPayload): number | null {
    const valueRow = plan.amountCommissionPerUnit;
    return valueRow ? Number(valueRow.amountValue) : null;
  }

  calculate(value: number, order: CommissionOrderBasis): CommissionBreakdown {
    const unitCount = order.itemPrices.length;
    const totalUnitCost = roundToCents(
      order.itemPrices.reduce((total, price) => total + price, 0),
    );
    const commissionAmount = roundToCents(value * unitCount);

    return {
      commissionType: this.type,
      commissionBaseAmount: totalUnitCost,
      commissionAmount,
      chargeDetail: {
        amountPerUnit: {
          create: {
            unitCount,
            totalUnitCost,
            averageCostPerUnit: getAveragePerUnit(totalUnitCost, unitCount),
            commissionPerUnitApplied: value,
            commissionAmount,
          },
        },
      },
    };
  }
}
