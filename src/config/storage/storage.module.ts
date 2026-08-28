import { Module } from '@nestjs/common';
import { PrivateStorageService } from './private-storage.service';
import { PublicStorageService } from './public-storage.service';

@Module({
  providers: [PrivateStorageService, PublicStorageService],
  exports: [PrivateStorageService, PublicStorageService],
})
export class StorageModule {}
