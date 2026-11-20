import { Injectable } from '@nestjs/common';
import { BaseStorageService } from './base-storage.service';

/**
 * Stores publicly viewable content — event cover photos, photographer
 * profile images/banners — served directly, no access control needed.
 */
@Injectable()
export class PublicStorageService extends BaseStorageService {
  constructor() {
    super(
      process.env.R2_PUBLIC_BUCKET_NAME,
      'R2_PUBLIC_BUCKET_NAME',
      process.env.R2_PUBLIC_BUCKET_URL,
      'R2_PUBLIC_BUCKET_URL',
    );
  }

  // Gallery previews of private-bucket photos go through the Bunny pull zone (rescale/watermark).
  // Falls back to the public URL so staging/local (one shared bucket) keep working unchanged.
  buildPreviewUrl(key: string): string {
    const base = process.env.PHOTO_CDN_URL;
    return base ? `${base.replace(/\/$/, '')}/${key}` : this.buildPublicUrl(key);
  }
}
