import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MerchantPaymentPlatformService } from './merchant-payment-platform.service';

describe('MerchantPaymentPlatformService', () => {
  let repository: {
    getOptionForApprovalById: jest.Mock;
    updateApprovalStatus: jest.Mock;
  };
  let service: MerchantPaymentPlatformService;
  const originalStatus = process.env.DEFAULT_MERCHANT_PAYMENT_PLATFORM_STATUS;

  const admin: any = {
    userPlatforms: [{ id: 'platform-admin', role: 'ADMIN' }],
  };
  const photographer: any = {
    userPlatforms: [{ id: 'platform-photographer', role: 'PHOTOGRAPHER' }],
  };

  const buildOption = (overrides: Record<string, unknown> = {}): any => ({
    id: 'option-1',
    provider: 'TOYYIBPAY',
    approvalStatus: 'PENDING',
    createdAt: new Date('2026-01-01'),
    approvalStatusUpdatedAt: null,
    userPlatform: {
      photographerProfile: { name: 'Photo Grapher' },
      user: { email: 'p@example.com' },
    },
    toyyibPayPaymentPlatformOption: { categoryCode: 'cat1' },
    approvalStatusUpdatedByUserPlatform: null,
    ...overrides,
  });

  beforeEach(() => {
    repository = {
      getOptionForApprovalById: jest.fn().mockResolvedValue(buildOption()),
      updateApprovalStatus: jest.fn().mockResolvedValue(
        buildOption({
          approvalStatus: 'APPROVED',
          approvalStatusUpdatedAt: new Date('2026-02-01'),
          approvalStatusUpdatedByUserPlatform: {
            adminProfile: { name: 'Admin One' },
          },
        }),
      ),
    };
    service = new MerchantPaymentPlatformService(repository as any, {} as any);
  });

  afterEach(() => {
    if (originalStatus === undefined) {
      delete process.env.DEFAULT_MERCHANT_PAYMENT_PLATFORM_STATUS;
    } else {
      process.env.DEFAULT_MERCHANT_PAYMENT_PLATFORM_STATUS = originalStatus;
    }
  });

  describe('MerchantPaymentPlatformService.getConfiguredApprovalStatus', () => {
    it('falls back to PENDING when the env var is unset', () => {
      delete process.env.DEFAULT_MERCHANT_PAYMENT_PLATFORM_STATUS;

      expect(service.getConfiguredApprovalStatus()).toBe('PENDING');
    });

    it('falls back to PENDING when the env var is invalid', () => {
      process.env.DEFAULT_MERCHANT_PAYMENT_PLATFORM_STATUS = 'nonsense';

      expect(service.getConfiguredApprovalStatus()).toBe('PENDING');
    });

    it('honours a valid env override', () => {
      process.env.DEFAULT_MERCHANT_PAYMENT_PLATFORM_STATUS = 'APPROVED';

      expect(service.getConfiguredApprovalStatus()).toBe('APPROVED');
    });
  });

  describe('MerchantPaymentPlatformService.setApprovalStatus', () => {
    it('records the reviewing admin platform and returns the mapped row', async () => {
      repository.getOptionForApprovalById.mockResolvedValue(
        buildOption({ provider: 'CASH' }),
      );

      const result = await service.setApprovalStatus(
        admin,
        'option-1',
        'APPROVED' as any,
      );

      expect(repository.updateApprovalStatus).toHaveBeenCalledWith(
        'option-1',
        'APPROVED',
        'platform-admin',
        undefined,
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: 'option-1',
          approvalStatus: 'APPROVED',
          categoryCode: 'cat1',
          reviewedByName: 'Admin One',
        }),
      );
      expect(JSON.stringify(result)).not.toContain('secret');
    });

    it('returns 403 for a caller with no admin platform', async () => {
      await expect(
        service.setApprovalStatus(photographer, 'option-1', 'APPROVED' as any),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.updateApprovalStatus).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown option', async () => {
      repository.getOptionForApprovalById.mockResolvedValue(null);

      await expect(
        service.setApprovalStatus(admin, 'nope', 'APPROVED' as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns 409 when the option is already in that status', async () => {
      repository.getOptionForApprovalById.mockResolvedValue(
        buildOption({ approvalStatus: 'REJECTED' }),
      );

      await expect(
        service.setApprovalStatus(admin, 'option-1', 'REJECTED' as any),
      ).rejects.toThrow(ConflictException);
      expect(repository.updateApprovalStatus).not.toHaveBeenCalled();
    });
  });
});
