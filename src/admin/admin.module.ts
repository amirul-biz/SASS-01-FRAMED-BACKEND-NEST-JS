import { Module } from '@nestjs/common';
import { FirebaseModule } from '../config/firebase/firebase.module';
import { PrismaModule } from '../config/database/prisma.module';
import { StorageModule } from '../config/storage/storage.module';
import { PhotographerModule } from '../photographer/photographer.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [FirebaseModule, PrismaModule, StorageModule, PhotographerModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
