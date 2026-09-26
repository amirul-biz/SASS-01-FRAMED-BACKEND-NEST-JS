import { Module } from '@nestjs/common';
import { PrismaModule } from '../../config/database/prisma.module';
import { CommissionModule } from '../../commission/commission-config/commission.module';
import { MerchantPaymentPlatformModule } from '../../merchant-payment-platform/merchant-payment-platform.module';
import { MerchantOrderPaymentModule } from '../merchant-order-payment.module';
import { CashOrderPaymentController } from './cash-order-payment.controller';
import { CashOrderPaymentRepository } from './cash-order-payment.repository';
import { CashOrderPaymentService } from './cash-order-payment.service';

@Module({
  imports: [
    PrismaModule,
    MerchantPaymentPlatformModule,
    CommissionModule,
    MerchantOrderPaymentModule,
  ],
  controllers: [CashOrderPaymentController],
  providers: [CashOrderPaymentService, CashOrderPaymentRepository],
})
export class CashOrderPaymentModule {}
