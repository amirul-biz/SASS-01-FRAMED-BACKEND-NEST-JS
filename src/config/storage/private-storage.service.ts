import { Injectable } from '@nestjs/common';
import { BaseStorageService } from './base-storage.service';

/**
 * Stores client-purchased photo deliverables and anything else requiring
 * access control — reads/writes only ever go through presigned URLs.
 */
@Injectable()
export class PrivateStorageService extends BaseStorageService {
  constructor() {
    super(
      process.env.R2_PRIVATE_BUCKET_NAME,
      'R2_PRIVATE_BUCKET_NAME',
      process.env.R2_PRIVATE_BUCKET_URL,
      'R2_PRIVATE_BUCKET_URL',
    );
  }

  // Customer-facing photo delivery (the post-payment receipt/images pages) deliberately points at
  // its own env var rather than reusing buildPublicUrl's R2_PRIVATE_BUCKET_URL — same bucket today
  // (both resolve to the same local dev URL), but production will front this one with a real CDN/
  // delivery domain without touching what the photographer's Studio view or the checkout response
  // resolve to. Falls back to R2_PRIVATE_BUCKET_URL if unset, so a missing env var degrades to
  // today's behavior instead of breaking photo delivery outright.
  buildDeliveryUrl(key: string): string {
    const baseUrl =
      process.env.R2_ATTACHMENT_DELIVERY_URL ??
      process.env.R2_PRIVATE_BUCKET_URL;
    if (!baseUrl) {
      throw new Error(
        'Neither R2_ATTACHMENT_DELIVERY_URL nor R2_PRIVATE_BUCKET_URL is configured.',
      );
    }
    return `${baseUrl.replace(/\/$/, '')}/${key}`;
  }
}
