import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../config/database/prisma.module';
import { CommissionModule } from '../../../commission/commission-config/commission.module';
import { MerchantPaymentPlatformModule } from '../../../merchant-payment-platform/merchant-payment-platform.module';
import { ToyyibPayPaymentConfigModule } from '../../../merchant-payment-platform/toyyibpay-payment-platform/toyyibpay-payment-config/toyyibpay-payment-config.module';
import { MerchantOrderPaymentModule } from '../../merchant-order-payment.module';
import { ToyyibPayPrePaymentModule } from '../pre-payment/toyyibpay-pre-payment.module';
import { ToyyibPayPaymentFinalizationService } from './finalization/toyyibpay-payment-finalization.service';
import { ToyyibPayOrderDeliverySweepController } from './sync/toyyibpay-order-delivery-sweep.controller';
import { ToyyibPayOrderDeliverySweepService } from './sync/toyyibpay-order-delivery-sweep.service';
import { ToyyibPayPaymentResyncController } from './sync/toyyibpay-payment-resync.controller';
import { ToyyibPayPaymentReturnController } from './sync/toyyibpay-payment-return.controller';
import { ToyyibPayPaymentSyncController } from './sync/toyyibpay-payment-sync.controller';
import { ToyyibPayPaymentSyncRepository } from './sync/toyyibpay-payment-sync.repository';
import { ToyyibPayPaymentSyncService } from './sync/toyyibpay-payment-sync.service';
import { ToyyibPayWebhookController } from './webhook/toyyibpay-webhook.controller';
import { ToyyibPayWebhookRepository } from './webhook/toyyibpay-webhook.repository';
import { ToyyibPayWebhookService } from './webhook/toyyibpay-webhook.service';

@Module({
  imports: [
    PrismaModule,
    MerchantOrderPaymentModule,
    CommissionModule,
    MerchantPaymentPlatformModule,
    ToyyibPayPaymentConfigModule,
    ToyyibPayPrePaymentModule,
  ],
  controllers: [
    ToyyibPayWebhookController,
    ToyyibPayPaymentSyncController,
    ToyyibPayPaymentResyncController,
    ToyyibPayPaymentReturnController,
    ToyyibPayOrderDeliverySweepController,
  ],
  providers: [
    ToyyibPayWebhookService,
    ToyyibPayWebhookRepository,
    ToyyibPayPaymentFinalizationService,
    ToyyibPayPaymentSyncService,
    ToyyibPayPaymentSyncRepository,
    ToyyibPayOrderDeliverySweepService,
  ],
})
export class ToyyibPayPostPaymentModule {}
