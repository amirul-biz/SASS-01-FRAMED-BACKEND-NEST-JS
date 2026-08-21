import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../config/storage/storage.service';
import {
  PHOTO_RECONCILIATION_GRACE_MINUTES,
  PHOTO_RECONCILIATION_HARD_FAIL_HOURS,
} from './photo.constants';
import { PhotoRepository } from './photo.repository';

export interface PhotoReconciliationSummary {
  reconciledCount: number;
  uploadedCount: number;
  failedCount: number;
}

@Injectable()
export class PhotoReconciliationService {
  private readonly logger = new Logger(PhotoReconciliationService.name);

  constructor(
    private readonly photoRepository: PhotoRepository,
    private readonly storageService: StorageService,
  ) {}

  async reconcilePendingPhotos(): Promise<PhotoReconciliationSummary> {
    const softCutoff = new Date(Date.now() - PHOTO_RECONCILIATION_GRACE_MINUTES * 60_000);
    const hardCutoff = new Date(
      Date.now() - PHOTO_RECONCILIATION_HARD_FAIL_HOURS * 60 * 60_000,
    );

    const pending = await this.photoRepository.getPendingOlderThan(softCutoff);
    if (pending.length === 0) {
      return { reconciledCount: 0, uploadedCount: 0, failedCount: 0 };
    }

    let uploadedCount = 0;
    let failedCount = 0;

    for (const photo of pending) {
      const existsOnR2 = await this.storageService.objectExists(photo.key);

      if (existsOnR2) {
        await this.photoRepository.updateStatus(photo.id, {
          status: 'UPLOADED',
          uploadedAt: new Date(),
        });
        uploadedCount++;
      } else if (photo.createdAt < hardCutoff) {
        await this.photoRepository.updateStatus(photo.id, { status: 'FAILED' });
        failedCount++;
      }
      // Otherwise: still within the grace-to-hard-cap window — leave PENDING,
      // it'll be reconsidered on the next sweep.
    }

    this.logger.log(
      `Reconciled ${pending.length} pending photo(s): ${uploadedCount} confirmed uploaded, ${failedCount} marked failed.`,
    );

    return { reconciledCount: pending.length, uploadedCount, failedCount };
  }
}
