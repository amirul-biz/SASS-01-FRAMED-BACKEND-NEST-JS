import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CountryCode, OrderStatus } from '../../generated/prisma/enums';

export class CreateOrderItemDto {
  @ApiProperty({ example: 'e91a5108-699c-4fd8-8ef9-98f0813de6a2' })
  @IsString()
  @IsNotEmpty({ message: 'photoId is required' })
  photoId!: string;

  @ApiProperty({ example: 'Full Resolution' })
  @IsString()
  @IsNotEmpty({ message: 'formatLabel is required' })
  formatLabel!: string;

  @ApiProperty({ example: 23 })
  @IsNumber()
  @Min(0)
  price!: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: '9d96e851-1f27-4b39-a3dd-caaba639eb39' })
  @IsString()
  @IsNotEmpty({ message: 'eventId is required' })
  eventId!: string;

  @ApiProperty({ example: 'rider@example.com' })
  @IsEmail({}, { message: 'A valid email is required' })
  email!: string;

  @ApiProperty({ enum: CountryCode, example: CountryCode.MALAYSIA })
  @IsEnum(CountryCode, { message: 'countryCode must be one of: MALAYSIA, SINGAPORE' })
  countryCode!: CountryCode;

  @ApiProperty({ example: '12 345 6789' })
  @IsString()
  @IsNotEmpty({ message: 'phone is required' })
  phone!: string;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  @ArrayMinSize(1, { message: 'At least one photo is required' })
  items!: CreateOrderItemDto[];

  @ApiProperty({ example: 46 })
  @IsNumber()
  @Min(0)
  subtotal!: number;

  @ApiProperty({ example: 2.3 })
  @IsNumber()
  @Min(0)
  discountAmount!: number;

  @ApiProperty({ example: 43.7 })
  @IsNumber()
  @Min(0)
  total!: number;

  @ApiPropertyOptional({ example: '9d96e851-1f27-4b39-a3dd-caaba639eb39' })
  @IsUUID()
  @IsOptional()
  voucherId?: string;

  @ApiPropertyOptional({ example: 'Standard Voucher' })
  @IsString()
  @IsOptional()
  voucherName?: string;
}

export class OrderItemResponseDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsString() photoId!: string;
  @ApiProperty() @IsString() formatLabel!: string;
  @ApiProperty() @IsNumber() price!: number;
}

export class PriceBreakdownDto {
  @ApiProperty() @IsNumber() subtotal!: number;
  @ApiProperty() @IsNumber() discountAmount!: number;
  @ApiProperty() @IsNumber() total!: number;
}

export class OrderResponseDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsString() eventId!: string;
  @ApiProperty() @IsString() email!: string;
  @ApiProperty({ enum: CountryCode }) countryCode!: CountryCode;
  @ApiProperty() @IsString() phone!: string;
  @ApiProperty() @IsNumber() subtotal!: number;
  @ApiProperty() @IsNumber() discountAmount!: number;
  @ApiProperty() @IsNumber() total!: number;
  @ApiProperty({ type: PriceBreakdownDto }) priceBreakdown!: PriceBreakdownDto;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  voucherId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  voucherName!: string | null;

  @ApiProperty({ enum: OrderStatus }) status!: OrderStatus;
  @ApiProperty() @Type(() => Date) createdAt!: Date;

  @ApiProperty({ type: [OrderItemResponseDto] })
  @Type(() => OrderItemResponseDto)
  items!: OrderItemResponseDto[];
}
