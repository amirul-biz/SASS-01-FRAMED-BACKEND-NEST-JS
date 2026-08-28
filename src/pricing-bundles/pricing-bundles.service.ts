import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PricingBundlesRepository } from './pricing-bundles.repository';
import { PricingBundleResponseDto, PricingOptionSummaryDto, VoucherSummaryDto } from './pricing-bundles.dto';
import { VoucherDiscountType } from '../../generated/prisma/client';
import { VoucherConditionDto, WireVoucherDiscountType } from '../vouchers/vouchers.dto';

const TO_WIRE_VOUCHER_TYPE: Record<VoucherDiscountType, WireVoucherDiscountType> = {
  [VoucherDiscountType.FLAT_TIER]: 'flat-tier',
  [VoucherDiscountType.PERCENT_TIER]: 'percent-tier',
};

interface BundleInput {
  name: string;
  voucherIds: string[];
  pricingOptionIds: string[];
  fullGalleryEnabled: boolean;
  fullGalleryPrice: number;
}

@Injectable()
export class PricingBundlesService {
  constructor(private readonly repository: PricingBundlesRepository) {}

  async list(photographerId: string): Promise<PricingBundleResponseDto[]> {
    const bundles = await this.repository.findAllForPhotographer(photographerId);
    return bundles.map((bundle) => this.toResponse(bundle));
  }

  async findOne(photographerId: string, id: string): Promise<PricingBundleResponseDto> {
    const bundle = await this.assertOwnedByPhotographer(photographerId, id);
    return this.toResponse(bundle);
  }

  async create(
    photographerId: string,
    input: BundleInput,
  ): Promise<PricingBundleResponseDto> {
    const bundle = await this.repository.create({
      photographerId,
      name: input.name,
      voucherIds: input.voucherIds,
      pricingOptionIds: input.pricingOptionIds,
      fullGalleryEnabled: input.fullGalleryEnabled,
      fullGalleryPrice: input.fullGalleryPrice,
    });
    return this.toResponse({ ...bundle, eventsUsingCount: 0 });
  }

  async update(
    photographerId: string,
    id: string,
    changes: Partial<BundleInput>,
  ): Promise<PricingBundleResponseDto> {
    const existing = await this.assertOwnedByPhotographer(photographerId, id);
    const bundle = await this.repository.update(id, {
      name: changes.name,
      voucherIds: changes.voucherIds,
      pricingOptionIds: changes.pricingOptionIds,
      fullGalleryEnabled: changes.fullGalleryEnabled,
      fullGalleryPrice: changes.fullGalleryPrice,
    });
    return this.toResponse({ ...bundle, eventsUsingCount: existing.eventsUsingCount });
  }

  async remove(photographerId: string, id: string): Promise<void> {
    const bundle = await this.assertOwnedByPhotographer(photographerId, id);
    if (bundle.eventsUsingCount > 0) {
      throw new ConflictException(
        `Cannot delete: ${bundle.eventsUsingCount} event(s) still use this bundle`,
      );
    }
    await this.repository.delete(id);
  }

  private async assertOwnedByPhotographer(photographerId: string, id: string) {
    const bundle = await this.repository.findById(id);
    if (!bundle || bundle.photographerId !== photographerId) {
      throw new NotFoundException('Pricing bundle not found');
    }
    return bundle;
  }

  private toResponse(bundle: {
    id: string;
    photographerId: string;
    name: string;
    fullGalleryEnabled: boolean;
    fullGalleryPrice: { toString(): string };
    eventsUsingCount: number;
    vouchers: { voucher: { id: string; name: string; discountType: VoucherDiscountType; conditions: unknown } }[];
    pricingOptions: { pricingOption: { id: string; label: string; price: { toString(): string } } }[];
  }): PricingBundleResponseDto {
    const vouchers: VoucherSummaryDto[] = bundle.vouchers.map(({ voucher }) => ({
      id: voucher.id,
      name: voucher.name,
      discountType: TO_WIRE_VOUCHER_TYPE[voucher.discountType],
      conditions: voucher.conditions as VoucherConditionDto[],
    }));
    const pricingOptions: PricingOptionSummaryDto[] = bundle.pricingOptions.map(({ pricingOption }) => ({
      id: pricingOption.id,
      label: pricingOption.label,
      price: Number(pricingOption.price),
    }));
    return {
      id: bundle.id,
      photographerId: bundle.photographerId,
      name: bundle.name,
      vouchers,
      pricingOptions,
      fullGalleryEnabled: bundle.fullGalleryEnabled,
      fullGalleryPrice: Number(bundle.fullGalleryPrice),
      eventsUsingCount: bundle.eventsUsingCount,
    };
  }
}
