import { PercentagePerTransactionCommissionCalculator } from './percentage-per-transaction.calculator';

describe('PercentagePerTransactionCommissionCalculator', () => {
  const calculator = new PercentagePerTransactionCommissionCalculator();

  it('takes a percentage of the amount paid, once per order', () => {
    const result = calculator.calculate(10, {
      amountPaid: 30,
      itemPrices: [20, 20, 20],
    });

    expect(result).toEqual({
      commissionType: 'PERCENTAGE_PER_TRANSACTION',
      commissionBaseAmount: 30,
      commissionAmount: 3,
      chargeDetail: {
        percentagePerTransaction: {
          create: {
            percentageRateApplied: 10,
            transactionAmount: 30,
            commissionAmount: 3,
          },
        },
      },
    });
  });

  it('builds only its own child row', () => {
    const { chargeDetail } = calculator.calculate(7.5, {
      amountPaid: 30,
      itemPrices: [30],
    });

    expect(Object.keys(chargeDetail)).toEqual(['percentagePerTransaction']);
  });

  it('rounds to whole cents', () => {
    const result = calculator.calculate(12.5, {
      amountPaid: 10.01,
      itemPrices: [10.01],
    });

    expect(result.commissionAmount).toBe(1.25);
  });

  it('reads its value from the per-transaction percentage row, and only that one', () => {
    const plan: any = {
      percentageCommissionPerTransaction: { percentageValue: '7.50' },
      amountCommissionPerTransaction: { amountValue: '1' },
    };

    expect(calculator.getPlanValue(plan)).toBe(7.5);
    expect(
      calculator.getPlanValue({
        percentageCommissionPerTransaction: null,
      } as any),
    ).toBeNull();
  });
});
