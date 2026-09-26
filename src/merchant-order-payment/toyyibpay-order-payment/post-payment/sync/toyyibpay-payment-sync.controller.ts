import { Controller, Post } from '@nestjs/common';
import {
  SyncAllStalePaymentsSummary,
  ToyyibPayPaymentSyncService,
} from './toyyibpay-payment-sync.service';

// Called directly by cron-job.org every 15 minutes — no auth secret for this first round, per
// explicit product decision. Revisit if this ever needs protecting.
@Controller('internal/toyyibpay-payments')
export class ToyyibPayPaymentSyncController {
  constructor(
    private readonly toyyibPayPaymentSyncService: ToyyibPayPaymentSyncService,
  ) {}

  @Post('sync')
  async syncAllStalePayments(): Promise<SyncAllStalePaymentsSummary> {
    return await this.toyyibPayPaymentSyncService.syncAllStalePayments();
  }
}
