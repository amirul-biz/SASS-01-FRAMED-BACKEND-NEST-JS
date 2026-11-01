import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, UserRole } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../types/express';
import { encryptSecret } from '../common/utils/crypto.util';
import { MerchantPaymentPlatformService } from './merchant-payment-platform.service';
import { ToyyibPayCredentialError } from './toyyibpay-payment-platform/toyyibpay-payment-config/toyyibpay-api.client';

describe('MerchantPaymentPlatformService — approval queue', () => {
  let repository: {
    getOptionsForApproval: jest.Mock;
    getOptionForApprovalById: jest.Mock;
    updateApprovalStatus: jest.Mock;
    getToyyibPayCredentialsByOptionId: jest.Mock;
  };
  let toyyibPayApiClient: { getCategoryDetails: jest.Mock };
  let service: MerchantPaymentPlatformService;
  const originalKey = process.env.PAYMENT_ACCOUNT_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.PAYMENT_ACCOUNT_ENCRYPTION_KEY = 'a'.repeat(64);
  });

  afterAll(() => {
    process.env.PAYMENT_ACCOUNT_ENCRYPTION_KEY = originalKey;
  });

  const optionPayload = {
    id: 'option-1',
    provider: 'TOYYIBPAY',
    approvalStatus: ApprovalStatus.PENDING,
    isDefaultPaymentPlatform: false,
    isImposeCommission: false,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    approvalStatusUpdatedAt: null,
    approvalStatusUpdatedByUserPlatform: null,
    userPlatform: {
      user: { email: 'photographer@example.com' },
      photographerProfile: { name: 'Jane Doe' },
    },
    toyyibPayPaymentPlatformOption: {
      categoryCode: 'EVENT-TICKET',
      verifiedAt: null,
    },
  } as any;

  const adminUser = {
    id: 'user-1',
    email: 'admin@example.com',
    userPlatforms: [{ id: 'admin-platform-1', role: UserRole.ADMIN }],
  } as unknown as AuthenticatedUser;

  beforeEach(() => {
    repository = {
      getOptionsForApproval: jest.fn(),
      getOptionForApprovalById: jest.fn(),
      updateApprovalStatus: jest.fn(),
      getToyyibPayCredentialsByOptionId: jest.fn().mockResolvedValue({
        categoryCode: 'EVENT-TICKET',
        secretKey: encryptSecret('plain-secret'),
      }),
    };
    toyyibPayApiClient = {
      getCategoryDetails: jest.fn().mockResolvedValue({}),
    };
    service = new MerchantPaymentPlatformService(
      repository as any,
      toyyibPayApiClient as any,
    );
  });

  describe('getOptionsForApproval', () => {
    it('passes pagination and filters to the repository', async () => {
      repository.getOptionsForApproval.mockResolvedValue({
        items: [],
        totalItemCount: 0,
      });

      await service.getOptionsForApproval({
        status: ApprovalStatus.PENDING,
        provider: 'TOYYIBPAY' as any,
        pageNumber: 3,
        pageSize: 20,
      });

      expect(repository.getOptionsForApproval).toHaveBeenCalledWith({
        status: ApprovalStatus.PENDING,
        provider: 'TOYYIBPAY',
        skip: 40,
        take: 20,
      });
    });

    it('maps photographer identity, category and reviewer name into the response', async () => {
      repository.getOptionsForApproval.mockResolvedValue({
        items: [optionPayload],
        totalItemCount: 1,
      });

      const response = await service.getOptionsForApproval({
        pageNumber: 1,
        pageSize: 20,
      });

      expect(response.totalItemCount).toBe(1);
      expect(response.items[0]).toMatchObject({
        id: 'option-1',
        provider: 'TOYYIBPAY',
        approvalStatus: ApprovalStatus.PENDING,
        photographerName: 'Jane Doe',
        photographerEmail: 'photographer@example.com',
        categoryCode: 'EVENT-TICKET',
        reviewedByName: null,
      });
    });

    it('maps the reviewing admin name when the option has been reviewed', async () => {
      repository.getOptionsForApproval.mockResolvedValue({
        items: [
          {
            ...optionPayload,
            approvalStatus: ApprovalStatus.APPROVED,
            approvalStatusUpdatedAt: new Date('2026-10-02T00:00:00Z'),
            approvalStatusUpdatedByUserPlatform: {
              adminProfile: { name: 'Platform Admin' },
            },
          },
        ],
        totalItemCount: 1,
      });

      const response = await service.getOptionsForApproval({
        pageNumber: 1,
        pageSize: 20,
      });

      expect(response.items[0].reviewedByName).toBe('Platform Admin');
      expect(response.items[0].approvalStatusUpdatedAt).toBeDefined();
    });
  });

  describe('setApprovalStatus', () => {
    it('throws NotFound when the option does not exist', async () => {
      repository.getOptionForApprovalById.mockResolvedValue(null);

      await expect(
        service.setApprovalStatus(
          adminUser,
          'missing',
          ApprovalStatus.APPROVED,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws Conflict when the option is already in the requested status', async () => {
      repository.getOptionForApprovalById.mockResolvedValue({
        ...optionPayload,
        approvalStatus: ApprovalStatus.APPROVED,
      });

      await expect(
        service.setApprovalStatus(
          adminUser,
          'option-1',
          ApprovalStatus.APPROVED,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('records the approving admin platform id and the time', async () => {
      repository.getOptionForApprovalById.mockResolvedValue(optionPayload);
      repository.updateApprovalStatus.mockResolvedValue({
        ...optionPayload,
        approvalStatus: ApprovalStatus.APPROVED,
        approvalStatusUpdatedAt: new Date('2026-10-02T00:00:00Z'),
        approvalStatusUpdatedByUserPlatform: {
          adminProfile: { name: 'Platform Admin' },
        },
      });

      const result = await service.setApprovalStatus(
        adminUser,
        'option-1',
        ApprovalStatus.APPROVED,
      );

      expect(repository.updateApprovalStatus).toHaveBeenCalledWith(
        'option-1',
        ApprovalStatus.APPROVED,
        'admin-platform-1',
        expect.any(Date),
      );
      expect(result.approvalStatus).toBe(ApprovalStatus.APPROVED);
      expect(result.reviewedByName).toBe('Platform Admin');
    });

    it('re-checks the stored ToyyibPay credentials when approving', async () => {
      repository.getOptionForApprovalById.mockResolvedValue(optionPayload);
      repository.updateApprovalStatus.mockResolvedValue(optionPayload);

      await service.setApprovalStatus(
        adminUser,
        'option-1',
        ApprovalStatus.APPROVED,
      );

      expect(toyyibPayApiClient.getCategoryDetails).toHaveBeenCalledWith(
        'plain-secret',
        'EVENT-TICKET',
      );
    });

    it('does not approve when the re-check fails', async () => {
      repository.getOptionForApprovalById.mockResolvedValue(optionPayload);
      toyyibPayApiClient.getCategoryDetails.mockRejectedValue(
        new ToyyibPayCredentialError('bad key'),
      );

      await expect(
        service.setApprovalStatus(
          adminUser,
          'option-1',
          ApprovalStatus.APPROVED,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repository.updateApprovalStatus).not.toHaveBeenCalled();
    });

    it('does not call ToyyibPay when rejecting', async () => {
      repository.getOptionForApprovalById.mockResolvedValue(optionPayload);
      repository.updateApprovalStatus.mockResolvedValue(optionPayload);

      await service.setApprovalStatus(
        adminUser,
        'option-1',
        ApprovalStatus.REJECTED,
      );

      expect(toyyibPayApiClient.getCategoryDetails).not.toHaveBeenCalled();
      expect(repository.updateApprovalStatus).toHaveBeenCalledWith(
        'option-1',
        ApprovalStatus.REJECTED,
        'admin-platform-1',
        undefined,
      );
    });

    it('skips the re-check for a cash option', async () => {
      repository.getOptionForApprovalById.mockResolvedValue({
        ...optionPayload,
        provider: 'CASH',
        toyyibPayPaymentPlatformOption: null,
      });
      repository.updateApprovalStatus.mockResolvedValue(optionPayload);

      await service.setApprovalStatus(
        adminUser,
        'option-1',
        ApprovalStatus.APPROVED,
      );

      expect(toyyibPayApiClient.getCategoryDetails).not.toHaveBeenCalled();
    });

    it('rejects reviewers without an admin platform', async () => {
      const photographerUser = {
        id: 'user-2',
        email: 'photographer@example.com',
        userPlatforms: [
          { id: 'photographer-platform-1', role: UserRole.PHOTOGRAPHER },
        ],
      } as unknown as AuthenticatedUser;

      await expect(
        service.setApprovalStatus(
          photographerUser,
          'option-1',
          ApprovalStatus.APPROVED,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.updateApprovalStatus).not.toHaveBeenCalled();
    });
  });
});
