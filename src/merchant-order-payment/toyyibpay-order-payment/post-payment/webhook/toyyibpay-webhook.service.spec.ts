import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  ToyyibPayCallbackStatus,
  ToyyibPayWebhookCallbackDto,
} from './toyyibpay-webhook.dto';
import { ToyyibPayWebhookService } from './toyyibpay-webhook.service';

describe('ToyyibPayWebhookService.handleCallback', () => {
  const secretKey = 'test-secret-key';

  const buildHash = (
    status: ToyyibPayCallbackStatus,
    orderId: string,
    refno: string,
  ): string =>
    createHash('md5')
      .update(secretKey + status + orderId + refno + 'ok')
      .digest('hex');

  const buildDto = (
    overrides: Partial<ToyyibPayWebhookCallbackDto> = {},
  ): ToyyibPayWebhookCallbackDto => {
    const base = {
      refno: 'TP123',
      status: ToyyibPayCallbackStatus.SUCCESS,
      reason: 'Payment Approved',
      billcode: 'abc12345',
      order_id: 'pay-1',
      amount: '30.00',
      transaction_time: '2026-09-26 12:01:22',
      ...overrides,
    };
    return Object.assign(new ToyyibPayWebhookCallbackDto(), {
      ...base,
      hash: overrides.hash ?? buildHash(base.status, base.order_id, base.refno),
    });
  };

  const payment: any = {
    id: 'pay-1',
    orderId: 'order-1',
    provider: 'TOYYIBPAY',
    status: 'PENDING',
    amount: '30.00',
    merchantPaymentPlatformOptionId: 'option-1',
    merchantPaymentPlatformOption: {
      userPlatformId: 'platform-1',
      isImposeCommission: true,
    },
    order: { status: 'PENDING_CONFIRMATION', items: [{ price: '30.00' }] },
  };

  let merchantOrderPaymentRepository: { getPaymentForMarkingById: jest.Mock };
  let toyyibPayPaymentConfigService: {
    getToyyibPayCredentialsForOption: jest.Mock;
  };
  let toyyibPayPaymentFinalizationService: {
    finalizeAsPaid: jest.Mock;
    finalizeAsFailed: jest.Mock;
    finalizeAsProcessing: jest.Mock;
  };
  let service: ToyyibPayWebhookService;

  beforeEach(() => {
    merchantOrderPaymentRepository = {
      getPaymentForMarkingById: jest.fn().mockResolvedValue(payment),
    };
    toyyibPayPaymentConfigService = {
      getToyyibPayCredentialsForOption: jest.fn().mockResolvedValue({
        categoryCode: 'cat1',
        secretKey,
        chargeFpxToCustomer: false,
        chargeToPrepaid: false,
      }),
    };
    toyyibPayPaymentFinalizationService = {
      finalizeAsPaid: jest.fn().mockResolvedValue(true),
      finalizeAsFailed: jest.fn().mockResolvedValue(true),
      finalizeAsProcessing: jest.fn().mockResolvedValue(true),
    };
    service = new ToyyibPayWebhookService(
      merchantOrderPaymentRepository as any,
      toyyibPayPaymentConfigService as any,
      toyyibPayPaymentFinalizationService as any,
    );
  });

  it("returns 404 when no payment matches the callback's order_id", async () => {
    merchantOrderPaymentRepository.getPaymentForMarkingById.mockResolvedValue(
      null,
    );

    await expect(service.handleCallback(buildDto())).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects a payment that is not a ToyyibPay payment', async () => {
    merchantOrderPaymentRepository.getPaymentForMarkingById.mockResolvedValue({
      ...payment,
      provider: 'CASH',
    });

    await expect(service.handleCallback(buildDto())).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects an invalid hash and does not finalize the payment', async () => {
    await expect(
      service.handleCallback(
        buildDto({ hash: 'not-the-real-hash-00000000000000' }),
      ),
    ).rejects.toThrow(BadRequestException);

    expect(
      toyyibPayPaymentFinalizationService.finalizeAsPaid,
    ).not.toHaveBeenCalled();
    expect(
      toyyibPayPaymentFinalizationService.finalizeAsFailed,
    ).not.toHaveBeenCalled();
    expect(
      toyyibPayPaymentFinalizationService.finalizeAsProcessing,
    ).not.toHaveBeenCalled();
  });

  it('on success, finalizes the payment as paid with WEBHOOK as the source', async () => {
    await service.handleCallback(
      buildDto({ status: ToyyibPayCallbackStatus.SUCCESS }),
    );

    expect(
      toyyibPayPaymentFinalizationService.finalizeAsPaid,
    ).toHaveBeenCalledWith(payment, 'WEBHOOK');
  });

  it('on failure, finalizes the payment as failed with WEBHOOK as the source', async () => {
    await service.handleCallback(
      buildDto({
        status: ToyyibPayCallbackStatus.FAILED,
        reason: 'Payment was rejected',
      }),
    );

    expect(
      toyyibPayPaymentFinalizationService.finalizeAsFailed,
    ).toHaveBeenCalledWith(payment, 'WEBHOOK');
  });

  it('on pending, finalizes the payment as processing with WEBHOOK as the source', async () => {
    await service.handleCallback(
      buildDto({ status: ToyyibPayCallbackStatus.PENDING }),
    );

    expect(
      toyyibPayPaymentFinalizationService.finalizeAsProcessing,
    ).toHaveBeenCalledWith(payment, 'WEBHOOK');
  });

  it('a duplicate callback (already handled by the finalization service) does not throw', async () => {
    toyyibPayPaymentFinalizationService.finalizeAsPaid.mockResolvedValue(false);

    await expect(
      service.handleCallback(
        buildDto({ status: ToyyibPayCallbackStatus.SUCCESS }),
      ),
    ).resolves.toBeUndefined();
  });
});
