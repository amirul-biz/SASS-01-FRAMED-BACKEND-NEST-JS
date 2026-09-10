import { Module } from '@nestjs/common';
import { PrismaModule } from '../config/database/prisma.module';
import { StorageModule } from '../config/storage/storage.module';
import { EventModule } from '../event/event.module';
import { PhotographerModule } from '../photographer/photographer.module';
import { OrderController } from './order.controller';
import { OrderRepository } from './order.repository';
import { OrderService } from './order.service';

@Module({
  imports: [PrismaModule, StorageModule, EventModule, PhotographerModule],
  controllers: [OrderController],
  providers: [OrderService, OrderRepository],
})
export class OrderModule {}
