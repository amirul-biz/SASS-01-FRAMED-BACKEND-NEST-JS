import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CommissionAdminService } from './commission-admin.service';

describe('CommissionAdminService', () => {
  let repository: {
    getPlans: jest.Mock;
    createPlan: jest.Mock;
    getPlanById: jest.Mock;
    updatePlan: jest.Mock;
    getOptionForAssignment: jest.Mock;
    getPlanForAssignment: jest.Mock;
    isToyyibPaySystemAccountExisting: jest.Mock;
    assignPlan: jest.Mock;
    getAssignmentRowByOptionId: jest.Mock;
    getAssignmentByOptionId: jest.Mock;
    deleteAssignment: jest.Mock;
    countChargesForPlan: jest.Mock;
    deletePlan: jest.Mock;
  };
  let registry: { getCalculator: jest.Mock };
  let service: CommissionAdminService;

  const buildPlan = (overrides: Record<string, unknown> = {}): any => ({
    id: 'plan-1',
    name: 'Plan',
    type: 'PERCENTAGE_PER_TRANSACTION',
    provider: null,
    isDefault: false,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    _count: { assignments: 0 },
    ...overrides,
  });
  const buildOption = (overrides: Record<string, unknown> = {}): any => ({
    id: 'option-1',
    provider: 'TOYYIBPAY',
    toyyibPayPaymentPlatformOption: { id: 'toyyib-1' },
    ...overrides,
  });
  const assignmentRow: any = {
    id: 'option-1',
    provider: 'TOYYIBPAY',
    approvalStatus: 'APPROVED',
    userPlatform: {
      photographerProfile: { name: 'P' },
      user: { email: 'p@example.com' },
    },
    commissionAssignment: null,
  };

  beforeEach(() => {
    repository = {
      getPlans: jest.fn().mockResolvedValue([]),
      createPlan: jest.fn().mockResolvedValue(buildPlan()),
      getPlanById: jest.fn().mockResolvedValue(buildPlan()),
      updatePlan: jest.fn().mockResolvedValue(buildPlan()),
      getOptionForAssignment: jest.fn().mockResolvedValue(buildOption()),
      getPlanForAssignment: jest.fn().mockResolvedValue(buildPlan()),
      isToyyibPaySystemAccountExisting: jest.fn().mockResolvedValue(true),
      assignPlan: jest.fn().mockResolvedValue(undefined),
      getAssignmentRowByOptionId: jest.fn().mockResolvedValue(assignmentRow),
      getAssignmentByOptionId: jest.fn().mockResolvedValue({
        toyyibPayMerchantOption: null,
      }),
      deleteAssignment: jest.fn().mockResolvedValue(undefined),
      countChargesForPlan: jest.fn().mockResolvedValue(0),
      deletePlan: jest.fn().mockResolvedValue(undefined),
    };
    registry = {
      getCalculator: jest
        .fn()
        .mockReturnValue({ getPlanValue: jest.fn().mockReturnValue(5) }),
    };
    service = new CommissionAdminService(repository as any, registry as any);
  });

  describe('CommissionAdminService.createPlan', () => {
    it('rejects a percentage above 100', async () => {
      await expect(
        service.createPlan({
          name: 'x',
          type: 'PERCENTAGE_PER_TRANSACTION',
          value: 101,
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(repository.createPlan).not.toHaveBeenCalled();
    });

    it('allows a fixed amount above 100', async () => {
      await service.createPlan({
        name: 'x',
        type: 'FIXED_AMOUNT_PER_TRANSACTION',
        value: 500,
        provider: 'CASH',
      } as any);

      expect(repository.createPlan).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'CASH', isDefault: false }),
      );
    });
  });

  describe('CommissionAdminService.updatePlan', () => {
    it('returns 404 for an unknown plan', async () => {
      repository.getPlanById.mockResolvedValue(null);

      await expect(service.updatePlan('nope', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects deactivating the default plan', async () => {
      repository.getPlanById.mockResolvedValue(buildPlan({ isDefault: true }));

      await expect(
        service.updatePlan('plan-1', { isActive: false }),
      ).rejects.toThrow(ConflictException);
      expect(repository.updatePlan).not.toHaveBeenCalled();
    });

    it('rejects unsetting the default plan directly', async () => {
      repository.getPlanById.mockResolvedValue(buildPlan({ isDefault: true }));

      await expect(
        service.updatePlan('plan-1', { isDefault: false }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects making an inactive plan the default', async () => {
      repository.getPlanById.mockResolvedValue(buildPlan({ isActive: false }));

      await expect(
        service.updatePlan('plan-1', { isDefault: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('passes the plan scope so the repository can switch the default within it', async () => {
      repository.getPlanById.mockResolvedValue(buildPlan({ provider: 'CASH' }));

      await service.updatePlan('plan-1', { isDefault: true });

      expect(repository.updatePlan).toHaveBeenCalledWith(
        {
          id: 'plan-1',
          type: 'PERCENTAGE_PER_TRANSACTION',
          provider: 'CASH',
        },
        { isDefault: true },
      );
    });

    it('rejects a percentage above 100 using the stored type', async () => {
      await expect(
        service.updatePlan('plan-1', { value: 150 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('CommissionAdminService.assignPlan', () => {
    it('returns 404 for an unknown option', async () => {
      repository.getOptionForAssignment.mockResolvedValue(null);

      await expect(
        service.assignPlan('nope', { commissionPlanId: 'plan-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an inactive plan', async () => {
      repository.getPlanForAssignment.mockResolvedValue(
        buildPlan({ isActive: false }),
      );

      await expect(
        service.assignPlan('option-1', { commissionPlanId: 'plan-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a plan for another provider', async () => {
      repository.getPlanForAssignment.mockResolvedValue(
        buildPlan({ provider: 'CASH' }),
      );

      await expect(
        service.assignPlan('option-1', { commissionPlanId: 'plan-1' }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.assignPlan).not.toHaveBeenCalled();
    });

    it('rejects a ToyyibPay assignment that names no system account', async () => {
      await expect(
        service.assignPlan('option-1', { commissionPlanId: 'plan-1' }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.assignPlan).not.toHaveBeenCalled();
    });

    it('turns split off for a cash option', async () => {
      repository.getOptionForAssignment.mockResolvedValue(
        buildOption({ provider: 'CASH', toyyibPayPaymentPlatformOption: null }),
      );
      repository.getPlanForAssignment.mockResolvedValue(buildPlan({ provider: 'CASH' }));

      await service.assignPlan('option-1', { commissionPlanId: 'plan-1' });

      expect(repository.assignPlan).toHaveBeenCalledWith({
        paymentPlatformOptionId: 'option-1',
        commissionPlanId: 'plan-1',
        split: null,
      });
    });

    it('turns split on for a ToyyibPay option', async () => {
      await service.assignPlan('option-1', {
        commissionPlanId: 'plan-1',
        splitSystemAccountId: 'acc-1',
      });

      expect(repository.assignPlan).toHaveBeenCalledWith({
        paymentPlatformOptionId: 'option-1',
        commissionPlanId: 'plan-1',
        split: {
          toyyibPayPaymentPlatformOptionId: 'toyyib-1',
          systemToyyibPayPlatformAccountId: 'acc-1',
        },
      });
    });

    it('rejects split on a CASH option', async () => {
      repository.getOptionForAssignment.mockResolvedValue(
        buildOption({
          provider: 'CASH',
          toyyibPayPaymentPlatformOption: null,
        }),
      );

      await expect(
        service.assignPlan('option-1', {
          commissionPlanId: 'plan-1',
          splitSystemAccountId: 'acc-1',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.assignPlan).not.toHaveBeenCalled();
    });

    it('returns 404 when the split system account does not exist', async () => {
      repository.isToyyibPaySystemAccountExisting.mockResolvedValue(false);

      await expect(
        service.assignPlan('option-1', {
          commissionPlanId: 'plan-1',
          splitSystemAccountId: 'nope',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('CommissionAdminService.removeAssignment', () => {
    it('returns 404 when there is no assignment', async () => {
      repository.getAssignmentByOptionId.mockResolvedValue(null);

      await expect(service.removeAssignment('option-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('is blocked while split payment is on', async () => {
      repository.getAssignmentByOptionId.mockResolvedValue({
        toyyibPayMerchantOption: { id: 'link-1' },
      });

      await expect(service.removeAssignment('option-1')).rejects.toThrow(
        ConflictException,
      );
      expect(repository.deleteAssignment).not.toHaveBeenCalled();
    });

    it('deletes when no split exists', async () => {
      await expect(service.removeAssignment('option-1')).resolves.toEqual({
        success: true,
      });
      expect(repository.deleteAssignment).toHaveBeenCalledWith('option-1');
    });
  });

  describe('CommissionAdminService.deletePlan', () => {
    it('blocks deleting the default plan', async () => {
      repository.getPlanById.mockResolvedValue(buildPlan({ isDefault: true }));

      await expect(service.deletePlan('plan-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('blocks deleting a plan that is assigned', async () => {
      repository.getPlanById.mockResolvedValue(
        buildPlan({ _count: { assignments: 2 } }),
      );

      await expect(service.deletePlan('plan-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('blocks deleting a plan that has charges', async () => {
      repository.countChargesForPlan.mockResolvedValue(3);

      await expect(service.deletePlan('plan-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('deletes an unused non-default plan', async () => {
      await expect(service.deletePlan('plan-1')).resolves.toEqual({
        success: true,
      });
    });
  });

  describe('CommissionAdminService.getCommissionReport', () => {
    const buildPayment = (overrides: Record<string, unknown> = {}): any => ({
      id: 'pay-1',
      orderId: 'order-1',
      amount: 100,
      createdAt: new Date('2026-10-01'),
      order: {
        items: [{ price: 60 }, { price: 40 }],
        event: {
          title: 'Event',
          photographerProfile: { id: 'photo-1', name: 'Photographer' },
        },
      },
      commissionCharge: {
        commissionType: 'PERCENTAGE_PER_TRANSACTION',
        originalPaymentAmount: 100,
        commissionBaseAmount: 100,
        commissionAmount: 10,
        commissionPlan: { name: 'Plan' },
        percentagePerTransaction: { percentageRateApplied: 10 },
      },
      ...overrides,
    });
    const query: any = { provider: 'CASH' };

    beforeEach(() => {
      (repository as any).getPaidPaymentsForReport = jest
        .fn()
        .mockResolvedValue([buildPayment()]);
      (repository as any).getPaidTotalsForReport = jest
        .fn()
        .mockResolvedValue({ grossPaid: 100, commission: 10 });
      registry.getCalculator.mockReturnValue({
        calculate: (rate: number, order: { amountPaid: number }) => ({
          commissionAmount: (order.amountPaid * rate) / 100,
        }),
      });
    });

    it('reconciles a charge that matches its recomputed value', async () => {
      const report = await service.getCommissionReport(query);

      expect(report.rows).toHaveLength(1);
      expect(report.rows[0]).toMatchObject({
        orderCount: 1,
        grossPaid: 100,
        commission: 10,
        delta: 0,
        isReconciled: true,
      });
      expect(report.periodCheck.isReconciled).toBe(true);
    });

    it('flags a tampered charge with its delta', async () => {
      const payment = buildPayment();
      payment.commissionCharge.commissionAmount = 10.01;
      (repository as any).getPaidPaymentsForReport.mockResolvedValue([payment]);
      (repository as any).getPaidTotalsForReport.mockResolvedValue({
        grossPaid: 100,
        commission: 10.01,
      });

      const report = await service.getCommissionReport(query);

      expect(report.rows[0].isReconciled).toBe(false);
      expect(report.rows[0].delta).toBe(0.01);
    });

    it('counts a payment without a charge in gross only', async () => {
      (repository as any).getPaidPaymentsForReport.mockResolvedValue([
        buildPayment({ commissionCharge: null }),
      ]);
      (repository as any).getPaidTotalsForReport.mockResolvedValue({
        grossPaid: 100,
        commission: 0,
      });

      const report = await service.getCommissionReport(query);

      expect(report.rows[0]).toMatchObject({
        grossPaid: 100,
        commission: 0,
        isReconciled: true,
      });
    });

    it('fails the period check when the DB totals differ from the rows', async () => {
      (repository as any).getPaidTotalsForReport.mockResolvedValue({
        grossPaid: 100,
        commission: 12.5,
      });

      const report = await service.getCommissionReport(query);

      expect(report.periodCheck).toMatchObject({
        delta: 2.5,
        isReconciled: false,
      });
    });

    it('lists orders that have more than one PAID payment', async () => {
      (repository as any).getPaidPaymentsForReport.mockResolvedValue([
        buildPayment({ id: 'pay-1' }),
        buildPayment({ id: 'pay-2' }),
      ]);
      (repository as any).getPaidTotalsForReport.mockResolvedValue({
        grossPaid: 200,
        commission: 20,
      });

      const report = await service.getCommissionReport(query);

      expect(report.duplicatePaidOrderIds).toEqual(['order-1']);
    });

    it('treats a bare "to" date as the end of that day', async () => {
      await service.getCommissionReport({ ...query, to: '2026-10-31' });

      expect(
        (repository as any).getPaidPaymentsForReport.mock.calls[0][0].to,
      ).toEqual(new Date('2026-10-31T23:59:59.999Z'));
    });
  });
});
