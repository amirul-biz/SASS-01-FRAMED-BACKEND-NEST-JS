import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { encryptSecret } from '../common/utils/crypto.util';
import { SystemPaymentPlatformService } from './system-payment-platform.service';

describe('SystemPaymentPlatformService', () => {
  let repository: {
    getSystemPlatforms: jest.Mock;
    isSystemPlatformRegisteredForProvider: jest.Mock;
    createCashSystemPlatform: jest.Mock;
    createToyyibPaySystemPlatform: jest.Mock;
    getToyyibPaySystemPlatformByAccountId: jest.Mock;
    updateToyyibPaySystemPlatform: jest.Mock;
    isToyyibPayUsernameTaken: jest.Mock;
    getSystemPlatformByAccountId: jest.Mock;
    countBillsForToyyibPayAccount: jest.Mock;
    countCommissionSplitsForAccount: jest.Mock;
    deleteSystemPlatform: jest.Mock;
  };
  let merchantPaymentPlatformService: {
    verifyToyyibPayCredentials: jest.Mock;
  };
  let service: SystemPaymentPlatformService;
  const originalKey = process.env.PAYMENT_ACCOUNT_ENCRYPTION_KEY;

  const buildToyyibPayPlatform = (overrides: Record<string, unknown> = {}) => ({
    id: 'sp-1',
    provider: 'TOYYIBPAY',
    isDefault: false,
    createdAt: new Date('2026-01-01'),
    cashSystemAccount: null,
    toyyibPaySystemAccount: {
      id: 'acc-1',
      splitRecipientId: 'platform-user',
      categoryCode: 'cat-1',
      verifiedAt: null,
    },
    ...overrides,
  });

  beforeAll(() => {
    process.env.PAYMENT_ACCOUNT_ENCRYPTION_KEY = 'a'.repeat(64);
  });

  afterAll(() => {
    process.env.PAYMENT_ACCOUNT_ENCRYPTION_KEY = originalKey;
  });

  beforeEach(() => {
    repository = {
      getSystemPlatforms: jest.fn().mockResolvedValue([]),
      isSystemPlatformRegisteredForProvider: jest.fn().mockResolvedValue(false),
      createCashSystemPlatform: jest.fn().mockResolvedValue({
        id: 'sp-cash',
        provider: 'CASH',
        isDefault: true,
        createdAt: new Date('2026-01-01'),
        cashSystemAccount: { id: 'cash-1' },
        toyyibPaySystemAccount: null,
      }),
      createToyyibPaySystemPlatform: jest
        .fn()
        .mockResolvedValue(buildToyyibPayPlatform({ isDefault: true })),
      getToyyibPaySystemPlatformByAccountId: jest
        .fn()
        .mockResolvedValue(buildToyyibPayPlatform({ isDefault: true })),
      updateToyyibPaySystemPlatform: jest
        .fn()
        .mockResolvedValue(buildToyyibPayPlatform()),
      isToyyibPayUsernameTaken: jest.fn().mockResolvedValue(false),
      getSystemPlatformByAccountId: jest
        .fn()
        .mockResolvedValue(buildToyyibPayPlatform()),
      countBillsForToyyibPayAccount: jest.fn().mockResolvedValue(0),
      countCommissionSplitsForAccount: jest.fn().mockResolvedValue(0),
      deleteSystemPlatform: jest.fn().mockResolvedValue(undefined),
    };
    merchantPaymentPlatformService = {
      verifyToyyibPayCredentials: jest.fn().mockResolvedValue(undefined),
    };
    service = new SystemPaymentPlatformService(
      repository as any,
      merchantPaymentPlatformService as any,
    );
  });

  describe('SystemPaymentPlatformService.createCashSystemAccount', () => {
    it('creates the cash account', async () => {
      const result = await service.createCashSystemAccount();

      expect(result).toEqual(
        expect.objectContaining({ provider: 'CASH', accountId: 'cash-1' }),
      );
    });

    it('returns 409 when a cash account already exists', async () => {
      repository.isSystemPlatformRegisteredForProvider.mockResolvedValue(true);

      await expect(service.createCashSystemAccount()).rejects.toThrow(
        ConflictException,
      );
      expect(repository.createCashSystemPlatform).not.toHaveBeenCalled();
    });
  });

  describe('SystemPaymentPlatformService.createToyyibPaySystemAccount', () => {
    it('encrypts the secret and never returns it', async () => {
      const result = await service.createToyyibPaySystemAccount({
        username: 'platform-user',
        secretKey: 'plain-secret',
        categoryCode: 'cat-1',
      });

      const [, account] =
        repository.createToyyibPaySystemPlatform.mock.calls[0];
      expect(account.splitRecipientId).toBe('platform-user');
      expect(account.encryptedSecretKey).not.toContain('plain-secret');
      expect(JSON.stringify(result)).not.toContain('plain-secret');
      expect(result).not.toHaveProperty('secretKey');
    });

    it('makes the first account the default', async () => {
      await service.createToyyibPaySystemAccount({
        username: 'u',
        secretKey: 's',
        categoryCode: 'c',
      });

      expect(repository.createToyyibPaySystemPlatform.mock.calls[0][0]).toBe(
        true,
      );
    });

    it('does not make a later account the default unless asked', async () => {
      repository.isSystemPlatformRegisteredForProvider.mockResolvedValue(true);

      await service.createToyyibPaySystemAccount({
        username: 'u',
        secretKey: 's',
        categoryCode: 'c',
      });

      expect(repository.createToyyibPaySystemPlatform.mock.calls[0][0]).toBe(
        false,
      );
    });

    it('returns 409 for a duplicate username', async () => {
      repository.isToyyibPayUsernameTaken.mockResolvedValue(true);

      await expect(
        service.createToyyibPaySystemAccount({
          username: 'u',
          secretKey: 's',
          categoryCode: 'c',
        }),
      ).rejects.toThrow(ConflictException);
      expect(repository.createToyyibPaySystemPlatform).not.toHaveBeenCalled();
    });
  });

  describe('SystemPaymentPlatformService.createToyyibPaySystemAccount verification', () => {
    it('verifies the key with its category and stamps verifiedAt', async () => {
      await service.createToyyibPaySystemAccount({
        username: 'u',
        secretKey: 'plain-secret',
        categoryCode: 'cat-1',
      });

      expect(
        merchantPaymentPlatformService.verifyToyyibPayCredentials,
      ).toHaveBeenCalledWith('plain-secret', 'cat-1');
      const [, account] =
        repository.createToyyibPaySystemPlatform.mock.calls[0];
      expect(account.categoryCode).toBe('cat-1');
      expect(account.verifiedAt).toBeInstanceOf(Date);
    });

    it('saves nothing when ToyyibPay rejects the key', async () => {
      merchantPaymentPlatformService.verifyToyyibPayCredentials.mockRejectedValue(
        new BadRequestException('bad key'),
      );

      await expect(
        service.createToyyibPaySystemAccount({
          username: 'u',
          secretKey: 'wrong',
          categoryCode: 'c',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.createToyyibPaySystemPlatform).not.toHaveBeenCalled();
    });
  });

  describe('SystemPaymentPlatformService.updateToyyibPaySystemAccount', () => {
    it('returns 404 for an unknown account', async () => {
      repository.getToyyibPaySystemPlatformByAccountId.mockResolvedValue(null);

      await expect(
        service.updateToyyibPaySystemAccount('nope', { username: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns 409 when unsetting the current default', async () => {
      await expect(
        service.updateToyyibPaySystemAccount('acc-1', { isDefault: false }),
      ).rejects.toThrow(ConflictException);
      expect(repository.updateToyyibPaySystemPlatform).not.toHaveBeenCalled();
    });

    it('keeps the stored secret when none is given', async () => {
      await service.updateToyyibPaySystemAccount('acc-1', { isDefault: true });

      expect(repository.updateToyyibPaySystemPlatform).toHaveBeenCalledWith(
        'sp-1',
        true,
        { splitRecipientId: undefined, encryptedSecretKey: undefined },
      );
    });

    it('returns 409 when the new username is taken', async () => {
      repository.isToyyibPayUsernameTaken.mockResolvedValue(true);

      await expect(
        service.updateToyyibPaySystemAccount('acc-1', { username: 'taken' }),
      ).rejects.toThrow(ConflictException);
    });

    it('re-verifies a rotated key against the stored category', async () => {
      await service.updateToyyibPaySystemAccount('acc-1', {
        secretKey: 'new-key',
      });

      expect(
        merchantPaymentPlatformService.verifyToyyibPayCredentials,
      ).toHaveBeenCalledWith('new-key', 'cat-1');
      const fields = repository.updateToyyibPaySystemPlatform.mock.calls[0][2];
      expect(fields.verifiedAt).toBeInstanceOf(Date);
    });

    it('re-verifies the stored key when only the category changes', async () => {
      repository.getToyyibPaySystemPlatformByAccountId.mockResolvedValue(
        buildToyyibPayPlatform({
          toyyibPaySystemAccount: {
            id: 'acc-1',
            splitRecipientId: 'platform-user',
            secretKey: encryptSecret('stored-key'),
            categoryCode: 'cat-1',
            verifiedAt: null,
          },
        }),
      );

      await service.updateToyyibPaySystemAccount('acc-1', {
        categoryCode: 'cat-2',
      });

      expect(
        merchantPaymentPlatformService.verifyToyyibPayCredentials,
      ).toHaveBeenCalledWith('stored-key', 'cat-2');
    });

    it('rejects a key change when there is no category to verify against', async () => {
      repository.getToyyibPaySystemPlatformByAccountId.mockResolvedValue(
        buildToyyibPayPlatform({
          toyyibPaySystemAccount: {
            id: 'acc-1',
            splitRecipientId: 'platform-user',
            categoryCode: null,
            verifiedAt: null,
          },
        }),
      );

      await expect(
        service.updateToyyibPaySystemAccount('acc-1', { secretKey: 'k' }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.updateToyyibPaySystemPlatform).not.toHaveBeenCalled();
    });

    it('does not save when ToyyibPay rejects the new key', async () => {
      merchantPaymentPlatformService.verifyToyyibPayCredentials.mockRejectedValue(
        new BadRequestException('bad key'),
      );

      await expect(
        service.updateToyyibPaySystemAccount('acc-1', { secretKey: 'wrong' }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.updateToyyibPaySystemPlatform).not.toHaveBeenCalled();
    });

    it('does not verify when only the default flag changes', async () => {
      await service.updateToyyibPaySystemAccount('acc-1', { isDefault: true });

      expect(
        merchantPaymentPlatformService.verifyToyyibPayCredentials,
      ).not.toHaveBeenCalled();
    });
  });

  describe('SystemPaymentPlatformService.deleteSystemAccount', () => {
    it('returns 404 for an unknown account', async () => {
      repository.getSystemPlatformByAccountId.mockResolvedValue(null);

      await expect(service.deleteSystemAccount('nope')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes an unused non-default account', async () => {
      await expect(service.deleteSystemAccount('acc-1')).resolves.toEqual({
        success: true,
      });
      expect(repository.deleteSystemPlatform).toHaveBeenCalledWith('sp-1');
    });

    it('blocks deletion when bills exist', async () => {
      repository.countBillsForToyyibPayAccount.mockResolvedValue(2);

      await expect(service.deleteSystemAccount('acc-1')).rejects.toThrow(
        ConflictException,
      );
      expect(repository.deleteSystemPlatform).not.toHaveBeenCalled();
    });

    it('blocks deletion while a commission split points at it', async () => {
      repository.countCommissionSplitsForAccount.mockResolvedValue(1);

      await expect(service.deleteSystemAccount('acc-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('blocks deletion of the default ToyyibPay account', async () => {
      repository.getSystemPlatformByAccountId.mockResolvedValue(
        buildToyyibPayPlatform({ isDefault: true }),
      );

      await expect(service.deleteSystemAccount('acc-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
