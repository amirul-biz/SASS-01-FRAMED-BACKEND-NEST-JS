import { Module } from '@nestjs/common';
import { PrismaModule } from '../config/database/prisma.module';
import { MerchantPaymentPlatformController } from './merchant-payment-platform.controller';
import { MerchantPaymentPlatformRepository } from './merchant-payment-platform.repository';
import { MerchantPaymentPlatformService } from './merchant-payment-platform.service';

@Module({
  imports: [PrismaModule],
  controllers: [MerchantPaymentPlatformController],
  providers: [
    MerchantPaymentPlatformService,
    MerchantPaymentPlatformRepository,
  ],
  exports: [MerchantPaymentPlatformService, MerchantPaymentPlatformRepository],
})
export class MerchantPaymentPlatformModule {}
