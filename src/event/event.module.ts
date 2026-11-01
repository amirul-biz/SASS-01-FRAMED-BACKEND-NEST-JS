import { Module } from '@nestjs/common';
import { PrismaModule } from '../config/database/prisma.module';
import { StorageModule } from '../config/storage/storage.module';
import { PhotographerModule } from '../photographer/photographer.module';
import { EventController } from './event.controller';
import { EventExpiryController } from './event-expiry.controller';
import { EventRepository } from './event.repository';
import { EventService } from './event.service';

@Module({
  imports: [PrismaModule, StorageModule, PhotographerModule],
  controllers: [EventController, EventExpiryController],
  providers: [EventService, EventRepository],
  exports: [EventService],
})
export class EventModule {}
