import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { FirebaseModule } from './config/firebase/firebase.module';
import { EventModule } from './event/event.module';
import { PhotographerModule } from './photographer/photographer.module';
import { SampleModule } from './sample/sample.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FirebaseModule,
    CommonModule,
    SampleModule,
    PhotographerModule,
    EventModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
