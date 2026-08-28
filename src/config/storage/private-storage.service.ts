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
}
