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
export class PercentagePerUnitCommissionCalculator implements CommissionCalculator {
  readonly type = CommissionType.PERCENTAGE_PER_UNIT;

  getPlanValue(plan: CommissionPlanPayload): number | null {
    const valueRow = plan.percentageCommissionPerUnit;
    return valueRow ? Number(valueRow.percentageValue) : null;
  }

  calculate(value: number, order: CommissionOrderBasis): CommissionBreakdown {
    const unitCount = order.itemPrices.length;
    const totalUnitCost = roundToCents(
      order.itemPrices.reduce((total, price) => total + price, 0),
    );
    const commissionAmount = roundToCents((totalUnitCost * value) / 100);

    return {
      commissionType: this.type,
      commissionBaseAmount: totalUnitCost,
      commissionAmount,
      chargeDetail: {
        percentagePerUnit: {
          create: {
            unitCount,
            totalUnitCost,
            averageCostPerUnit: getAveragePerUnit(totalUnitCost, unitCount),
            percentageRateApplied: value,
            averageCommissionPerUnit: getAveragePerUnit(
              commissionAmount,
              unitCount,
            ),
            commissionAmount,
          },
        },
      },
    };
  }
}
