import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/database/prisma.service';
import { BundleModel, Prisma } from '../../generated/client';

@Injectable()
export class PricingBundlesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForPhotographer(photographerId: string) {
    const bundles = await this.prisma.pricingBundle.findMany({
      where: { photographerId },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(bundles.map((bundle) => this.withEventsUsingCount(bundle)));
  }

  async findById(id: string) {
    const bundle = await this.prisma.pricingBundle.findUnique({ where: { id } });
    if (!bundle) return null;
    return this.withEventsUsingCount(bundle);
  }

  create(data: {
    photographerId: string;
    name: string;
    basePrice: number;
    bundleModel: BundleModel;
    bundleTiers: Prisma.InputJsonValue;
    fullGalleryEnabled: boolean;
    fullGalleryPrice: number;
  }) {
    return this.prisma.pricingBundle.create({ data });
  }

  update(
    id: string,
    data: Partial<{
      name: string;
      basePrice: number;
      bundleModel: BundleModel;
      bundleTiers: Prisma.InputJsonValue;
      fullGalleryEnabled: boolean;
      fullGalleryPrice: number;
    }>,
  ) {
    return this.prisma.pricingBundle.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.pricingBundle.delete({ where: { id } });
  }

  countEventsUsing(pricingBundleId: string): Promise<number> {
    return this.prisma.eventPricingBundle.count({ where: { pricingBundleId } });
  }

  private async withEventsUsingCount<T extends { id: string }>(bundle: T) {
    const eventsUsingCount = await this.countEventsUsing(bundle.id);
    return { ...bundle, eventsUsingCount };
  }
}