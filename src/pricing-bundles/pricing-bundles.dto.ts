import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export type WireBundleModel = 'flat-tier' | 'percent-tier' | 'none';
export const WIRE_BUNDLE_MODELS: WireBundleModel[] = ['flat-tier', 'percent-tier', 'none'];

export class BundleTierDto {
  @ApiProperty({ example: 5 })
  @IsInt()
  @IsPositive()
  minQuantity!: number;

  @ApiProperty({ example: 30 })
  @IsNumber()
  @Min(0)
  value!: number;
}

export class CreatePricingBundleDto {
  @ApiProperty({ example: 'Standard Bundle' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @ApiProperty({ example: 15 })
  @IsNumber()
  @Min(0)
  basePrice!: number;

  @ApiProperty({ example: 'flat-tier', enum: WIRE_BUNDLE_MODELS })
  @IsIn(WIRE_BUNDLE_MODELS)
  bundleModel!: WireBundleModel;

  @ApiProperty({ type: [BundleTierDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BundleTierDto)
  bundleTiers!: BundleTierDto[];

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

  @ApiProperty({ example: 15, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @ApiProperty({ example: 'flat-tier', enum: WIRE_BUNDLE_MODELS, required: false })
  @IsOptional()
  @IsIn(WIRE_BUNDLE_MODELS)
  bundleModel?: WireBundleModel;

  @ApiProperty({ type: [BundleTierDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BundleTierDto)
  bundleTiers?: BundleTierDto[];

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

export class PricingBundleResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() photographerId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() basePrice!: number;
  @ApiProperty({ enum: WIRE_BUNDLE_MODELS }) bundleModel!: WireBundleModel;
  @ApiProperty({ type: [BundleTierDto] }) bundleTiers!: BundleTierDto[];
  @ApiProperty() fullGalleryEnabled!: boolean;
  @ApiProperty() fullGalleryPrice!: number;
  @ApiProperty() eventsUsingCount!: number;
}