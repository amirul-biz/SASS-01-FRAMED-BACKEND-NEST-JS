import { Module } from '@nestjs/common';
import { PrismaModule } from '../config/database/prisma.module';
import { StorageModule } from '../config/storage/storage.module';
import { EventModule } from '../event/event.module';
import { PhotoController } from './photo.controller';
import { PhotoReconciliationController } from './photo-reconciliation.controller';
import { PhotoReconciliationService } from './photo-reconciliation.service';
import { PhotoRepository } from './photo.repository';
import { PhotoService } from './photo.service';

@Module({
  imports: [PrismaModule, StorageModule, EventModule],
  controllers: [PhotoController, PhotoReconciliationController],
  providers: [PhotoService, PhotoRepository, PhotoReconciliationService],
  exports: [PhotoService],
})
export class PhotoModule {}
