import { Module } from '@nestjs/common';
import { FirebaseModule } from '../config/firebase/firebase.module';
import { PrismaModule } from '../config/database/prisma.module';
import { StorageModule } from '../config/storage/storage.module';
import { PhotographerService } from './photographer.service';
import { PhotographerController } from './photographer.controller';
import { PhotographerRepository } from './photographer.repository';

@Module({
  imports: [FirebaseModule, PrismaModule, StorageModule],
  controllers: [PhotographerController],
  providers: [PhotographerService, PhotographerRepository],
  exports: [PhotographerService],
})
export class PhotographerModule {}
