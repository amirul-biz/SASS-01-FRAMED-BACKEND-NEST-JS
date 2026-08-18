import { ConflictException, NotFoundException } from '@nestjs/common';
import { PricingBundlesService } from './pricing-bundles.service';

describe('PricingBundlesService', () => {
  let repository: {
    findAllForPhotographer: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    countEventsUsing: jest.Mock;
  };
  let service: PricingBundlesService;

  const voucher = {
    id: 'voucher-1',
    name: 'Group Discount',
    discountType: 'PERCENT_TIER' as const,
    conditions: [{ minPhotos: 5, maxPhotos: null, value: 15 }],
  };

  const bundle = {
    id: 'bundle-1',
    photographerId: 'photographer-1',
    name: 'Standard Bundle',
    basePrice: { toString: () => '15.00' } as any,
    fullGalleryEnabled: false,
    fullGalleryPrice: { toString: () => '0.00' } as any,
    vouchers: [{ voucher }],
    eventsUsingCount: 0,
  };

  beforeEach(() => {
    repository = {
      findAllForPhotographer: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countEventsUsing: jest.fn(),
    };
    service = new PricingBundlesService(repository as any);
  });

  describe('list', () => {
    it('maps attached vouchers to wire format and money fields to numbers', async () => {
      repository.findAllForPhotographer.mockResolvedValue([bundle]);

      const [result] = await service.list('photographer-1');

      expect(result.vouchers).toEqual([
        { id: 'voucher-1', name: 'Group Discount', discountType: 'percent-tier', conditions: voucher.conditions },
      ]);
      expect(result.basePrice).toBe(15);
      expect(result.fullGalleryPrice).toBe(0);
      expect(result.eventsUsingCount).toBe(0);
    });
  });

  describe('create', () => {
    it('passes voucherIds through to the repository', async () => {
      repository.create.mockResolvedValue({ ...bundle, eventsUsingCount: 0 });

      await service.create('photographer-1', {
        name: 'Standard Bundle',
        basePrice: 15,
        voucherIds: ['voucher-1'],
        fullGalleryEnabled: false,
        fullGalleryPrice: 0,
      });

      expect(repository.create).toHaveBeenCalledWith({
        photographerId: 'photographer-1',
        name: 'Standard Bundle',
        basePrice: 15,
        voucherIds: ['voucher-1'],
        fullGalleryEnabled: false,
        fullGalleryPrice: 0,
      });
    });
  });

  describe('update', () => {
    it('throws NotFoundException when owned by a different photographer', async () => {
      repository.findById.mockResolvedValue({ ...bundle, photographerId: 'someone-else' });

      await expect(
        service.update('photographer-1', 'bundle-1', { name: 'Renamed' }),
      ).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws ConflictException when an event still uses the bundle', async () => {
      repository.findById.mockResolvedValue({ ...bundle, eventsUsingCount: 2 });

      await expect(service.remove('photographer-1', 'bundle-1')).rejects.toThrow(
        ConflictException,
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when owned by a different photographer', async () => {
      repository.findById.mockResolvedValue({ ...bundle, photographerId: 'someone-else' });

      await expect(service.remove('photographer-1', 'bundle-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes when owned by the caller and unused', async () => {
      repository.findById.mockResolvedValue({ ...bundle, eventsUsingCount: 0 });

      await service.remove('photographer-1', 'bundle-1');

      expect(repository.delete).toHaveBeenCalledWith('bundle-1');
    });
  });
});
