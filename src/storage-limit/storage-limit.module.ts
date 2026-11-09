import { Module } from '@nestjs/common';
import { PrismaModule } from '../config/database/prisma.module';
import { StorageLimitController } from './storage-limit.controller';
import { StorageLimitRepository } from './storage-limit.repository';
import { StorageLimitService } from './storage-limit.service';

@Module({
  imports: [PrismaModule],
  controllers: [StorageLimitController],
  providers: [StorageLimitService, StorageLimitRepository],
  exports: [StorageLimitService],
})
export class StorageLimitModule {}
