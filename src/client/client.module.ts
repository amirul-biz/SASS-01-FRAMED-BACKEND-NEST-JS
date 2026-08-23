import { Module } from '@nestjs/common';
import { EventModule } from '../event/event.module';
import { PhotographerModule } from '../photographer/photographer.module';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';

@Module({
  imports: [EventModule, PhotographerModule],
  controllers: [ClientController],
  providers: [ClientService],
})
export class ClientModule {}
