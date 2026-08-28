import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VoucherConditionDto, WIRE_VOUCHER_DISCOUNT_TYPES } from '../vouchers/vouchers.dto';
import type { WireVoucherDiscountType } from '../vouchers/vouchers.dto';

export class CreatePricingBundleDto {
  @ApiProperty({ example: 'Standard Bundle' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @ApiProperty({ type: [String], example: ['voucher-1', 'voucher-2'] })
  @IsArray()
  @IsString({ each: true })
  voucherIds!: string[];

  @ApiProperty({ type: [String], example: ['option-1', 'option-2'] })
  @IsArray()
  @IsString({ each: true })
  pricingOptionIds!: string[];

  @ApiProperty({ example: false })
  @IsBoolean()
  fullGalleryEnabled!: boolean;

  @ApiProperty({ example: 0 })
  @IsNumber()
  @Min(0)
  fullGalleryPrice!: number;
}

export class UpdatePricingBundleDto {
  @ApiProperty({ example: 'Standard Bundle', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name?: string;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  voucherIds?: string[];

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pricingOptionIds?: string[];

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  fullGalleryEnabled?: boolean;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fullGalleryPrice?: number;
}

export class VoucherSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: WIRE_VOUCHER_DISCOUNT_TYPES }) discountType!: WireVoucherDiscountType;
  @ApiProperty({ type: [VoucherConditionDto] }) conditions!: VoucherConditionDto[];
}

export class PricingOptionSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() label!: string;
  @ApiProperty() price!: number;
}

export class PricingBundleResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() photographerId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: [VoucherSummaryDto] }) vouchers!: VoucherSummaryDto[];
  @ApiProperty({ type: [PricingOptionSummaryDto] }) pricingOptions!: PricingOptionSummaryDto[];
  @ApiProperty() fullGalleryEnabled!: boolean;
  @ApiProperty() fullGalleryPrice!: number;
  @ApiProperty() eventsUsingCount!: number;
}
