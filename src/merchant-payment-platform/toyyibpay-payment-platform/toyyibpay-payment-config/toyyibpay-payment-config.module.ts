import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../config/database/prisma.module';
import { MerchantPaymentPlatformModule } from '../../merchant-payment-platform.module';
import { ToyyibPayApiClient } from './toyyibpay-api.client';
import { ToyyibPayPaymentConfigController } from './toyyibpay-payment-config.controller';
import { ToyyibPayPaymentConfigRepository } from './toyyibpay-payment-config.repository';
import { ToyyibPayPaymentConfigService } from './toyyibpay-payment-config.service';

@Module({
  imports: [PrismaModule, MerchantPaymentPlatformModule],
  controllers: [ToyyibPayPaymentConfigController],
  providers: [
    ToyyibPayPaymentConfigService,
    ToyyibPayPaymentConfigRepository,
    ToyyibPayApiClient,
  ],
  exports: [ToyyibPayPaymentConfigService, ToyyibPayApiClient],
})
export class ToyyibPayPaymentConfigModule {}
