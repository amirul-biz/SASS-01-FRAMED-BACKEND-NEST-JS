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
}
