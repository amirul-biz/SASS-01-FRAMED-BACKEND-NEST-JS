import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MerchantPaymentPlatformService } from '../../merchant-payment-platform/merchant-payment-platform.service';
import { CashOrderPaymentService } from './cash-order-payment.service';

describe('CashOrderPaymentService.markCashPaymentAsPaid', () => {
  let repository: {
    markPaymentAsPaid: jest.Mock;
  };
  let merchantOrderPaymentRepository: {
    getPaymentForMarkingById: jest.Mock;
  };
  let service: CashOrderPaymentService;

  const ownerPlatformId = 'platform-owner';
  const owner: any = {
    userPlatforms: [{ id: ownerPlatformId, role: 'PHOTOGRAPHER' }],
  };
  const stranger: any = {
    userPlatforms: [{ id: 'platform-stranger', role: 'PHOTOGRAPHER' }],
  };
  const admin: any = {
    userPlatforms: [{ id: 'platform-admin', role: 'ADMIN' }],
  };

  const buildPayment = (overrides: Record<string, unknown> = {}): any => ({
    id: 'pay-1',
    orderId: 'order-1',
    provider: 'CASH',
    status: 'PENDING',
    amount: '12',
    merchantPaymentPlatformOptionId: 'option-1',
    merchantPaymentPlatformOption: {
      userPlatformId: ownerPlatformId,
      isImposeCommission: true,
    },
    order: {
      status: 'PENDING_CONFIRMATION',
      items: [{ price: '20' }, { price: '10' }],
    },
    ...overrides,
  });

  let commissionService: { getCommissionForPayment: jest.Mock };

  beforeEach(() => {
    commissionService = {
      getCommissionForPayment: jest.fn().mockResolvedValue(null),
    };
    merchantOrderPaymentRepository = {
      getPaymentForMarkingById: jest.fn().mockResolvedValue(buildPayment()),
    };
    repository = {
      markPaymentAsPaid: jest.fn().mockResolvedValue({
        payment: {
          id: 'pay-1',
          orderId: 'order-1',
          provider: 'CASH',
          status: 'PAID',
          amount: '12',
        },
        orderStatus: 'DELIVERED',
      }),
    };
    const merchantPaymentPlatformService = new MerchantPaymentPlatformService(
      {} as any,
    );
    service = new CashOrderPaymentService(
      repository as any,
      merchantOrderPaymentRepository as any,
      merchantPaymentPlatformService,
      commissionService as any,
    );
  });

  describe('commission', () => {
    const commission = {
      commissionPlanId: 'plan-1',
      commissionType: 'PERCENTAGE_PER_TRANSACTION',
      totalCommissionAmount: 1.2,
    };

    it('works out the commission from the option, the amount paid and the photo prices', async () => {
      await service.markCashPaymentAsPaid(owner, 'pay-1', {});

      expect(commissionService.getCommissionForPayment).toHaveBeenCalledWith({
        paymentPlatformOptionId: 'option-1',
        isImposeCommission: true,
        order: { amountPaid: 12, itemPrices: [20, 10] },
      });
    });

    it('records the commission together with the payment', async () => {
      commissionService.getCommissionForPayment.mockResolvedValue(commission);

      await service.markCashPaymentAsPaid(owner, 'pay-1', {});

      expect(repository.markPaymentAsPaid).toHaveBeenCalledWith(
        expect.objectContaining({ commission }),
      );
    });

    it('records no commission when none is owed', async () => {
      await service.markCashPaymentAsPaid(owner, 'pay-1', {});

      expect(repository.markPaymentAsPaid).toHaveBeenCalledWith(
        expect.objectContaining({ commission: null }),
      );
    });

    it('does not look up a commission for a request that is rejected', async () => {
      await expect(
        service.markCashPaymentAsPaid(stranger, 'pay-1', {}),
      ).rejects.toThrow(ForbiddenException);

      expect(commissionService.getCommissionForPayment).not.toHaveBeenCalled();
    });
  });

  it('marks the payment as paid, recording the owning photographer and the note', async () => {
    const result = await service.markCashPaymentAsPaid(owner, 'pay-1', {
      notes: 'cash at event',
    });

    expect(repository.markPaymentAsPaid).toHaveBeenCalledWith({
      payment: expect.objectContaining({ id: 'pay-1' }),
      recordedByUserPlatformId: ownerPlatformId,
      commission: null,
      notes: 'cash at event',
    });
    expect(result).toEqual({
      id: 'pay-1',
      orderId: 'order-1',
      provider: 'CASH',
      status: 'PAID',
      amount: 12,
      orderStatus: 'DELIVERED',
    });
  });

  it('lets an admin mark it, recorded against the admin platform', async () => {
    await service.markCashPaymentAsPaid(admin, 'pay-1', {});

    expect(repository.markPaymentAsPaid).toHaveBeenCalledWith(
      expect.objectContaining({ recordedByUserPlatformId: 'platform-admin' }),
    );
  });

  it('returns 404 for an unknown payment', async () => {
    merchantOrderPaymentRepository.getPaymentForMarkingById.mockResolvedValue(
      null,
    );

    await expect(
      service.markCashPaymentAsPaid(owner, 'nope', {}),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns 403, not 404, when the payment belongs to another photographer', async () => {
    await expect(
      service.markCashPaymentAsPaid(stranger, 'pay-1', {}),
    ).rejects.toThrow(ForbiddenException);
    expect(repository.markPaymentAsPaid).not.toHaveBeenCalled();
  });

  it('rejects a non-cash payment', async () => {
    merchantOrderPaymentRepository.getPaymentForMarkingById.mockResolvedValue(
      buildPayment({ provider: 'TOYYIBPAY' }),
    );

    await expect(
      service.markCashPaymentAsPaid(owner, 'pay-1', {}),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns 409 when the payment is already paid', async () => {
    merchantOrderPaymentRepository.getPaymentForMarkingById.mockResolvedValue(
      buildPayment({ status: 'PAID' }),
    );

    await expect(
      service.markCashPaymentAsPaid(owner, 'pay-1', {}),
    ).rejects.toThrow(ConflictException);
    expect(repository.markPaymentAsPaid).not.toHaveBeenCalled();
  });

  it('returns 409 when the order is no longer awaiting confirmation', async () => {
    merchantOrderPaymentRepository.getPaymentForMarkingById.mockResolvedValue(
      buildPayment({ order: { status: 'CANCELLED' } }),
    );

    await expect(
      service.markCashPaymentAsPaid(owner, 'pay-1', {}),
    ).rejects.toThrow(ConflictException);
  });

  it('returns 409 when a concurrent request wins the race', async () => {
    repository.markPaymentAsPaid.mockResolvedValue(null);

    await expect(
      service.markCashPaymentAsPaid(owner, 'pay-1', {}),
    ).rejects.toThrow(ConflictException);
  });
});
