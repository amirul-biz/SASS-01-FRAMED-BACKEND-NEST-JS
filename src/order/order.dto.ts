import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CountryCode, OrderStatus } from '../../generated/prisma/enums';
import { ORDER_PAGINATION } from './order.constants';

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

export class OrderListQueryDto {
  @ApiPropertyOptional({ example: ORDER_PAGINATION.DEFAULT_PAGE_NUMBER })
  @Type(() => Number)
  @IsInt({ message: 'pageNumber must be an integer' })
  @Min(1, { message: 'pageNumber must be at least 1' })
  @IsOptional()
  pageNumber: number = ORDER_PAGINATION.DEFAULT_PAGE_NUMBER;

  @ApiPropertyOptional({ example: ORDER_PAGINATION.DEFAULT_PAGE_SIZE })
  @Type(() => Number)
  @IsInt({ message: 'pageSize must be an integer' })
  @Min(1, { message: 'pageSize must be at least 1' })
  @Max(ORDER_PAGINATION.PAGE_SIZE_MAX, {
    message: `pageSize must be at most ${ORDER_PAGINATION.PAGE_SIZE_MAX}`,
  })
  @IsOptional()
  pageSize: number = ORDER_PAGINATION.DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({ example: '9d96e851-1f27-4b39-a3dd-caaba639eb39' })
  @IsUUID()
  @IsOptional()
  eventId?: string;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;
}

export class PhotographerOrderDto extends OrderResponseDto {
  @ApiProperty() @IsString() eventTitle!: string;
}

export class OrderSummaryDto {
  @ApiProperty() @IsInt() totalOrders!: number;
  @ApiProperty() @IsNumber() totalRevenue!: number;
}

export class PaginatedOrderListResponseDto {
  @ApiProperty({ type: [PhotographerOrderDto] })
  @Type(() => PhotographerOrderDto)
  items!: PhotographerOrderDto[];

  @ApiProperty() @IsInt() totalItemCount!: number;
  @ApiProperty() @IsInt() totalPageCount!: number;
  @ApiProperty() @IsInt() pageNumber!: number;
  @ApiProperty() @IsInt() pageSize!: number;

  @ApiProperty({ type: OrderSummaryDto })
  @Type(() => OrderSummaryDto)
  summary!: OrderSummaryDto;
}
