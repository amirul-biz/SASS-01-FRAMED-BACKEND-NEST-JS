import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ToyyibPayPaymentSyncService } from './toyyibpay-payment-sync.service';

describe('ToyyibPayPaymentSyncService.syncPayment', () => {
  const openPayment: any = {
    id: 'pay-1',
    orderId: 'order-1',
    provider: 'TOYYIBPAY',
    status: 'PENDING',
    merchantPaymentPlatformOptionId: 'option-1',
    merchantPaymentPlatformOption: {
      userPlatformId: 'platform-1',
      isImposeCommission: true,
    },
    order: { status: 'PENDING_CONFIRMATION', items: [{ price: '30.00' }] },
  };

  let merchantOrderPaymentRepository: { getPaymentForMarkingById: jest.Mock };
  let merchantPaymentPlatformService: {
    getAuthorizedUserPlatformId: jest.Mock;
  };
  let toyyibPayPrePaymentRepository: { getBillCodeByPaymentId: jest.Mock };
  let toyyibPayPaymentConfigService: {
    getToyyibPayCredentialsForOption: jest.Mock;
  };
  let toyyibPayApiClient: { getBillTransactionStatus: jest.Mock };
  let toyyibPayPaymentFinalizationService: {
    finalizeAsPaid: jest.Mock;
    finalizeAsFailed: jest.Mock;
    finalizeAsProcessing: jest.Mock;
  };
  let toyyibPayPaymentSyncRepository: { getStaleOpenPaymentIds: jest.Mock };
  let service: ToyyibPayPaymentSyncService;

  beforeEach(() => {
    merchantOrderPaymentRepository = {
      getPaymentForMarkingById: jest.fn().mockResolvedValue(openPayment),
    };
    merchantPaymentPlatformService = {
      getAuthorizedUserPlatformId: jest.fn(
        (user, optionOwnerUserPlatformId) => {
          const isOwner = user.userPlatforms.some(
            (platform: any) => platform.id === optionOwnerUserPlatformId,
          );
          if (!isOwner) {
            throw new ForbiddenException(
              'You do not own this payment platform option',
            );
          }
          return optionOwnerUserPlatformId;
        },
      ),
    };
    toyyibPayPrePaymentRepository = {
      getBillCodeByPaymentId: jest.fn().mockResolvedValue('bill-1'),
    };
    toyyibPayPaymentConfigService = {
      getToyyibPayCredentialsForOption: jest
        .fn()
        .mockResolvedValue({ secretKey: 'secret' }),
    };
    toyyibPayApiClient = {
      getBillTransactionStatus: jest
        .fn()
        .mockResolvedValue({ isPaid: false, isFailed: false }),
    };
    toyyibPayPaymentFinalizationService = {
      finalizeAsPaid: jest.fn().mockResolvedValue(true),
      finalizeAsFailed: jest.fn().mockResolvedValue(true),
      finalizeAsProcessing: jest.fn().mockResolvedValue(true),
    };
    toyyibPayPaymentSyncRepository = {
      getStaleOpenPaymentIds: jest.fn().mockResolvedValue([]),
    };
    service = new ToyyibPayPaymentSyncService(
      merchantOrderPaymentRepository as any,
      merchantPaymentPlatformService as any,
      toyyibPayPrePaymentRepository as any,
      toyyibPayPaymentConfigService as any,
      toyyibPayApiClient as any,
      toyyibPayPaymentFinalizationService as any,
      toyyibPayPaymentSyncRepository as any,
    );
  });

  it('throws 404 when no payment matches the id', async () => {
    merchantOrderPaymentRepository.getPaymentForMarkingById.mockResolvedValue(
      null,
    );

    await expect(service.syncPayment('missing', 'MANUAL')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects a payment that is not a ToyyibPay payment', async () => {
    merchantOrderPaymentRepository.getPaymentForMarkingById.mockResolvedValue({
      ...openPayment,
      provider: 'CASH',
    });

    await expect(service.syncPayment('pay-1', 'MANUAL')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('is a no-op for a payment that is already terminal, without calling ToyyibPay', async () => {
    merchantOrderPaymentRepository.getPaymentForMarkingById.mockResolvedValue({
      ...openPayment,
      status: 'PAID',
    });

    await expect(service.syncPayment('pay-1', 'MANUAL')).resolves.toEqual({
      synced: false,
    });
    expect(toyyibPayApiClient.getBillTransactionStatus).not.toHaveBeenCalled();
  });

  it('is a no-op when ToyyibPay still reports nothing definitive', async () => {
    await expect(service.syncPayment('pay-1', 'MANUAL')).resolves.toEqual({
      synced: false,
    });
    expect(
      toyyibPayPaymentFinalizationService.finalizeAsPaid,
    ).not.toHaveBeenCalled();
    expect(
      toyyibPayPaymentFinalizationService.finalizeAsFailed,
    ).not.toHaveBeenCalled();
  });

  it('finalizes as paid when ToyyibPay reports a paid transaction', async () => {
    toyyibPayApiClient.getBillTransactionStatus.mockResolvedValue({
      isPaid: true,
      isFailed: false,
    });

    await expect(service.syncPayment('pay-1', 'MANUAL')).resolves.toEqual({
      synced: true,
    });
    expect(
      toyyibPayPaymentFinalizationService.finalizeAsPaid,
    ).toHaveBeenCalledWith(openPayment, 'MANUAL');
  });

  it('finalizes as failed when ToyyibPay reports every transaction attempt failed', async () => {
    toyyibPayApiClient.getBillTransactionStatus.mockResolvedValue({
      isPaid: false,
      isFailed: true,
    });

    await expect(service.syncPayment('pay-1', 'SYSTEM')).resolves.toEqual({
      synced: true,
    });
    expect(
      toyyibPayPaymentFinalizationService.finalizeAsFailed,
    ).toHaveBeenCalledWith(openPayment, 'SYSTEM');
  });
});

describe('ToyyibPayPaymentSyncService.syncAllStalePayments', () => {
  let merchantOrderPaymentRepository: { getPaymentForMarkingById: jest.Mock };
  let merchantPaymentPlatformService: {
    getAuthorizedUserPlatformId: jest.Mock;
  };
  let toyyibPayPrePaymentRepository: { getBillCodeByPaymentId: jest.Mock };
  let toyyibPayPaymentConfigService: {
    getToyyibPayCredentialsForOption: jest.Mock;
  };
  let toyyibPayApiClient: { getBillTransactionStatus: jest.Mock };
  let toyyibPayPaymentFinalizationService: {
    finalizeAsPaid: jest.Mock;
    finalizeAsFailed: jest.Mock;
    finalizeAsProcessing: jest.Mock;
  };
  let toyyibPayPaymentSyncRepository: { getStaleOpenPaymentIds: jest.Mock };
  let service: ToyyibPayPaymentSyncService;

  const openPayment: any = {
    id: 'pay-1',
    orderId: 'order-1',
    provider: 'TOYYIBPAY',
    status: 'PENDING',
    merchantPaymentPlatformOptionId: 'option-1',
    merchantPaymentPlatformOption: {
      userPlatformId: 'platform-1',
      isImposeCommission: true,
    },
    order: { status: 'PENDING_CONFIRMATION', items: [{ price: '30.00' }] },
  };

  beforeEach(() => {
    merchantOrderPaymentRepository = {
      getPaymentForMarkingById: jest.fn().mockResolvedValue(openPayment),
    };
    merchantPaymentPlatformService = {
      getAuthorizedUserPlatformId: jest.fn().mockReturnValue('platform-1'),
    };
    toyyibPayPrePaymentRepository = {
      getBillCodeByPaymentId: jest.fn().mockResolvedValue('bill-1'),
    };
    toyyibPayPaymentConfigService = {
      getToyyibPayCredentialsForOption: jest
        .fn()
        .mockResolvedValue({ secretKey: 'secret' }),
    };
    toyyibPayApiClient = {
      getBillTransactionStatus: jest
        .fn()
        .mockResolvedValue({ isPaid: true, isFailed: false }),
    };
    toyyibPayPaymentFinalizationService = {
      finalizeAsPaid: jest.fn().mockResolvedValue(true),
      finalizeAsFailed: jest.fn().mockResolvedValue(true),
      finalizeAsProcessing: jest.fn().mockResolvedValue(true),
    };
    toyyibPayPaymentSyncRepository = {
      getStaleOpenPaymentIds: jest.fn().mockResolvedValue(['pay-1', 'pay-2']),
    };
    service = new ToyyibPayPaymentSyncService(
      merchantOrderPaymentRepository as any,
      merchantPaymentPlatformService as any,
      toyyibPayPrePaymentRepository as any,
      toyyibPayPaymentConfigService as any,
      toyyibPayApiClient as any,
      toyyibPayPaymentFinalizationService as any,
      toyyibPayPaymentSyncRepository as any,
    );
  });

  it('checks every stale payment and reports how many finalized, using SYSTEM as the source', async () => {
    await expect(service.syncAllStalePayments()).resolves.toEqual({
      checked: 2,
      finalized: 2,
    });
    expect(
      toyyibPayPaymentFinalizationService.finalizeAsPaid,
    ).toHaveBeenCalledWith(openPayment, 'SYSTEM');
  });

  it('does not let one payment throwing stop the rest of the sweep', async () => {
    merchantOrderPaymentRepository.getPaymentForMarkingById
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(openPayment);

    await expect(service.syncAllStalePayments()).resolves.toEqual({
      checked: 2,
      finalized: 1,
    });
  });
});

describe('ToyyibPayPaymentSyncService.resyncAsPhotographer', () => {
  const openPayment: any = {
    id: 'pay-1',
    orderId: 'order-1',
    provider: 'TOYYIBPAY',
    status: 'PENDING',
    merchantPaymentPlatformOptionId: 'option-1',
    merchantPaymentPlatformOption: {
      userPlatformId: 'platform-owner',
      isImposeCommission: true,
    },
    order: { status: 'PENDING_CONFIRMATION', items: [{ price: '30.00' }] },
  };
  const owner: any = {
    userPlatforms: [{ id: 'platform-owner', role: 'PHOTOGRAPHER' }],
  };
  const stranger: any = {
    userPlatforms: [{ id: 'platform-other', role: 'PHOTOGRAPHER' }],
  };

  let merchantOrderPaymentRepository: { getPaymentForMarkingById: jest.Mock };
  let merchantPaymentPlatformService: {
    getAuthorizedUserPlatformId: jest.Mock;
  };
  let toyyibPayPrePaymentRepository: { getBillCodeByPaymentId: jest.Mock };
  let toyyibPayPaymentConfigService: {
    getToyyibPayCredentialsForOption: jest.Mock;
  };
  let toyyibPayApiClient: { getBillTransactionStatus: jest.Mock };
  let toyyibPayPaymentFinalizationService: {
    finalizeAsPaid: jest.Mock;
    finalizeAsFailed: jest.Mock;
    finalizeAsProcessing: jest.Mock;
  };
  let toyyibPayPaymentSyncRepository: { getStaleOpenPaymentIds: jest.Mock };
  let service: ToyyibPayPaymentSyncService;

  beforeEach(() => {
    merchantOrderPaymentRepository = {
      getPaymentForMarkingById: jest.fn().mockResolvedValue(openPayment),
    };
    merchantPaymentPlatformService = {
      getAuthorizedUserPlatformId: jest.fn(
        (user, optionOwnerUserPlatformId) => {
          const isOwner = user.userPlatforms.some(
            (platform: any) => platform.id === optionOwnerUserPlatformId,
          );
          if (!isOwner) {
            throw new ForbiddenException(
              'You do not own this payment platform option',
            );
          }
          return optionOwnerUserPlatformId;
        },
      ),
    };
    toyyibPayPrePaymentRepository = {
      getBillCodeByPaymentId: jest.fn().mockResolvedValue('bill-1'),
    };
    toyyibPayPaymentConfigService = {
      getToyyibPayCredentialsForOption: jest
        .fn()
        .mockResolvedValue({ secretKey: 'secret' }),
    };
    toyyibPayApiClient = {
      getBillTransactionStatus: jest
        .fn()
        .mockResolvedValue({ isPaid: true, isFailed: false }),
    };
    toyyibPayPaymentFinalizationService = {
      finalizeAsPaid: jest.fn().mockResolvedValue(true),
      finalizeAsFailed: jest.fn().mockResolvedValue(true),
      finalizeAsProcessing: jest.fn().mockResolvedValue(true),
    };
    toyyibPayPaymentSyncRepository = {
      getStaleOpenPaymentIds: jest.fn().mockResolvedValue([]),
    };
    service = new ToyyibPayPaymentSyncService(
      merchantOrderPaymentRepository as any,
      merchantPaymentPlatformService as any,
      toyyibPayPrePaymentRepository as any,
      toyyibPayPaymentConfigService as any,
      toyyibPayApiClient as any,
      toyyibPayPaymentFinalizationService as any,
      toyyibPayPaymentSyncRepository as any,
    );
  });

  it('throws 404 when no payment matches the id', async () => {
    merchantOrderPaymentRepository.getPaymentForMarkingById.mockResolvedValue(
      null,
    );

    await expect(
      service.resyncAsPhotographer(owner, 'missing'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws 403 when the requesting photographer does not own the payment platform option', async () => {
    await expect(
      service.resyncAsPhotographer(stranger, 'pay-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(toyyibPayApiClient.getBillTransactionStatus).not.toHaveBeenCalled();
  });

  it('resyncs with MANUAL as the source when the requesting photographer owns the option', async () => {
    await expect(service.resyncAsPhotographer(owner, 'pay-1')).resolves.toEqual(
      {
        synced: true,
      },
    );
    expect(
      toyyibPayPaymentFinalizationService.finalizeAsPaid,
    ).toHaveBeenCalledWith(openPayment, 'MANUAL');
  });
});

describe('ToyyibPayPaymentSyncService.confirmReturnAsCustomer', () => {
  const openPayment: any = {
    id: 'pay-1',
    orderId: 'order-1',
    provider: 'TOYYIBPAY',
    status: 'PENDING',
    merchantPaymentPlatformOptionId: 'option-1',
    merchantPaymentPlatformOption: {
      userPlatformId: 'platform-1',
      isImposeCommission: true,
    },
    order: { status: 'PENDING_CONFIRMATION', items: [{ price: '30.00' }] },
  };

  let merchantOrderPaymentRepository: { getPaymentForMarkingById: jest.Mock };
  let merchantPaymentPlatformService: {
    getAuthorizedUserPlatformId: jest.Mock;
  };
  let toyyibPayPrePaymentRepository: { getBillCodeByPaymentId: jest.Mock };
  let toyyibPayPaymentConfigService: {
    getToyyibPayCredentialsForOption: jest.Mock;
  };
  let toyyibPayApiClient: { getBillTransactionStatus: jest.Mock };
  let toyyibPayPaymentFinalizationService: {
    finalizeAsPaid: jest.Mock;
    finalizeAsFailed: jest.Mock;
    finalizeAsProcessing: jest.Mock;
  };
  let toyyibPayPaymentSyncRepository: { getStaleOpenPaymentIds: jest.Mock };
  let service: ToyyibPayPaymentSyncService;

  beforeEach(() => {
    merchantOrderPaymentRepository = {
      getPaymentForMarkingById: jest.fn().mockResolvedValue(openPayment),
    };
    merchantPaymentPlatformService = {
      getAuthorizedUserPlatformId: jest.fn().mockReturnValue('platform-1'),
    };
    toyyibPayPrePaymentRepository = {
      getBillCodeByPaymentId: jest.fn().mockResolvedValue('bill-1'),
    };
    toyyibPayPaymentConfigService = {
      getToyyibPayCredentialsForOption: jest
        .fn()
        .mockResolvedValue({ secretKey: 'secret' }),
    };
    toyyibPayApiClient = {
      getBillTransactionStatus: jest
        .fn()
        .mockResolvedValue({ isPaid: true, isFailed: false }),
    };
    toyyibPayPaymentFinalizationService = {
      finalizeAsPaid: jest.fn().mockResolvedValue(true),
      finalizeAsFailed: jest.fn().mockResolvedValue(true),
      finalizeAsProcessing: jest.fn().mockResolvedValue(true),
    };
    toyyibPayPaymentSyncRepository = {
      getStaleOpenPaymentIds: jest.fn().mockResolvedValue([]),
    };
    service = new ToyyibPayPaymentSyncService(
      merchantOrderPaymentRepository as any,
      merchantPaymentPlatformService as any,
      toyyibPayPrePaymentRepository as any,
      toyyibPayPaymentConfigService as any,
      toyyibPayApiClient as any,
      toyyibPayPaymentFinalizationService as any,
      toyyibPayPaymentSyncRepository as any,
    );
  });

  it('throws 404 and never calls ToyyibPay when the billCode does not match what is stored', async () => {
    await expect(
      service.confirmReturnAsCustomer('pay-1', 'wrong-bill-code'),
    ).rejects.toThrow(NotFoundException);
    expect(toyyibPayApiClient.getBillTransactionStatus).not.toHaveBeenCalled();
  });

  it('throws 404 when the payment has no bill on record yet', async () => {
    toyyibPayPrePaymentRepository.getBillCodeByPaymentId.mockResolvedValue(
      null,
    );

    await expect(
      service.confirmReturnAsCustomer('pay-1', 'bill-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('syncs with CUSTOMER as the source and returns the payment status after syncing', async () => {
    merchantOrderPaymentRepository.getPaymentForMarkingById
      .mockResolvedValueOnce(openPayment)
      .mockResolvedValueOnce({ ...openPayment, status: 'PAID' });

    await expect(
      service.confirmReturnAsCustomer('pay-1', 'bill-1'),
    ).resolves.toEqual({ paymentStatus: 'PAID' });
    expect(
      toyyibPayPaymentFinalizationService.finalizeAsPaid,
    ).toHaveBeenCalledWith(openPayment, 'CUSTOMER');
  });

  it('returns the current payment status without calling ToyyibPay when already resolved (e.g. webhook beat the customer to it)', async () => {
    const alreadyPaidPayment = { ...openPayment, status: 'PAID' };
    merchantOrderPaymentRepository.getPaymentForMarkingById.mockResolvedValue(
      alreadyPaidPayment,
    );

    await expect(
      service.confirmReturnAsCustomer('pay-1', 'bill-1'),
    ).resolves.toEqual({ paymentStatus: 'PAID' });
    expect(toyyibPayApiClient.getBillTransactionStatus).not.toHaveBeenCalled();
    expect(
      toyyibPayPaymentFinalizationService.finalizeAsPaid,
    ).not.toHaveBeenCalled();
  });
});
