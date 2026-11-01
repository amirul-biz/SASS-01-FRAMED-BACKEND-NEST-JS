import { Controller, Post, UseGuards } from '@nestjs/common';
import { CronSecretGuard } from 'src/common/guards/cron-secret.guard';
import { EventService } from './event.service';

// Called by the external scheduler (same pattern as /internal/photos/reconcile).
@Controller('internal/events')
@UseGuards(CronSecretGuard)
export class EventExpiryController {
  constructor(private readonly eventService: EventService) {}

  @Post('unpublish-expired')
  async unpublishExpired(): Promise<{ unpublished: number }> {
    return await this.eventService.unpublishExpiredEvents();
  }
}
