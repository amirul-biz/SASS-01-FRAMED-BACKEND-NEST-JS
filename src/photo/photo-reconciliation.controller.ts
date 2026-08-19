import { Controller, Post, UseGuards } from '@nestjs/common';
import { CronSecretGuard } from 'src/common/guards/cron-secret.guard';
import { PhotoReconciliationService, PhotoReconciliationSummary } from './photo-reconciliation.service';

@Controller('internal/photos')
@UseGuards(CronSecretGuard)
export class PhotoReconciliationController {
  constructor(private readonly photoReconciliationService: PhotoReconciliationService) {}

  @Post('reconcile')
  async reconcile(): Promise<PhotoReconciliationSummary> {
    return await this.photoReconciliationService.reconcilePendingPhotos();
  }
}
