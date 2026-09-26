import { AmountPerUnitCommissionCalculator } from './amount-per-unit.calculator';

describe('AmountPerUnitCommissionCalculator', () => {
  const calculator = new AmountPerUnitCommissionCalculator();

  it('takes a fixed amount for every photo sold', () => {
    const result = calculator.calculate(1.5, {
      amountPaid: 30,
      itemPrices: [20, 20, 20],
    });

    expect(result).toEqual({
      commissionType: 'AMOUNT_PER_UNIT',
      commissionBaseAmount: 60,
      commissionAmount: 4.5,
      chargeDetail: {
        amountPerUnit: {
          create: {
            unitCount: 3,
            totalUnitCost: 60,
            averageCostPerUnit: 20,
            commissionPerUnitApplied: 1.5,
            commissionAmount: 4.5,
          },
        },
      },
    });
  });

  it('scales with the number of photos', () => {
    const one = calculator.calculate(2, { amountPaid: 20, itemPrices: [20] });
    const five = calculator.calculate(2, {
      amountPaid: 100,
      itemPrices: [20, 20, 20, 20, 20],
    });

    expect(one.commissionAmount).toBe(2);
    expect(five.commissionAmount).toBe(10);
  });

  it('reads its value from the per-unit amount row, and only that one', () => {
    const plan: any = {
      amountCommissionPerUnit: { amountValue: '1.50' },
      amountCommissionPerTransaction: { amountValue: '9' },
    };

    expect(calculator.getPlanValue(plan)).toBe(1.5);
    expect(
      calculator.getPlanValue({ amountCommissionPerUnit: null } as any),
    ).toBeNull();
  });
});
