import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { VouchersRepository } from './vouchers.repository';
import { VoucherConditionDto, VoucherResponseDto, WireVoucherDiscountType } from './vouchers.dto';
import { VoucherDiscountType, Prisma } from '../../generated/prisma/client';

const TO_PRISMA_TYPE: Record<WireVoucherDiscountType, VoucherDiscountType> = {
  'flat-tier': VoucherDiscountType.FLAT_TIER,
  'percent-tier': VoucherDiscountType.PERCENT_TIER,
};

const TO_WIRE_TYPE: Record<VoucherDiscountType, WireVoucherDiscountType> = {
  [VoucherDiscountType.FLAT_TIER]: 'flat-tier',
  [VoucherDiscountType.PERCENT_TIER]: 'percent-tier',
};

interface VoucherInput {
  name: string;
  discountType: WireVoucherDiscountType;
  conditions: VoucherConditionDto[];
}

@Injectable()
export class VouchersService {
  constructor(private readonly repository: VouchersRepository) {}

  async list(photographerId: string): Promise<VoucherResponseDto[]> {
    const vouchers = await this.repository.findAllForPhotographer(photographerId);
    return vouchers.map((voucher) => this.toResponse(voucher));
  }

  async findOne(photographerId: string, id: string): Promise<VoucherResponseDto> {
    const voucher = await this.assertOwnedByPhotographer(photographerId, id);
    return this.toResponse(voucher);
  }

  async create(photographerId: string, input: VoucherInput): Promise<VoucherResponseDto> {
    const voucher = await this.repository.create({
      photographerId,
      name: input.name,
      discountType: TO_PRISMA_TYPE[input.discountType],
      conditions: input.conditions as unknown as Prisma.InputJsonValue,
    });
    return this.toResponse({ ...voucher, bundlesUsingCount: 0 });
  }

  async update(
    photographerId: string,
    id: string,
    changes: Partial<VoucherInput>,
  ): Promise<VoucherResponseDto> {
    const existing = await this.assertOwnedByPhotographer(photographerId, id);
    const voucher = await this.repository.update(id, {
      name: changes.name,
      discountType: changes.discountType ? TO_PRISMA_TYPE[changes.discountType] : undefined,
      conditions: changes.conditions as unknown as Prisma.InputJsonValue | undefined,
    });
    return this.toResponse({ ...voucher, bundlesUsingCount: existing.bundlesUsingCount });
  }

  async remove(photographerId: string, id: string): Promise<void> {
    const voucher = await this.assertOwnedByPhotographer(photographerId, id);
    if (voucher.bundlesUsingCount > 0) {
      throw new ConflictException(
        `Cannot delete: ${voucher.bundlesUsingCount} bundle(s) still use this voucher`,
      );
    }
    await this.repository.delete(id);
  }

  private async assertOwnedByPhotographer(photographerId: string, id: string) {
    const voucher = await this.repository.findById(id);
    if (!voucher || voucher.photographerId !== photographerId) {
      throw new NotFoundException('Voucher not found');
    }
    return voucher;
  }

  private toResponse(voucher: {
    id: string;
    photographerId: string;
    name: string;
    discountType: VoucherDiscountType;
    conditions: unknown;
    bundlesUsingCount: number;
  }): VoucherResponseDto {
    return {
      id: voucher.id,
      photographerId: voucher.photographerId,
      name: voucher.name,
      discountType: TO_WIRE_TYPE[voucher.discountType],
      conditions: voucher.conditions as VoucherConditionDto[],
      bundlesUsingCount: voucher.bundlesUsingCount,
    };
  }
}
