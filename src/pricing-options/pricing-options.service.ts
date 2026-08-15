import { Injectable, NotFoundException } from '@nestjs/common';
import { PricingOptionsRepository } from './pricing-options.repository';
import { PricingOptionResponseDto } from './pricing-options.dto';

@Injectable()
export class PricingOptionsService {
  constructor(private readonly repository: PricingOptionsRepository) {}

  async list(photographerId: string): Promise<PricingOptionResponseDto[]> {
    const options = await this.repository.findAllForPhotographer(photographerId);
    return options.map((option) => this.toResponse(option));
  }

  async create(
    photographerId: string,
    input: { label: string; price: number },
  ): Promise<PricingOptionResponseDto> {
    const option = await this.repository.create({
      photographerId,
      label: input.label,
      price: input.price,
    });
    return this.toResponse(option);
  }

  async update(
    photographerId: string,
    id: string,
    changes: { label?: string; price?: number },
  ): Promise<PricingOptionResponseDto> {
    await this.assertOwnedByPhotographer(photographerId, id);
    const option = await this.repository.update(id, changes);
    return this.toResponse(option);
  }

  async remove(photographerId: string, id: string): Promise<void> {
    await this.assertOwnedByPhotographer(photographerId, id);
    await this.repository.delete(id);
  }

  private async assertOwnedByPhotographer(photographerId: string, id: string): Promise<void> {
    const option = await this.repository.findById(id);

    if (!option || option.photographerId !== photographerId) {
      throw new NotFoundException('Pricing option not found');
    }
  }

  private toResponse(option: {
    id: string;
    photographerId: string;
    label: string;
    price: { toString(): string };
  }): PricingOptionResponseDto {
    return {
      id: option.id,
      photographerId: option.photographerId,
      label: option.label,
      price: Number(option.price),
    };
  }
}