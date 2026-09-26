import { Module } from '@nestjs/common';
import { PrismaModule } from '../config/database/prisma.module';
import { EmailModule } from '../email/email.module';
import { OrderDeliveryRepository } from './core/order-delivery/order-delivery.repository';
import { OrderHistoryRepository } from './core/order-history/order-history.repository';
import { OrderHistoryService } from './core/order-history/order-history.service';
import { PayableOptionRepository } from './core/payable-option/payable-option.repository';
import { PayableOptionService } from './core/payable-option/payable-option.service';
import { PaymentTransitionRepository } from './core/payment-transition/payment-transition.repository';

@Module({
  imports: [PrismaModule, EmailModule],
  providers: [
    PaymentTransitionRepository,
    OrderDeliveryRepository,
    OrderHistoryRepository,
    OrderHistoryService,
    PayableOptionRepository,
    PayableOptionService,
  ],
  exports: [
    PaymentTransitionRepository,
    OrderDeliveryRepository,
    OrderHistoryRepository,
    OrderHistoryService,
    PayableOptionRepository,
    PayableOptionService,
  ],
})
export class MerchantOrderPaymentModule {}
