import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SampleModule } from './sample/sample.module';
import { PhotographerModule } from './photographer/photographer.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), SampleModule, PhotographerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
