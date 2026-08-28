import { Type } from 'class-transformer';
import {
  IsArray,
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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type WireVoucherDiscountType = 'flat-tier' | 'percent-tier';
export const WIRE_VOUCHER_DISCOUNT_TYPES: WireVoucherDiscountType[] = ['flat-tier', 'percent-tier'];

export class VoucherConditionDto {
  @ApiProperty({ example: 3 })
  @IsInt()
  @IsPositive()
  minPhotos!: number;

  @ApiPropertyOptional({ example: 5, nullable: true })
  @IsOptional()
  @IsInt()
  @IsPositive()
  maxPhotos?: number | null;

  @ApiProperty({ example: 50 })
  @IsNumber()
  @Min(0)
  value!: number;
}

export class CreateVoucherDto {
  @ApiProperty({ example: 'Group Discount' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @ApiProperty({ example: 'percent-tier', enum: WIRE_VOUCHER_DISCOUNT_TYPES })
  @IsIn(WIRE_VOUCHER_DISCOUNT_TYPES)
  discountType!: WireVoucherDiscountType;

  @ApiProperty({ type: [VoucherConditionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VoucherConditionDto)
  conditions!: VoucherConditionDto[];
}

export class UpdateVoucherDto {
  @ApiPropertyOptional({ example: 'Group Discount' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name?: string;

  @ApiPropertyOptional({ example: 'percent-tier', enum: WIRE_VOUCHER_DISCOUNT_TYPES })
  @IsOptional()
  @IsIn(WIRE_VOUCHER_DISCOUNT_TYPES)
  discountType?: WireVoucherDiscountType;

  @ApiPropertyOptional({ type: [VoucherConditionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VoucherConditionDto)
  conditions?: VoucherConditionDto[];
}

export class VoucherResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() photographerId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: WIRE_VOUCHER_DISCOUNT_TYPES }) discountType!: WireVoucherDiscountType;
  @ApiProperty({ type: [VoucherConditionDto] }) conditions!: VoucherConditionDto[];
  @ApiProperty() bundlesUsingCount!: number;
}
