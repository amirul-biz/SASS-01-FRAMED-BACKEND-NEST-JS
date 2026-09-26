import { Controller, Post, UseGuards } from '@nestjs/common';
import { CronSecretGuard } from '../../../../common/guards/cron-secret.guard';
import {
  RedeliverStuckOrdersSummary,
  ToyyibPayOrderDeliverySweepService,
} from './toyyibpay-order-delivery-sweep.service';

@Controller('internal/toyyibpay-orders')
@UseGuards(CronSecretGuard)
export class ToyyibPayOrderDeliverySweepController {
  constructor(
    private readonly toyyibPayOrderDeliverySweepService: ToyyibPayOrderDeliverySweepService,
  ) {}

  @Post('redeliver-stuck')
  async redeliverStuckOrders(): Promise<RedeliverStuckOrdersSummary> {
    return await this.toyyibPayOrderDeliverySweepService.redeliverStuckOrders();
  }
}
