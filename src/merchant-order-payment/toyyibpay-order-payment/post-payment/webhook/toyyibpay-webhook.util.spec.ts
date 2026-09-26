import {
  ToyyibPayCallbackStatus,
  ToyyibPayWebhookCallbackDto,
} from './toyyibpay-webhook.dto';
import { verifyToyyibPayCallbackHash } from './toyyibpay-webhook.util';

describe('verifyToyyibPayCallbackHash', () => {
  const secretKey = 'test-secret-key';

  const buildDto = (
    overrides: Partial<ToyyibPayWebhookCallbackDto> = {},
  ): ToyyibPayWebhookCallbackDto =>
    Object.assign(new ToyyibPayWebhookCallbackDto(), {
      refno: 'TP123',
      status: ToyyibPayCallbackStatus.SUCCESS,
      reason: 'Payment Approved',
      billcode: 'abc12345',
      order_id: 'order-abc',
      amount: '30.00',
      transaction_time: '2026-09-26 12:01:22',
      // MD5('test-secret-key' + '1' + 'order-abc' + 'TP123' + 'ok'), computed independently.
      hash: '7c177bea8f661999d511e968188bba60',
      ...overrides,
    });

  it("accepts a hash that matches ToyyibPay's formula", () => {
    expect(verifyToyyibPayCallbackHash(secretKey, buildDto())).toBe(true);
  });

  it('rejects a hash computed with the wrong secret key', () => {
    expect(verifyToyyibPayCallbackHash('a-different-secret', buildDto())).toBe(
      false,
    );
  });

  it('rejects a hash that does not match a tampered field', () => {
    expect(
      verifyToyyibPayCallbackHash(
        secretKey,
        buildDto({ status: ToyyibPayCallbackStatus.FAILED }),
      ),
    ).toBe(false);
    expect(
      verifyToyyibPayCallbackHash(
        secretKey,
        buildDto({ order_id: 'order-other' }),
      ),
    ).toBe(false);
    expect(
      verifyToyyibPayCallbackHash(secretKey, buildDto({ refno: 'TP999' })),
    ).toBe(false);
  });

  it('rejects a malformed (non-hex or wrong-length) hash instead of throwing', () => {
    expect(
      verifyToyyibPayCallbackHash(
        secretKey,
        buildDto({ hash: 'not-a-real-hash' }),
      ),
    ).toBe(false);
    expect(verifyToyyibPayCallbackHash(secretKey, buildDto({ hash: '' }))).toBe(
      false,
    );
  });
});
