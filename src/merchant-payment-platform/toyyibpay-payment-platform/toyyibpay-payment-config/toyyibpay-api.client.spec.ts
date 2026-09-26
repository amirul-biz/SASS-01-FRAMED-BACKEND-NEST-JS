import { ToyyibPayApiClient } from './toyyibpay-api.client';

describe('ToyyibPayApiClient.createBill split payment', () => {
  let client: ToyyibPayApiClient;
  let fetchMock: jest.Mock;

  const baseParams = {
    secretKey: 'secret',
    categoryCode: 'cat1',
    billName: 'Event',
    billDescription: 'Photos for Event',
    amountInCents: 3000,
    returnUrl: 'https://client.example/return',
    callbackUrl: 'https://callback.example/webhook',
    externalReferenceNo: 'pay-1',
    payerName: 'a@b.com',
    payerEmail: 'a@b.com',
    payerPhone: '0123456789',
    chargeFeeToCustomer: false,
  };

  beforeEach(() => {
    client = new ToyyibPayApiClient();
    fetchMock = jest.fn().mockResolvedValue({
      text: () => Promise.resolve('[{"BillCode":"bill-1"}]'),
    });
    (global as any).fetch = fetchMock;
  });

  it('sends billSplitPayment=0 and no split args when no split payment is given', async () => {
    await client.createBill(baseParams);

    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('billSplitPayment')).toBe('0');
    expect(body.get('billSplitPaymentArgs')).toBeNull();
  });

  it('sends billSplitPayment=1 and the recipient/amount as billSplitPaymentArgs when a split payment is given', async () => {
    await client.createBill({
      ...baseParams,
      splitPayment: { recipientUsername: 'arfankareem', amountInCents: 300 },
    });

    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('billSplitPayment')).toBe('1');
    expect(JSON.parse(body.get('billSplitPaymentArgs') as string)).toEqual([
      { id: 'arfankareem', amount: '300' },
    ]);
  });
});
