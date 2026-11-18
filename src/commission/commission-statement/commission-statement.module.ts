import { Module } from '@nestjs/common';
import { PrismaModule } from '../../config/database/prisma.module';
import { StorageModule } from '../../config/storage/storage.module';
import { PhotographerModule } from '../../photographer/photographer.module';
import {
  CommissionStatementAdminController,
  CommissionStatementController,
} from './commission-statement.controller';
import { CommissionStatementRepository } from './commission-statement.repository';
import { CommissionStatementService } from './commission-statement.service';

@Module({
  imports: [PrismaModule, StorageModule, PhotographerModule],
  controllers: [
    CommissionStatementController,
    CommissionStatementAdminController,
  ],
  providers: [CommissionStatementService, CommissionStatementRepository],
})
export class CommissionStatementModule {}
