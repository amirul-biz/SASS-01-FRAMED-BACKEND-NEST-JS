import { Module } from '@nestjs/common';
import { PricingBundlesController } from './pricing-bundles.controller';
import { PricingBundlesService } from './pricing-bundles.service';
import { PricingBundlesRepository } from './pricing-bundles.repository';

@Module({
  controllers: [PricingBundlesController],
  providers: [PricingBundlesService, PricingBundlesRepository],
})
export class PricingBundlesModule {}