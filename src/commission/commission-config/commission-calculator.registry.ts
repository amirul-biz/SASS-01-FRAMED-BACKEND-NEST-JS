import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { CommissionType } from '../../../generated/prisma/enums';
import type { CommissionCalculator } from './commission.interface';
import { AmountPerTransactionCommissionCalculator } from '../types/amount-per-transaction/amount-per-transaction.calculator';
import { AmountPerUnitCommissionCalculator } from '../types/amount-per-unit/amount-per-unit.calculator';
import { PercentagePerTransactionCommissionCalculator } from '../types/percentage-per-transaction/percentage-per-transaction.calculator';
import { PercentagePerUnitCommissionCalculator } from '../types/percentage-per-unit/percentage-per-unit.calculator';

@Injectable()
export class CommissionCalculatorRegistry {
  private readonly calculatorByType: Map<CommissionType, CommissionCalculator>;

  constructor(
    percentagePerTransaction: PercentagePerTransactionCommissionCalculator,
    amountPerTransaction: AmountPerTransactionCommissionCalculator,
    percentagePerUnit: PercentagePerUnitCommissionCalculator,
    amountPerUnit: AmountPerUnitCommissionCalculator,
  ) {
    const calculators: CommissionCalculator[] = [
      percentagePerTransaction,
      amountPerTransaction,
      percentagePerUnit,
      amountPerUnit,
    ];
    this.calculatorByType = new Map(
      calculators.map((calculator) => [calculator.type, calculator]),
    );
  }

  getCalculator(type: CommissionType): CommissionCalculator {
    const calculator = this.calculatorByType.get(type);
    if (!calculator) {
      throw new InternalServerErrorException(
        `No commission calculator for type ${type}`,
      );
    }
    return calculator;
  }
}
