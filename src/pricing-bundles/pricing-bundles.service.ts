import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PricingBundlesRepository } from './pricing-bundles.repository';
import {
  BundleTierDto,
  PricingBundleResponseDto,
  WireBundleModel,
} from './pricing-bundles.dto';
import { BundleModel, Prisma } from '../../generated/client';

const TO_PRISMA_MODEL: Record<WireBundleModel, BundleModel> = {
  'flat-tier': BundleModel.FLAT_TIER,
  'percent-tier': BundleModel.PERCENT_TIER,
  none: BundleModel.NONE,
};

const TO_WIRE_MODEL: Record<BundleModel, WireBundleModel> = {
  [BundleModel.FLAT_TIER]: 'flat-tier',
  [BundleModel.PERCENT_TIER]: 'percent-tier',
  [BundleModel.NONE]: 'none',
};

interface BundleInput {
  name: string;
  basePrice: number;
  bundleModel: WireBundleModel;
  bundleTiers: BundleTierDto[];
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
      basePrice: input.basePrice,
      bundleModel: TO_PRISMA_MODEL[input.bundleModel],
      bundleTiers: input.bundleTiers as unknown as Prisma.InputJsonValue,
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
      basePrice: changes.basePrice,
      bundleModel: changes.bundleModel ? TO_PRISMA_MODEL[changes.bundleModel] : undefined,
      bundleTiers: changes.bundleTiers as unknown as Prisma.InputJsonValue | undefined,
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
    basePrice: { toString(): string };
    bundleModel: BundleModel;
    bundleTiers: unknown;
    fullGalleryEnabled: boolean;
    fullGalleryPrice: { toString(): string };
    eventsUsingCount: number;
  }): PricingBundleResponseDto {
    return {
      id: bundle.id,
      photographerId: bundle.photographerId,
      name: bundle.name,
      basePrice: Number(bundle.basePrice),
      bundleModel: TO_WIRE_MODEL[bundle.bundleModel],
      bundleTiers: bundle.bundleTiers as BundleTierDto[],
      fullGalleryEnabled: bundle.fullGalleryEnabled,
      fullGalleryPrice: Number(bundle.fullGalleryPrice),
      eventsUsingCount: bundle.eventsUsingCount,
    };
  }
}