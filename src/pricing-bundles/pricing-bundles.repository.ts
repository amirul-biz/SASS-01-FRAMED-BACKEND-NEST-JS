import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/database/prisma.service';

const VOUCHER_INCLUDE = { vouchers: { include: { voucher: true } } } as const;

@Injectable()
export class PricingBundlesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForPhotographer(photographerId: string) {
    const bundles = await this.prisma.pricingBundle.findMany({
      where: { photographerId },
      orderBy: { createdAt: 'asc' },
      include: VOUCHER_INCLUDE,
    });
    return Promise.all(bundles.map((bundle) => this.withEventsUsingCount(bundle)));
  }

  async findById(id: string) {
    const bundle = await this.prisma.pricingBundle.findUnique({
      where: { id },
      include: VOUCHER_INCLUDE,
    });
    if (!bundle) return null;
    return this.withEventsUsingCount(bundle);
  }

  create(data: {
    photographerId: string;
    name: string;
    basePrice: number;
    voucherIds: string[];
    fullGalleryEnabled: boolean;
    fullGalleryPrice: number;
  }) {
    const { voucherIds, ...bundleData } = data;
    return this.prisma.pricingBundle.create({
      data: {
        ...bundleData,
        vouchers: { create: voucherIds.map((voucherId) => ({ voucherId })) },
      },
      include: VOUCHER_INCLUDE,
    });
  }

  update(
    id: string,
    data: Partial<{
      name: string;
      basePrice: number;
      voucherIds: string[];
      fullGalleryEnabled: boolean;
      fullGalleryPrice: number;
    }>,
  ) {
    const { voucherIds, ...bundleData } = data;
    return this.prisma.$transaction(async (tx) => {
      if (voucherIds !== undefined) {
        await tx.bundleVoucher.deleteMany({ where: { pricingBundleId: id } });
        await tx.bundleVoucher.createMany({
          data: voucherIds.map((voucherId) => ({ pricingBundleId: id, voucherId })),
        });
      }
      return tx.pricingBundle.update({
        where: { id },
        data: bundleData,
        include: VOUCHER_INCLUDE,
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
