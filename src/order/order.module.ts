import { Module } from '@nestjs/common';
import { PrismaModule } from '../config/database/prisma.module';
import { StorageModule } from '../config/storage/storage.module';
import { EventModule } from '../event/event.module';
import { MerchantOrderPaymentModule } from '../merchant-order-payment/merchant-order-payment.module';
import { ToyyibPayOrderPaymentModule } from '../merchant-order-payment/toyyibpay-order-payment/toyyibpay-order-payment.module';
import { PhotographerModule } from '../photographer/photographer.module';
import { OrderController } from './order.controller';
import { OrderPricingService } from './order-pricing.service';
import { OrderRepository } from './order.repository';
import { OrderService } from './order.service';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    EventModule,
    PhotographerModule,
    MerchantOrderPaymentModule,
    ToyyibPayOrderPaymentModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, OrderRepository, OrderPricingService],
})
export class OrderModule {}
