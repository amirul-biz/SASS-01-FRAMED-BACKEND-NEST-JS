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

// Live dev.toyyibpay.com behaviour (verified 2026-11-09): a valid secret key with a WRONG category
// code returns HTTP 200 and a body where every field exists but is blank — no error, no msg. The
// old "all three fields are strings" check passed that straight through, so a bad category could
// be saved and only surfaced as a broken bill on a real customer's payment.
describe('ToyyibPayApiClient.getCategoryDetails validation', () => {
  let client: ToyyibPayApiClient;
  let setBody: (body: string) => void;

  beforeEach(() => {
    client = new ToyyibPayApiClient();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (global as any).fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        text: () =>
          Promise.resolve(
            (global as any).__body ??
              '{"CategoryName":"","categoryDescription":"","categoryStatus":""}',
          ),
      }),
    );
    setBody = (body: string) => {
      (global as any).__body = body;
    };
  });

  afterEach(() => {
    (global as any).__body = undefined;
  });

  it('accepts a real, active category', async () => {
    setBody(
      '{"CategoryName":"Event Ticket","categoryDescription":"Photos","categoryStatus":"1"}',
    );
    await expect(
      client.getCategoryDetails('secret', 'gcbhict9'),
    ).resolves.toEqual({
      categoryName: 'Event Ticket',
      categoryDescription: 'Photos',
      categoryStatus: '1',
    });
  });

  it('rejects the blank payload ToyyibPay returns for a wrong category code', async () => {
    await expect(
      client.getCategoryDetails('secret', 'not-a-category'),
    ).rejects.toThrow(/category code does not exist/);
  });

  it('rejects an inactive category', async () => {
    setBody(
      '{"CategoryName":"Event Ticket","categoryDescription":"Photos","categoryStatus":"0"}',
    );
    await expect(
      client.getCategoryDetails('secret', 'gcbhict9'),
    ).rejects.toThrow(/is not active/);
  });
});
