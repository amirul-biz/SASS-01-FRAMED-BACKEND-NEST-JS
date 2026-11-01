import { Module } from '@nestjs/common';
import { PrismaModule } from '../config/database/prisma.module';
import { MerchantPaymentPlatformModule } from '../merchant-payment-platform/merchant-payment-platform.module';
import { SystemPaymentPlatformController } from './system-payment-platform.controller';
import { SystemPaymentPlatformRepository } from './system-payment-platform.repository';
import { SystemPaymentPlatformService } from './system-payment-platform.service';

@Module({
  imports: [PrismaModule, MerchantPaymentPlatformModule],
  controllers: [SystemPaymentPlatformController],
  providers: [SystemPaymentPlatformService, SystemPaymentPlatformRepository],
})
export class SystemPaymentPlatformModule {}
