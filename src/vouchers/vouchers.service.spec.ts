import { ConflictException, NotFoundException } from '@nestjs/common';
import { VouchersService } from './vouchers.service';

describe('VouchersService', () => {
  let repository: {
    findAllForPhotographer: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    countBundlesUsing: jest.Mock;
  };
  let service: VouchersService;

  const voucher = {
    id: 'voucher-1',
    photographerId: 'photographer-1',
    name: 'Group Discount',
    discountType: 'PERCENT_TIER' as const,
    conditions: [
      { minPhotos: 3, maxPhotos: 5, value: 50 },
      { minPhotos: 10, maxPhotos: null, value: 40 },
    ],
    bundlesUsingCount: 0,
  };

  beforeEach(() => {
    repository = {
      findAllForPhotographer: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countBundlesUsing: jest.fn(),
    };
    service = new VouchersService(repository as any);
  });

  describe('list', () => {
    it('maps discountType to wire format', async () => {
      repository.findAllForPhotographer.mockResolvedValue([voucher]);

      const [result] = await service.list('photographer-1');

      expect(result.discountType).toBe('percent-tier');
      expect(result.conditions).toEqual(voucher.conditions);
    });
  });

  describe('create', () => {
    it('maps the wire discountType to the Prisma enum before saving', async () => {
      repository.create.mockResolvedValue({ ...voucher, bundlesUsingCount: 0 });

      await service.create('photographer-1', {
        name: 'Group Discount',
        discountType: 'percent-tier',
        conditions: voucher.conditions,
      });

      expect(repository.create).toHaveBeenCalledWith({
        photographerId: 'photographer-1',
        name: 'Group Discount',
        discountType: 'PERCENT_TIER',
        conditions: voucher.conditions,
      });
    });
  });

  describe('remove', () => {
    it('throws ConflictException when a bundle still uses the voucher', async () => {
      repository.findById.mockResolvedValue({ ...voucher, bundlesUsingCount: 1 });

      await expect(service.remove('photographer-1', 'voucher-1')).rejects.toThrow(
        ConflictException,
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when owned by a different photographer', async () => {
      repository.findById.mockResolvedValue({ ...voucher, photographerId: 'someone-else' });

      await expect(service.remove('photographer-1', 'voucher-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes when owned by the caller and unused', async () => {
      repository.findById.mockResolvedValue({ ...voucher, bundlesUsingCount: 0 });

      await service.remove('photographer-1', 'voucher-1');

      expect(repository.delete).toHaveBeenCalledWith('voucher-1');
    });
  });
});
