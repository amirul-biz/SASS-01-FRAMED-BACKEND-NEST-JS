import { ToyyibPayPaymentFinalizationService } from './toyyibpay-payment-finalization.service';

describe('ToyyibPayPaymentFinalizationService', () => {
  const payment: any = {
    id: 'pay-1',
    orderId: 'order-1',
    status: 'PENDING',
    amount: '30.00',
    merchantPaymentPlatformOptionId: 'option-1',
    merchantPaymentPlatformOption: {
      userPlatformId: 'platform-1',
      isImposeCommission: true,
    },
    order: {
      status: 'PENDING_CONFIRMATION',
      email: 'customer@example.com',
      items: [{ price: '30.00' }],
    },
  };

  let commissionService: { getCommissionForPayment: jest.Mock };
  let toyyibPayPrePaymentRepository: {
    getSplitCommissionByPaymentId: jest.Mock;
  };
  let toyyibPayWebhookRepository: {
    markPaymentAsPaid: jest.Mock;
    markPaymentAsFailed: jest.Mock;
    markPaymentAsProcessing: jest.Mock;
  };
  let merchantOrderPaymentRepository: { deliverOrder: jest.Mock };
  let emailService: { sendPaymentFailedEmail: jest.Mock };
  let service: ToyyibPayPaymentFinalizationService;

  beforeEach(() => {
    commissionService = {
      getCommissionForPayment: jest.fn().mockResolvedValue(null),
    };
    toyyibPayPrePaymentRepository = {
      getSplitCommissionByPaymentId: jest.fn().mockResolvedValue(null),
    };
    toyyibPayWebhookRepository = {
      markPaymentAsPaid: jest.fn().mockResolvedValue(true),
      markPaymentAsFailed: jest.fn().mockResolvedValue(true),
      markPaymentAsProcessing: jest.fn().mockResolvedValue(true),
    };
    merchantOrderPaymentRepository = {
      deliverOrder: jest.fn().mockResolvedValue(true),
    };
    emailService = {
      sendPaymentFailedEmail: jest.fn().mockResolvedValue(undefined),
    };
    service = new ToyyibPayPaymentFinalizationService(
      commissionService as any,
      toyyibPayPrePaymentRepository as any,
      toyyibPayWebhookRepository as any,
      merchantOrderPaymentRepository as any,
      emailService as any,
    );
  });

  it('finalizeAsPaid works out the commission from the option, amount and photo prices, then marks it paid', async () => {
    await service.finalizeAsPaid(payment, 'WEBHOOK');

    expect(commissionService.getCommissionForPayment).toHaveBeenCalledWith({
      paymentPlatformOptionId: 'option-1',
      isImposeCommission: true,
      order: { amountPaid: 30, itemPrices: [30] },
    });
    expect(toyyibPayWebhookRepository.markPaymentAsPaid).toHaveBeenCalledWith(
      payment,
      null,
      'WEBHOOK',
    );
    expect(merchantOrderPaymentRepository.deliverOrder).toHaveBeenCalledWith({
      orderId: 'order-1',
      paymentId: 'pay-1',
      email: 'customer@example.com',
      amount: 30,
      source: 'WEBHOOK',
    });
  });

  it('finalizeAsPaid passes through whichever source it was called with', async () => {
    await service.finalizeAsPaid(payment, 'SYSTEM');

    expect(toyyibPayWebhookRepository.markPaymentAsPaid).toHaveBeenCalledWith(
      payment,
      null,
      'SYSTEM',
    );
  });

  it('finalizeAsFailed marks it failed without computing commission, then emails the customer', async () => {
    await service.finalizeAsFailed(payment, 'MANUAL');

    expect(commissionService.getCommissionForPayment).not.toHaveBeenCalled();
    expect(toyyibPayWebhookRepository.markPaymentAsFailed).toHaveBeenCalledWith(
      payment,
      'MANUAL',
    );
    expect(emailService.sendPaymentFailedEmail).toHaveBeenCalledWith({
      orderId: 'order-1',
      email: 'customer@example.com',
      amount: 30,
    });
  });

  it('does not email when the failed transition was already handled', async () => {
    toyyibPayWebhookRepository.markPaymentAsFailed.mockResolvedValue(false);

    await expect(service.finalizeAsFailed(payment, 'MANUAL')).resolves.toBe(
      false,
    );
    expect(emailService.sendPaymentFailedEmail).not.toHaveBeenCalled();
  });

  it('finalizeAsProcessing marks it processing', async () => {
    await service.finalizeAsProcessing(payment, 'WEBHOOK');

    expect(
      toyyibPayWebhookRepository.markPaymentAsProcessing,
    ).toHaveBeenCalledWith(payment, 'WEBHOOK');
  });

  it('returns false when the repository reports the transition was already handled, without delivering the order', async () => {
    toyyibPayWebhookRepository.markPaymentAsPaid.mockResolvedValue(false);

    await expect(service.finalizeAsPaid(payment, 'WEBHOOK')).resolves.toBe(
      false,
    );
    expect(merchantOrderPaymentRepository.deliverOrder).not.toHaveBeenCalled();
  });

  it('finalizeAsPaid reuses the locked-in split commission instead of recomputing it', async () => {
    const lockedCommission = {
      commissionAmount: 5,
      commissionPlanId: 'plan-1',
    };
    toyyibPayPrePaymentRepository.getSplitCommissionByPaymentId.mockResolvedValue(
      lockedCommission,
    );

    await service.finalizeAsPaid(payment, 'WEBHOOK');

    expect(commissionService.getCommissionForPayment).not.toHaveBeenCalled();
    expect(toyyibPayWebhookRepository.markPaymentAsPaid).toHaveBeenCalledWith(
      payment,
      lockedCommission,
      'WEBHOOK',
    );
  });
});
