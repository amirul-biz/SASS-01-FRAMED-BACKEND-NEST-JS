import { OrderHistoryService } from './order-history.service';

describe('OrderHistoryService.getOrderHistoryEntries', () => {
  let repository: { getAuditLogsByOrderId: jest.Mock };
  let service: OrderHistoryService;

  const buildLog = (overrides: Record<string, unknown> = {}): any => ({
    id: 'log-1',
    createdAt: new Date('2026-09-20T10:00:00Z'),
    source: 'MANUAL',
    fromStatus: 'PENDING',
    toStatus: 'PAID',
    fromOrderStatus: 'PENDING_CONFIRMATION',
    toOrderStatus: 'DELIVERED',
    payment: {
      provider: 'CASH',
      bill: {
        cashDetail: {
          notes: 'Received cash at the event',
          recordedByUserPlatform: {
            photographerProfile: { name: 'Amirul' },
            adminProfile: null,
          },
        },
      },
    },
    ...overrides,
  });

  beforeEach(() => {
    repository = { getAuditLogsByOrderId: jest.fn() };
    service = new OrderHistoryService(repository as any);
  });

  it('maps a manual "marked as paid" entry with the note and who recorded it', async () => {
    repository.getAuditLogsByOrderId.mockResolvedValue([buildLog()]);

    const [entry] = await service.getOrderHistoryEntries('order-1');

    expect(entry).toEqual({
      id: 'log-1',
      createdAt: new Date('2026-09-20T10:00:00Z'),
      source: 'MANUAL',
      provider: 'CASH',
      fromPaymentStatus: 'PENDING',
      toPaymentStatus: 'PAID',
      fromOrderStatus: 'PENDING_CONFIRMATION',
      toOrderStatus: 'DELIVERED',
      note: 'Received cash at the event',
      recordedBy: 'Amirul',
    });
  });

  it('falls back to the admin name when an admin recorded it', async () => {
    const adminLog = buildLog();
    adminLog.payment.bill.cashDetail.recordedByUserPlatform = {
      photographerProfile: null,
      adminProfile: { name: 'Admin Ali' },
    };
    repository.getAuditLogsByOrderId.mockResolvedValue([adminLog]);

    const [entry] = await service.getOrderHistoryEntries('order-1');

    expect(entry.recordedBy).toBe('Admin Ali');
  });

  it('gives non-manual entries no note or recorder, even when a cash bill exists', async () => {
    repository.getAuditLogsByOrderId.mockResolvedValue([
      buildLog({
        source: 'SYSTEM',
        fromStatus: 'PENDING',
        toStatus: 'PROCESSING',
      }),
    ]);

    const [entry] = await service.getOrderHistoryEntries('order-1');

    expect(entry.note).toBeNull();
    expect(entry.recordedBy).toBeNull();
  });

  it('keeps entries in the order the repository returns them (oldest first)', async () => {
    repository.getAuditLogsByOrderId.mockResolvedValue([
      buildLog({ id: 'first' }),
      buildLog({ id: 'second' }),
    ]);

    const entries = await service.getOrderHistoryEntries('order-1');

    expect(entries.map((entry) => entry.id)).toEqual(['first', 'second']);
  });

  it('returns an empty list for an order with no transitions yet', async () => {
    repository.getAuditLogsByOrderId.mockResolvedValue([]);

    expect(await service.getOrderHistoryEntries('order-1')).toEqual([]);
  });
});

describe('OrderHistoryService commission mapping', () => {
  let repository: { getLatestCommissionChargeByOrderId: jest.Mock };
  let service: OrderHistoryService;

  const imposedAt = new Date('2026-09-20T10:00:00Z');
  const noDetail = {
    percentagePerTransaction: null,
    amountPerTransaction: null,
    percentagePerUnit: null,
    amountPerUnit: null,
  };
  const chargeOf = (type: string, detail: Record<string, unknown>): any => ({
    commissionType: type,
    originalPaymentAmount: '30.00',
    commissionBaseAmount: '60.00',
    commissionAmount: '6.00',
    commissionImposedAt: imposedAt,
    ...noDetail,
    ...detail,
  });
  const perUnitPercentageDetail = {
    unitCount: 3,
    totalUnitCost: '60.00',
    averageCostPerUnit: '20.00',
    percentageRateApplied: '10.00',
    averageCommissionPerUnit: '2.00',
    commissionAmount: '6.00',
  };
  const commissionCharge = chargeOf('PERCENTAGE_PER_UNIT', {
    percentagePerUnit: perUnitPercentageDetail,
  });

  beforeEach(() => {
    repository = { getLatestCommissionChargeByOrderId: jest.fn() };
    service = new OrderHistoryService(repository as any);
  });

  it('flattens the parent charge and its per-unit child, turning decimals into numbers', async () => {
    repository.getLatestCommissionChargeByOrderId.mockResolvedValue(
      commissionCharge,
    );

    expect(await service.getOrderCommission('order-1')).toEqual({
      commissionType: 'PERCENTAGE_PER_UNIT',
      originalPaymentAmount: 30,
      commissionBaseAmount: 60,
      percentageRateApplied: 10,
      flatAmountApplied: null,
      commissionPerUnitApplied: null,
      unitCount: 3,
      totalUnitCost: 60,
      averageCostPerUnit: 20,
      averageCommissionPerUnit: 2,
      commissionAmount: 6,
      commissionImposedAt: imposedAt,
    });
  });

  it.each([
    [
      'PERCENTAGE_PER_TRANSACTION',
      {
        percentagePerTransaction: {
          percentageRateApplied: '10.00',
          transactionAmount: '30.00',
          commissionAmount: '3.00',
        },
      },
      {
        percentageRateApplied: 10,
        flatAmountApplied: null,
        commissionPerUnitApplied: null,
        unitCount: null,
      },
    ],
    [
      'AMOUNT_PER_TRANSACTION',
      {
        amountPerTransaction: {
          flatAmountApplied: '2.50',
          transactionAmount: '30.00',
          commissionAmount: '2.50',
        },
      },
      {
        percentageRateApplied: null,
        flatAmountApplied: 2.5,
        commissionPerUnitApplied: null,
        unitCount: null,
      },
    ],
    [
      'PERCENTAGE_PER_UNIT',
      { percentagePerUnit: perUnitPercentageDetail },
      {
        percentageRateApplied: 10,
        flatAmountApplied: null,
        commissionPerUnitApplied: null,
        unitCount: 3,
      },
    ],
    [
      'AMOUNT_PER_UNIT',
      {
        amountPerUnit: {
          unitCount: 3,
          totalUnitCost: '60.00',
          averageCostPerUnit: '20.00',
          commissionPerUnitApplied: '1.50',
          commissionAmount: '4.50',
        },
      },
      {
        percentageRateApplied: null,
        flatAmountApplied: null,
        commissionPerUnitApplied: 1.5,
        unitCount: 3,
      },
    ],
  ])(
    'reads the values from whichever child exists for %s',
    async (type, detail, expected) => {
      repository.getLatestCommissionChargeByOrderId.mockResolvedValue(
        chargeOf(type, detail),
      );

      const result = await service.getOrderCommission('order-1');

      expect(result).toMatchObject(expected);
    },
  );

  it('returns null when no commission was imposed on the order', async () => {
    repository.getLatestCommissionChargeByOrderId.mockResolvedValue(null);

    expect(await service.getOrderCommission('order-1')).toBeNull();
  });

  it('puts the commission on the payment DTO, or null when there is none', () => {
    const payment: any = {
      id: 'pay-1',
      provider: 'CASH',
      status: 'PAID',
      amount: '30.00',
    };

    expect(
      service.getMappedOrderPaymentDto({ ...payment, commissionCharge: null })
        .commission,
    ).toBeNull();
    expect(
      service.getMappedOrderPaymentDto({ ...payment, commissionCharge })
        .commission?.commissionAmount,
    ).toBe(6);
  });
});
