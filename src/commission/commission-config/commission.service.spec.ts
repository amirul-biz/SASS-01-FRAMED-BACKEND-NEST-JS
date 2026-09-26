import { InternalServerErrorException } from '@nestjs/common';
import { CommissionCalculatorRegistry } from './commission-calculator.registry';
import { CommissionService } from './commission.service';
import { AmountPerTransactionCommissionCalculator } from '../types/amount-per-transaction/amount-per-transaction.calculator';
import { AmountPerUnitCommissionCalculator } from '../types/amount-per-unit/amount-per-unit.calculator';
import { PercentagePerTransactionCommissionCalculator } from '../types/percentage-per-transaction/percentage-per-transaction.calculator';
import { PercentagePerUnitCommissionCalculator } from '../types/percentage-per-unit/percentage-per-unit.calculator';

describe('CommissionService.getCommissionForPayment', () => {
  let repository: {
    getActivePlanAssignedToOption: jest.Mock;
    getDefaultActivePlan: jest.Mock;
  };
  let service: CommissionService;

  const order = { amountPaid: 30, itemPrices: [20, 20, 20] };
  const params = {
    paymentPlatformOptionId: 'option-1',
    isImposeCommission: true,
    order,
  };
  const emptyPlan = {
    percentageCommissionPerTransaction: null,
    amountCommissionPerTransaction: null,
    percentageCommissionPerUnit: null,
    amountCommissionPerUnit: null,
  };
  const percentagePerTransactionPlan = (
    id: string,
    percentageValue: string,
  ): any => ({
    ...emptyPlan,
    id,
    type: 'PERCENTAGE_PER_TRANSACTION',
    percentageCommissionPerTransaction: { percentageValue },
  });

  beforeEach(() => {
    repository = {
      getActivePlanAssignedToOption: jest.fn().mockResolvedValue(null),
      getDefaultActivePlan: jest.fn().mockResolvedValue(null),
    };
    const registry = new CommissionCalculatorRegistry(
      new PercentagePerTransactionCommissionCalculator(),
      new AmountPerTransactionCommissionCalculator(),
      new PercentagePerUnitCommissionCalculator(),
      new AmountPerUnitCommissionCalculator(),
    );
    service = new CommissionService(repository as any, registry);
  });

  it('owes no commission when the payment option is exempt, without even looking up a plan', async () => {
    const result = await service.getCommissionForPayment({
      ...params,
      isImposeCommission: false,
    });

    expect(result).toBeNull();
    expect(repository.getActivePlanAssignedToOption).not.toHaveBeenCalled();
    expect(repository.getDefaultActivePlan).not.toHaveBeenCalled();
  });

  it('owes no commission when there is neither an assigned nor a default plan', async () => {
    expect(await service.getCommissionForPayment(params)).toBeNull();
  });

  it('uses the plan assigned to the option, ahead of the default plan', async () => {
    repository.getActivePlanAssignedToOption.mockResolvedValue(
      percentagePerTransactionPlan('assigned', '10.00'),
    );
    repository.getDefaultActivePlan.mockResolvedValue(
      percentagePerTransactionPlan('default', '99.00'),
    );

    const result = await service.getCommissionForPayment(params);

    expect(result).toMatchObject({
      commissionPlanId: 'assigned',
      originalPaymentAmount: 30,
      commissionAmount: 3,
    });
    expect(repository.getDefaultActivePlan).not.toHaveBeenCalled();
  });

  it('falls back to the default plan when the option has no active assigned plan', async () => {
    repository.getDefaultActivePlan.mockResolvedValue(
      percentagePerTransactionPlan('default', '5.00'),
    );

    const result = await service.getCommissionForPayment(params);

    expect(result).toMatchObject({
      commissionPlanId: 'default',
      commissionAmount: 1.5,
    });
  });

  it('hands the plan to the calculator for its own type', async () => {
    repository.getActivePlanAssignedToOption.mockResolvedValue({
      ...emptyPlan,
      id: 'unit-plan',
      type: 'AMOUNT_PER_UNIT',
      amountCommissionPerUnit: { amountValue: '1.50' },
    });

    const result = await service.getCommissionForPayment(params);

    expect(result).toMatchObject({
      commissionType: 'AMOUNT_PER_UNIT',
      commissionAmount: 4.5,
      chargeDetail: {
        amountPerUnit: {
          create: expect.objectContaining({
            unitCount: 3,
            commissionPerUnitApplied: 1.5,
            commissionAmount: 4.5,
          }),
        },
      },
    });
  });

  it('owes no commission when the plan works out to zero', async () => {
    repository.getDefaultActivePlan.mockResolvedValue(
      percentagePerTransactionPlan('free', '0.00'),
    );

    expect(await service.getCommissionForPayment(params)).toBeNull();
  });

  it('fails loudly (500) when a plan has no value row for its type', async () => {
    repository.getActivePlanAssignedToOption.mockResolvedValue({
      ...emptyPlan,
      id: 'broken-plan',
      type: 'AMOUNT_PER_UNIT',
    });

    await expect(service.getCommissionForPayment(params)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});

describe('CommissionService.getToyyibPaySplitRecipient', () => {
  it('delegates to the repository and returns its result as-is', async () => {
    const repository = {
      getActivePlanAssignedToOption: jest.fn(),
      getDefaultActivePlan: jest.fn(),
      getToyyibPaySplitRecipientForOption: jest
        .fn()
        .mockResolvedValue('arfankareem'),
    };
    const registry = new CommissionCalculatorRegistry(
      new PercentagePerTransactionCommissionCalculator(),
      new AmountPerTransactionCommissionCalculator(),
      new PercentagePerUnitCommissionCalculator(),
      new AmountPerUnitCommissionCalculator(),
    );
    const service = new CommissionService(repository as any, registry);

    await expect(service.getToyyibPaySplitRecipient('option-1')).resolves.toBe(
      'arfankareem',
    );
    expect(repository.getToyyibPaySplitRecipientForOption).toHaveBeenCalledWith(
      'option-1',
    );
  });

  it('returns null when no split is configured for the option', async () => {
    const repository = {
      getActivePlanAssignedToOption: jest.fn(),
      getDefaultActivePlan: jest.fn(),
      getToyyibPaySplitRecipientForOption: jest.fn().mockResolvedValue(null),
    };
    const registry = new CommissionCalculatorRegistry(
      new PercentagePerTransactionCommissionCalculator(),
      new AmountPerTransactionCommissionCalculator(),
      new PercentagePerUnitCommissionCalculator(),
      new AmountPerUnitCommissionCalculator(),
    );
    const service = new CommissionService(repository as any, registry);

    await expect(
      service.getToyyibPaySplitRecipient('option-1'),
    ).resolves.toBeNull();
  });
});
