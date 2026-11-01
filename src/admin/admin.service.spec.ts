import { AdminService } from './admin.service';

jest.mock('../config/firebase/firebase.service', () => ({
  FirebaseService: class {},
}));
jest.mock('../config/storage/public-storage.service', () => ({
  PublicStorageService: class {},
}));
jest.mock('../photographer/photographer.service', () => ({
  PhotographerService: class {},
}));

describe('AdminService.listOrders', () => {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  let prisma: {
    order: { findMany: jest.Mock; count: jest.Mock };
  };
  let service: AdminService;

  const buildOrder = (overrides: Record<string, unknown> = {}): any => ({
    id: 'order-1',
    eventId: 'event-1',
    email: 'buyer@test.com',
    voucherName: null,
    status: 'PENDING_CONFIRMATION',
    total: '12',
    createdAt: new Date(Date.now() - 4 * MS_PER_DAY),
    event: { title: 'Event' },
    payments: [{ id: 'pay-1' }],
    items: [],
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([buildOrder()]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    service = new AdminService(prisma as any, {} as any, {} as any, {} as any);
  });

  const listOrders = async (isCashAging?: boolean) =>
    await service.listOrders({ pageNumber: 1, pageSize: 20, isCashAging });

  it('flags a cash order unconfirmed for more than 3 days', async () => {
    const result = await listOrders();

    expect(result.items[0].isCashAging).toBe(true);
  });

  it('does not flag a recent cash order', async () => {
    prisma.order.findMany.mockResolvedValue([
      buildOrder({ createdAt: new Date(Date.now() - 1 * MS_PER_DAY) }),
    ]);

    const result = await listOrders();

    expect(result.items[0].isCashAging).toBe(false);
  });

  it('does not flag an old order that has no cash payment', async () => {
    prisma.order.findMany.mockResolvedValue([buildOrder({ payments: [] })]);

    const result = await listOrders();

    expect(result.items[0].isCashAging).toBe(false);
  });

  it('does not flag an old cash order that is no longer pending', async () => {
    prisma.order.findMany.mockResolvedValue([
      buildOrder({ status: 'DELIVERED' }),
    ]);

    const result = await listOrders();

    expect(result.items[0].isCashAging).toBe(false);
  });

  it('filters to pending cash orders older than 3 days when asked', async () => {
    await listOrders(true);

    const { where } = prisma.order.findMany.mock.calls[0][0];
    expect(where.status).toBe('PENDING_CONFIRMATION');
    expect(where.payments).toEqual({ some: { provider: 'CASH' } });
    expect(where.createdAt.lt).toBeInstanceOf(Date);
  });

  it('adds no aging filter by default', async () => {
    await listOrders();

    const { where } = prisma.order.findMany.mock.calls[0][0];
    expect(where).toEqual({});
  });
});
