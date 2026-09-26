import { InternalServerErrorException } from '@nestjs/common';
import { CommissionCalculatorRegistry } from './commission-calculator.registry';
import { AmountPerTransactionCommissionCalculator } from '../types/amount-per-transaction/amount-per-transaction.calculator';
import { AmountPerUnitCommissionCalculator } from '../types/amount-per-unit/amount-per-unit.calculator';
import { PercentagePerTransactionCommissionCalculator } from '../types/percentage-per-transaction/percentage-per-transaction.calculator';
import { PercentagePerUnitCommissionCalculator } from '../types/percentage-per-unit/percentage-per-unit.calculator';

describe('CommissionCalculatorRegistry', () => {
  const registry = new CommissionCalculatorRegistry(
    new PercentagePerTransactionCommissionCalculator(),
    new AmountPerTransactionCommissionCalculator(),
    new PercentagePerUnitCommissionCalculator(),
    new AmountPerUnitCommissionCalculator(),
  );

  it.each([
    [
      'PERCENTAGE_PER_TRANSACTION',
      PercentagePerTransactionCommissionCalculator,
    ],
    ['AMOUNT_PER_TRANSACTION', AmountPerTransactionCommissionCalculator],
    ['PERCENTAGE_PER_UNIT', PercentagePerUnitCommissionCalculator],
    ['AMOUNT_PER_UNIT', AmountPerUnitCommissionCalculator],
  ])('returns the calculator that handles %s', (type, calculatorClass) => {
    expect(registry.getCalculator(type)).toBeInstanceOf(calculatorClass);
  });

  it('fails loudly (500) for a type nobody handles', () => {
    expect(() => registry.getCalculator('SOMETHING_NEW' as any)).toThrow(
      InternalServerErrorException,
    );
  });
});
