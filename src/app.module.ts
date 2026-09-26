import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { CommonModule } from './common/common.module';
import { ClientModule } from './client/client.module';
import { FirebaseModule } from './config/firebase/firebase.module';
import { EventModule } from './event/event.module';
import { PhotographerModule } from './photographer/photographer.module';
import { PricingOptionsModule } from './pricing-options/pricing-options.module';
import { PricingBundlesModule } from './pricing-bundles/pricing-bundles.module';
import { VouchersModule } from './vouchers/vouchers.module';
import { PhotoModule } from './photo/photo.module';
import { OrderModule } from './order/order.module';
import { SampleModule } from './sample/sample.module';
import { UsersModule } from './users/users.module';
import { MerchantPaymentPlatformModule } from './merchant-payment-platform/merchant-payment-platform.module';
import { CashPaymentPlatformModule } from './merchant-payment-platform/cash-payment-platform/cash-payment-platform.module';
import { ToyyibPayPaymentConfigModule } from './merchant-payment-platform/toyyibpay-payment-platform/toyyibpay-payment-config/toyyibpay-payment-config.module';
import { MerchantOrderPaymentModule } from './merchant-order-payment/merchant-order-payment.module';
import { CashOrderPaymentModule } from './merchant-order-payment/cash-order-payment/cash-order-payment.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FirebaseModule,
    CommonModule,
    SampleModule,
    PhotographerModule,
    PricingOptionsModule,
    PricingBundlesModule,
    VouchersModule,
    EventModule,
    PhotoModule,
    OrderModule,
    UsersModule,
    ClientModule,
    AdminModule,
    MerchantPaymentPlatformModule,
    CashPaymentPlatformModule,
    ToyyibPayPaymentConfigModule,
    MerchantOrderPaymentModule,
    CashOrderPaymentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
