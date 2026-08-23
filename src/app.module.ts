import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { ClientModule } from './client/client.module';
import { FirebaseModule } from './config/firebase/firebase.module';
import { EventModule } from './event/event.module';
import { PhotographerModule } from './photographer/photographer.module';
import { PricingOptionsModule } from './pricing-options/pricing-options.module';
import { PricingBundlesModule } from './pricing-bundles/pricing-bundles.module';
import { VouchersModule } from './vouchers/vouchers.module';
import { PhotoModule } from './photo/photo.module';
import { SampleModule } from './sample/sample.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FirebaseModule,
    CommonModule,
    SampleModule,
    PhotographerModule,
    PricingOptionsModule,
    PricingBundlesModule,
    VouchersModule,
    EventModule,
    PhotoModule,
    UsersModule,
    ClientModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
