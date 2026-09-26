import { Module } from '@nestjs/common';
import { ToyyibPayPrePaymentModule } from './pre-payment/toyyibpay-pre-payment.module';
import { ToyyibPayPostPaymentModule } from './post-payment/toyyibpay-post-payment.module';

@Module({
  imports: [ToyyibPayPrePaymentModule, ToyyibPayPostPaymentModule],
  exports: [ToyyibPayPrePaymentModule],
})
export class ToyyibPayOrderPaymentModule {}
