import { ToyyibPayPrePaymentService } from './toyyibpay-pre-payment.service';

describe('ToyyibPayPrePaymentService.createBillForPayment', () => {
  const credentials = {
    categoryCode: 'cat1',
    secretKey: 'secret',
    chargeFpxToCustomer: false,
    chargeToPrepaid: false,
  };
  const params = {
    paymentId: 'pay-1',
    paymentPlatformOptionId: 'option-1',
    amount: 30,
    itemPrices: [30],
    isImposeCommission: true,
    externalReferenceNo: 'pay-1',
    billName: 'Event',
    billDescription: 'Photos for Event',
    payerName: 'a@b.com',
    payerEmail: 'a@b.com',
    payerPhone: '0123456789',
  };

  let toyyibPayPaymentConfigService: {
    getToyyibPayCredentialsForOption: jest.Mock;
  };
  let toyyibPayApiClient: {
    createBill: jest.Mock;
    getBillPaymentUrl: jest.Mock;
  };
  let commissionService: {
    getToyyibPaySplitRecipient: jest.Mock;
    getCommissionForPayment: jest.Mock;
  };
  let toyyibPayPrePaymentRepository: { createToyyibPayBill: jest.Mock };
  let service: ToyyibPayPrePaymentService;

  beforeEach(() => {
    toyyibPayPaymentConfigService = {
      getToyyibPayCredentialsForOption: jest
        .fn()
        .mockResolvedValue(credentials),
    };
    toyyibPayApiClient = {
      createBill: jest.fn().mockResolvedValue({
        billCode: 'bill-1',
        requestPayload: { billAmount: '3000' },
        responsePayload: { BillCode: 'bill-1' },
      }),
      getBillPaymentUrl: jest
        .fn()
        .mockReturnValue('https://dev.toyyibpay.com/bill-1'),
    };
    commissionService = {
      getToyyibPaySplitRecipient: jest.fn().mockResolvedValue(null),
      getCommissionForPayment: jest.fn().mockResolvedValue(null),
    };
    toyyibPayPrePaymentRepository = {
      createToyyibPayBill: jest.fn().mockResolvedValue(undefined),
    };
    service = new ToyyibPayPrePaymentService(
      toyyibPayPaymentConfigService as any,
      toyyibPayApiClient as any,
      commissionService as any,
      toyyibPayPrePaymentRepository as any,
    );
  });

  it('creates a normal bill with no split when the option has no split recipient configured', async () => {
    await service.createBillForPayment(params);

    expect(toyyibPayApiClient.createBill).toHaveBeenCalledWith(
      expect.objectContaining({ splitPayment: undefined }),
    );
    expect(
      toyyibPayPrePaymentRepository.createToyyibPayBill,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        splitRecipientUsername: null,
        splitCommission: null,
      }),
    );
  });

  it('does not even compute commission when there is no split recipient', async () => {
    await service.createBillForPayment(params);

    expect(commissionService.getCommissionForPayment).not.toHaveBeenCalled();
  });

  it('sends the split payment and persists the locked-in commission when a recipient is configured', async () => {
    commissionService.getToyyibPaySplitRecipient.mockResolvedValue(
      'arfankareem',
    );
    const commission = { commissionAmount: 3, commissionPlanId: 'plan-1' };
    commissionService.getCommissionForPayment.mockResolvedValue(commission);

    await service.createBillForPayment(params);

    expect(commissionService.getCommissionForPayment).toHaveBeenCalledWith({
      paymentPlatformOptionId: 'option-1',
      isImposeCommission: true,
      order: { amountPaid: 30, itemPrices: [30] },
    });
    expect(toyyibPayApiClient.createBill).toHaveBeenCalledWith(
      expect.objectContaining({
        splitPayment: { recipientUsername: 'arfankareem', amountInCents: 300 },
      }),
    );
    expect(
      toyyibPayPrePaymentRepository.createToyyibPayBill,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        splitRecipientUsername: 'arfankareem',
        splitCommission: commission,
      }),
    );
  });

  it('falls back to no split when a recipient is configured but no commission is actually owed', async () => {
    commissionService.getToyyibPaySplitRecipient.mockResolvedValue(
      'arfankareem',
    );
    commissionService.getCommissionForPayment.mockResolvedValue(null);

    await service.createBillForPayment(params);

    expect(toyyibPayApiClient.createBill).toHaveBeenCalledWith(
      expect.objectContaining({ splitPayment: undefined }),
    );
    expect(
      toyyibPayPrePaymentRepository.createToyyibPayBill,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        splitRecipientUsername: null,
        splitCommission: null,
      }),
    );
  });
});
