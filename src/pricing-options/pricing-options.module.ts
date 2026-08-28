import { Module } from '@nestjs/common';
import { PricingOptionsController } from './pricing-options.controller';
import { PricingOptionsService } from './pricing-options.service';
import { PricingOptionsRepository } from './pricing-options.repository';

@Module({
  controllers: [PricingOptionsController],
  providers: [PricingOptionsService, PricingOptionsRepository],
})
export class PricingOptionsModule {}