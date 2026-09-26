import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../config/database/prisma.module';
import { CommissionModule } from '../../../commission/commission-config/commission.module';
import { ToyyibPayPaymentConfigModule } from '../../../merchant-payment-platform/toyyibpay-payment-platform/toyyibpay-payment-config/toyyibpay-payment-config.module';
import { ToyyibPayPrePaymentRepository } from './toyyibpay-pre-payment.repository';
import { ToyyibPayPrePaymentService } from './toyyibpay-pre-payment.service';

@Module({
  imports: [PrismaModule, CommissionModule, ToyyibPayPaymentConfigModule],
  providers: [ToyyibPayPrePaymentService, ToyyibPayPrePaymentRepository],
  exports: [ToyyibPayPrePaymentService, ToyyibPayPrePaymentRepository],
})
export class ToyyibPayPrePaymentModule {}
