import { AmountPerTransactionCommissionCalculator } from './amount-per-transaction.calculator';

describe('AmountPerTransactionCommissionCalculator', () => {
  const calculator = new AmountPerTransactionCommissionCalculator();

  it('takes one fixed amount per order, whatever its size', () => {
    const small = calculator.calculate(2.5, { amountPaid: 5, itemPrices: [5] });
    const large = calculator.calculate(2.5, {
      amountPaid: 500,
      itemPrices: [250, 250],
    });

    expect(small.commissionAmount).toBe(2.5);
    expect(large.commissionAmount).toBe(2.5);
    expect(large).toMatchObject({
      commissionType: 'AMOUNT_PER_TRANSACTION',
      commissionBaseAmount: 500,
    });
  });

  it('builds only its own child row, with the fixed fee, the amount paid and the commission', () => {
    const { chargeDetail } = calculator.calculate(2.5, {
      amountPaid: 30,
      itemPrices: [30],
    });

    expect(chargeDetail).toEqual({
      amountPerTransaction: {
        create: {
          flatAmountApplied: 2.5,
          transactionAmount: 30,
          commissionAmount: 2.5,
        },
      },
    });
  });

  it('reads its value from the per-transaction amount row, and only that one', () => {
    const plan: any = {
      amountCommissionPerTransaction: { amountValue: '2.50' },
      amountCommissionPerUnit: { amountValue: '9' },
    };

    expect(calculator.getPlanValue(plan)).toBe(2.5);
    expect(
      calculator.getPlanValue({ amountCommissionPerTransaction: null } as any),
    ).toBeNull();
  });
});
