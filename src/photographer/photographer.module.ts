import { Module } from '@nestjs/common';
import { FirebaseModule } from '../config/firebase/firebase.module';
import { PrismaModule } from '../config/database/prisma.module';
import { PhotographerService } from './photographer.service';
import { PhotographerController } from './photographer.controller';
import { PhotographerRepository } from './photographer.repository';

@Module({
  imports: [FirebaseModule, PrismaModule],
  controllers: [PhotographerController],
  providers: [PhotographerService, PhotographerRepository],
})
export class PhotographerModule {}
