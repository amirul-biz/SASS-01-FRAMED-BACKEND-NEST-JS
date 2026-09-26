import { PercentagePerUnitCommissionCalculator } from './percentage-per-unit.calculator';

describe('PercentagePerUnitCommissionCalculator', () => {
  const calculator = new PercentagePerUnitCommissionCalculator();

  it('takes a percentage of the photo prices, not of the discounted amount paid', () => {
    // three RM20 photos with a RM30 voucher discount: RM30 paid, RM60 of photos
    const result = calculator.calculate(10, {
      amountPaid: 30,
      itemPrices: [20, 20, 20],
    });

    expect(result).toEqual({
      commissionType: 'PERCENTAGE_PER_UNIT',
      commissionBaseAmount: 60,
      commissionAmount: 6,
      chargeDetail: {
        percentagePerUnit: {
          create: {
            unitCount: 3,
            totalUnitCost: 60,
            averageCostPerUnit: 20,
            percentageRateApplied: 10,
            averageCommissionPerUnit: 2,
            commissionAmount: 6,
          },
        },
      },
    });
  });

  it('averages uneven photo prices and the commission earned per photo', () => {
    const { chargeDetail } = calculator.calculate(10, {
      amountPaid: 40,
      itemPrices: [10, 30],
    });

    expect(chargeDetail.percentagePerUnit).toEqual({
      create: {
        unitCount: 2,
        totalUnitCost: 40,
        averageCostPerUnit: 20,
        percentageRateApplied: 10,
        averageCommissionPerUnit: 2,
        commissionAmount: 4,
      },
    });
  });

  it('owes nothing, and divides by nothing, when there are no photos', () => {
    const result = calculator.calculate(10, { amountPaid: 0, itemPrices: [] });

    expect(result.commissionAmount).toBe(0);
    expect(result.chargeDetail.percentagePerUnit).toEqual({
      create: expect.objectContaining({
        unitCount: 0,
        averageCostPerUnit: 0,
        averageCommissionPerUnit: 0,
      }),
    });
  });

  it('reads its value from the per-unit percentage row, and only that one', () => {
    const plan: any = {
      percentageCommissionPerUnit: { percentageValue: '4.00' },
      percentageCommissionPerTransaction: { percentageValue: '9' },
    };

    expect(calculator.getPlanValue(plan)).toBe(4);
    expect(
      calculator.getPlanValue({ percentageCommissionPerUnit: null } as any),
    ).toBeNull();
  });
});
