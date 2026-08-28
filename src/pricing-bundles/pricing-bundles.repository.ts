import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/database/prisma.service';

const BUNDLE_INCLUDE = {
  vouchers: { include: { voucher: true } },
  pricingOptions: { include: { pricingOption: true } },
} as const;

@Injectable()
export class PricingBundlesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForPhotographer(photographerId: string) {
    const bundles = await this.prisma.pricingBundle.findMany({
      where: { photographerId },
      orderBy: { createdAt: 'asc' },
      include: BUNDLE_INCLUDE,
    });
    return Promise.all(bundles.map((bundle) => this.withEventsUsingCount(bundle)));
  }

  async findById(id: string) {
    const bundle = await this.prisma.pricingBundle.findUnique({
      where: { id },
      include: BUNDLE_INCLUDE,
    });
    if (!bundle) return null;
    return this.withEventsUsingCount(bundle);
  }

  create(data: {
    photographerId: string;
    name: string;
    voucherIds: string[];
    pricingOptionIds: string[];
    fullGalleryEnabled: boolean;
    fullGalleryPrice: number;
  }) {
    const { voucherIds, pricingOptionIds, ...bundleData } = data;
    return this.prisma.pricingBundle.create({
      data: {
        ...bundleData,
        vouchers: { create: voucherIds.map((voucherId) => ({ voucherId })) },
        pricingOptions: {
          create: pricingOptionIds.map((pricingOptionId) => ({ pricingOptionId })),
        },
      },
      include: BUNDLE_INCLUDE,
    });
  }

  update(
    id: string,
    data: Partial<{
      name: string;
      voucherIds: string[];
      pricingOptionIds: string[];
      fullGalleryEnabled: boolean;
      fullGalleryPrice: number;
    }>,
  ) {
    const { voucherIds, pricingOptionIds, ...bundleData } = data;
    return this.prisma.$transaction(async (tx) => {
      if (voucherIds !== undefined) {
        await tx.bundleVoucher.deleteMany({ where: { pricingBundleId: id } });
        await tx.bundleVoucher.createMany({
          data: voucherIds.map((voucherId) => ({ pricingBundleId: id, voucherId })),
        });
      }
      if (pricingOptionIds !== undefined) {
        await tx.bundlePricingOption.deleteMany({ where: { pricingBundleId: id } });
        await tx.bundlePricingOption.createMany({
          data: pricingOptionIds.map((pricingOptionId) => ({ pricingBundleId: id, pricingOptionId })),
        });
      }
      return tx.pricingBundle.update({
        where: { id },
        data: bundleData,
        include: BUNDLE_INCLUDE,
      });
    });
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
