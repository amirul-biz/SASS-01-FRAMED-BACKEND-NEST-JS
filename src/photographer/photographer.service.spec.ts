import { NotFoundException } from '@nestjs/common';
import { PhotographerService } from './photographer.service';

jest.mock('./photographer.repository', () => ({
  PhotographerRepository: class {},
}));
jest.mock('../config/firebase/firebase.service', () => ({
  FirebaseService: class {},
}));

describe('PhotographerService', () => {
  let repository: {
    getProfileByUserPlatformId: jest.Mock;
    getDashboardStats: jest.Mock;
  };
  let service: PhotographerService;

  const photographer: any = {
    userPlatforms: [{ id: 'platform-1', role: 'PHOTOGRAPHER' }],
  };

  const buildStats = (overrides: Record<string, unknown> = {}): any => ({
    totalEvents: 3,
    liveEvents: 2,
    draftEvents: 1,
    inactiveEvents: 0,
    photoCount: 10,
    storageBytes: 2048,
    storageLimitMb: null,
    ordersByStatus: {
      PENDING_CONFIRMATION: 1,
      PROCESSING: 1,
      DELIVERED: 2,
      CANCELLED: 0,
    },
    photosSold: 5,
    grossRevenue: 100,
    pendingRevenue: 20,
    totalCommission: 12.345,
    topEvents: [],
    ...overrides,
  });

  beforeEach(() => {
    repository = {
      getProfileByUserPlatformId: jest
        .fn()
        .mockResolvedValue({ id: 'photographer-1' }),
      getDashboardStats: jest.fn().mockResolvedValue(buildStats()),
    };
    service = new PhotographerService(
      {} as any,
      repository as any,
      {} as any,
      {} as any,
    );
  });

  describe('PhotographerService.getMyDashboard', () => {
    it('loads stats for the caller own profile only', async () => {
      await service.getMyDashboard(photographer);

      expect(repository.getProfileByUserPlatformId).toHaveBeenCalledWith(
        'platform-1',
      );
      expect(repository.getDashboardStats).toHaveBeenCalledWith(
        'photographer-1',
      );
    });

    it('computes net profit as gross minus commission, rounded to 2 dp', async () => {
      const result = await service.getMyDashboard(photographer);

      expect(result.netProfit).toBe(87.66);
      expect(result.grossRevenue).toBe(100);
    });

    it('returns zeros for an account with no activity', async () => {
      repository.getDashboardStats.mockResolvedValue(
        buildStats({
          totalEvents: 0,
          liveEvents: 0,
          draftEvents: 0,
          photoCount: 0,
          storageBytes: 0,
          photosSold: 0,
          grossRevenue: 0,
          pendingRevenue: 0,
          totalCommission: 0,
        }),
      );

      const result = await service.getMyDashboard(photographer);

      expect(result.netProfit).toBe(0);
      expect(result.storageBytes).toBe(0);
      expect(result.topEvents).toEqual([]);
    });

    it('returns 404 when the caller has no photographer profile', async () => {
      repository.getProfileByUserPlatformId.mockResolvedValue(null);

      await expect(service.getMyDashboard(photographer)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.getDashboardStats).not.toHaveBeenCalled();
    });
  });
});
