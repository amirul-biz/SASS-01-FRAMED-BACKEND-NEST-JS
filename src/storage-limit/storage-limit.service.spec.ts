import { BadRequestException, ConflictException } from '@nestjs/common';
import { StorageLimitService } from './storage-limit.service';
import type { StorageLimitRepository } from './storage-limit.repository';

const MB = 1024 * 1024;

function build(
  overrides: Partial<Record<keyof StorageLimitRepository, jest.Mock>> = {},
) {
  const repository = {
    getLimitMbForPhotographer: jest.fn().mockResolvedValue(null),
    getUsedBytesByPhotographer: jest.fn().mockResolvedValue(new Map()),
    getLimitById: jest.fn().mockResolvedValue({ id: 'l1' }),
    getLimitByName: jest.fn().mockResolvedValue(null),
    countAssigned: jest.fn().mockResolvedValue(0),
    deleteLimit: jest.fn(),
    ...overrides,
  };
  return {
    repository,
    service: new StorageLimitService(
      repository as unknown as StorageLimitRepository,
    ),
  };
}

describe('StorageLimitService', () => {
  describe('getUsage', () => {
    it('returns used bytes and limit, unlimited as null', async () => {
      const { service } = build({
        getUsedBytesByPhotographer: jest
          .fn()
          .mockResolvedValue(new Map([['p1', 3 * MB]])),
      });
      await expect(service.getUsage('p1')).resolves.toEqual({
        usedBytes: 3 * MB,
        limitMb: null,
      });
      await expect(service.getUsage('p2')).resolves.toEqual({
        usedBytes: 0,
        limitMb: null,
      });
    });
  });

  describe('assertWithinLimit', () => {
    it('allows anything when no limit is assigned', async () => {
      const { service } = build();
      await expect(
        service.assertWithinLimit('p1', 10_000 * MB),
      ).resolves.toBeUndefined();
    });

    it('allows uploads that fit exactly and rejects ones that overshoot', async () => {
      const { service } = build({
        getLimitMbForPhotographer: jest.fn().mockResolvedValue(10),
        getUsedBytesByPhotographer: jest
          .fn()
          .mockResolvedValue(new Map([['p1', 6 * MB]])),
      });
      await expect(
        service.assertWithinLimit('p1', 4 * MB),
      ).resolves.toBeUndefined();
      await expect(service.assertWithinLimit('p1', 4 * MB + 1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deleteLimit', () => {
    it('refuses to delete a limit that is still assigned', async () => {
      const { service, repository } = build({
        countAssigned: jest.fn().mockResolvedValue(2),
      });
      await expect(service.deleteLimit('l1')).rejects.toThrow(
        ConflictException,
      );
      expect(repository.deleteLimit).not.toHaveBeenCalled();
    });
  });

  describe('createLimit', () => {
    it('rejects a duplicate name', async () => {
      const { service } = build({
        getLimitByName: jest.fn().mockResolvedValue({ id: 'other' }),
      });
      await expect(
        service.createLimit({ name: 'Starter', limitMb: 1024 }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
