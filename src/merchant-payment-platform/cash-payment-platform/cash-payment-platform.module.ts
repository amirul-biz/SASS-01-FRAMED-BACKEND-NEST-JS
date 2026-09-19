import { Module } from '@nestjs/common';
import { PrismaModule } from '../../config/database/prisma.module';
import { MerchantPaymentPlatformModule } from '../merchant-payment-platform.module';
import { CashPaymentPlatformController } from './cash-payment-platform.controller';
import { CashPaymentPlatformRepository } from './cash-payment-platform.repository';
import { CashPaymentPlatformService } from './cash-payment-platform.service';

@Module({
  imports: [PrismaModule, MerchantPaymentPlatformModule],
  controllers: [CashPaymentPlatformController],
  providers: [CashPaymentPlatformService, CashPaymentPlatformRepository],
})
export class CashPaymentPlatformModule {}
