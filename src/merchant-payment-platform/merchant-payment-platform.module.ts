import { Module } from '@nestjs/common';
import { PrismaModule } from '../config/database/prisma.module';
import { MerchantPaymentPlatformApprovalController } from './merchant-payment-platform-approval.controller';
import { MerchantPaymentPlatformController } from './merchant-payment-platform.controller';
import { MerchantPaymentPlatformRepository } from './merchant-payment-platform.repository';
import { MerchantPaymentPlatformService } from './merchant-payment-platform.service';
import { ToyyibPayApiClient } from './toyyibpay-payment-platform/toyyibpay-payment-config/toyyibpay-api.client';

@Module({
  imports: [PrismaModule],
  controllers: [
    MerchantPaymentPlatformController,
    MerchantPaymentPlatformApprovalController,
  ],
  // ToyyibPayApiClient is stateless, so this instance and the one in ToyyibPayPaymentConfigModule
  // are interchangeable.
  providers: [
    MerchantPaymentPlatformService,
    MerchantPaymentPlatformRepository,
    ToyyibPayApiClient,
  ],
  exports: [MerchantPaymentPlatformService, MerchantPaymentPlatformRepository],
})
export class MerchantPaymentPlatformModule {}
