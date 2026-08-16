import { Module } from '@nestjs/common';
import { FirebaseModule } from '../config/firebase/firebase.module';
import { PrismaModule } from '../config/database/prisma.module';
import { StorageModule } from '../config/storage/storage.module';
import { AttachmentQueueModule } from '../config/queue/attachment-queue.module';
import { PhotographerService } from './photographer.service';
import { PhotographerController } from './photographer.controller';
import { PhotographerRepository } from './photographer.repository';

@Module({
  imports: [FirebaseModule, PrismaModule, StorageModule, AttachmentQueueModule],
  controllers: [PhotographerController],
  providers: [PhotographerService, PhotographerRepository],
  exports: [PhotographerService],
})
export class PhotographerModule {}
