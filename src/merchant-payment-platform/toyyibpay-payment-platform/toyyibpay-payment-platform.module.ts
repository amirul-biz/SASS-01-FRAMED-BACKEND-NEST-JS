import { Module } from '@nestjs/common';
import { PrismaModule } from '../../config/database/prisma.module';
import { MerchantPaymentPlatformModule } from '../merchant-payment-platform.module';
import { ToyyibPayApiClient } from './toyyibpay-api.client';
import { ToyyibPayPaymentPlatformController } from './toyyibpay-payment-platform.controller';
import { ToyyibPayPaymentPlatformRepository } from './toyyibpay-payment-platform.repository';
import { ToyyibPayPaymentPlatformService } from './toyyibpay-payment-platform.service';

@Module({
  imports: [PrismaModule, MerchantPaymentPlatformModule],
  controllers: [ToyyibPayPaymentPlatformController],
  providers: [
    ToyyibPayPaymentPlatformService,
    ToyyibPayPaymentPlatformRepository,
    ToyyibPayApiClient,
  ],
})
export class ToyyibPayPaymentPlatformModule {}
