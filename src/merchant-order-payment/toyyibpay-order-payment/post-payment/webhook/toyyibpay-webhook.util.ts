import { createHash, timingSafeEqual } from 'node:crypto';
import type { ToyyibPayWebhookCallbackDto } from './toyyibpay-webhook.dto';

// Per ToyyibPay's docs: MD5(userSecretKey + status + order_id + refno + "ok"). This is the only
// proof the callback actually came from ToyyibPay and wasn't forged by hitting the public webhook
// URL directly — must be checked before any of the payload is trusted.
export function verifyToyyibPayCallbackHash(
  secretKey: string,
  dto: ToyyibPayWebhookCallbackDto,
): boolean {
  const expectedHash = createHash('md5')
    .update(secretKey + dto.status + dto.order_id + dto.refno + 'ok')
    .digest('hex');

  const expected = Buffer.from(expectedHash, 'hex');
  const received = Buffer.from(dto.hash, 'hex');
  const isSameLength = expected.length === received.length;
  if (!isSameLength) {
    return false;
  }
  return timingSafeEqual(expected, received);
}
