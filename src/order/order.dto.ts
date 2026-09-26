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
import {
  CommissionType,
  CountryCode,
  OrderStatus,
  PaymentBillStatus,
  PaymentProvider,
  TransitionSource,
} from '../../generated/prisma/enums';
import { ORDER_PAGINATION, OrderPaymentTracking } from './order.constants';

export class CreateOrderItemDto {
  @ApiProperty({ example: 'e91a5108-699c-4fd8-8ef9-98f0813de6a2' })
  @IsString()
  @IsNotEmpty({ message: 'photoId is required' })
  photoId!: string;

  @ApiProperty({
    example: '4b1d7c1e-6f7b-4f2a-9d0e-6a1c0d6d2b11',
    description:
      "Id of one of the event's pricing options, as defined by the photographer",
  })
  @IsString()
  @IsNotEmpty({ message: 'pricingOptionId is required' })
  pricingOptionId!: string;

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
  @IsEnum(CountryCode, {
    message: 'countryCode must be one of: MALAYSIA, SINGAPORE',
  })
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

  // Generated once by the client per checkout attempt, reused on retry — lets a retried request
  // return the original order instead of creating a duplicate (and, for ToyyibPay, a duplicate
  // payable bill).
  @ApiProperty({ example: 'b3c1a9e4-5f2d-4a1b-9c3e-7d8f6a2b1c4d' })
  @IsUUID()
  idempotencyKey!: string;
}

export class OrderItemResponseDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsString() photoId!: string;
  @ApiProperty() @IsString() photoName!: string;
  @ApiProperty() @IsString() photoUrl!: string;
  @ApiProperty() @IsString() formatLabel!: string;
  @ApiProperty() @IsNumber() price!: number;
}

export class PriceBreakdownDto {
  @ApiProperty() @IsNumber() subtotal!: number;
  @ApiProperty() @IsNumber() discountAmount!: number;
  @ApiProperty() @IsNumber() total!: number;
}

export class OrderCommissionDto {
  @ApiProperty({ enum: CommissionType }) commissionType!: CommissionType;
  @ApiProperty() @IsNumber() originalPaymentAmount!: number;
  @ApiProperty() @IsNumber() commissionBaseAmount!: number;

  @ApiPropertyOptional({ nullable: true })
  percentageRateApplied!: number | null;
  @ApiPropertyOptional({ nullable: true }) flatAmountApplied!: number | null;
  @ApiPropertyOptional({ nullable: true })
  commissionPerUnitApplied!: number | null;
  @ApiPropertyOptional({ nullable: true }) unitCount!: number | null;
  @ApiPropertyOptional({ nullable: true }) totalUnitCost!: number | null;
  @ApiPropertyOptional({ nullable: true })
  averageCostPerUnit!: number | null;
  @ApiPropertyOptional({ nullable: true })
  averageCommissionPerUnit!: number | null;

  @ApiProperty() @IsNumber() commissionAmount!: number;
  @ApiProperty() @Type(() => Date) commissionImposedAt!: Date;
}

export class OrderPaymentDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty({ enum: PaymentProvider }) provider!: PaymentProvider;
  @ApiProperty({ enum: PaymentBillStatus }) status!: PaymentBillStatus;
  @ApiProperty() @IsNumber() amount!: number;

  @ApiPropertyOptional({ type: OrderCommissionDto, nullable: true })
  @Type(() => OrderCommissionDto)
  commission!: OrderCommissionDto | null;

  // Only set right after checkout for a provider that redirects the customer to pay (ToyyibPay);
  // null for cash and for every later read of the order.
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  paymentUrl!: string | null;
}

export class OrderHistoryEntryDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @Type(() => Date) createdAt!: Date;
  @ApiProperty({ enum: TransitionSource }) source!: TransitionSource;
  @ApiProperty({ enum: PaymentProvider }) provider!: PaymentProvider;

  @ApiPropertyOptional({ enum: PaymentBillStatus, nullable: true })
  fromPaymentStatus!: PaymentBillStatus | null;
  @ApiProperty({ enum: PaymentBillStatus }) toPaymentStatus!: PaymentBillStatus;

  @ApiPropertyOptional({ enum: OrderStatus, nullable: true })
  fromOrderStatus!: OrderStatus | null;
  @ApiProperty({ enum: OrderStatus }) toOrderStatus!: OrderStatus;

  @ApiPropertyOptional({ nullable: true }) note!: string | null;
  @ApiPropertyOptional({ nullable: true }) recordedBy!: string | null;
}

export class OrderHistoryDto {
  @ApiProperty() @IsString() orderId!: string;
  @ApiProperty() @Type(() => Date) orderCreatedAt!: Date;

  @ApiProperty({ type: [OrderHistoryEntryDto] })
  @Type(() => OrderHistoryEntryDto)
  entries!: OrderHistoryEntryDto[];

  @ApiPropertyOptional({ type: OrderCommissionDto, nullable: true })
  @Type(() => OrderCommissionDto)
  commission!: OrderCommissionDto | null;

  @ApiPropertyOptional({ nullable: true })
  billCode!: string | null;
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

  @ApiPropertyOptional({ type: OrderPaymentDto, nullable: true })
  @Type(() => OrderPaymentDto)
  payment!: OrderPaymentDto | null;

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

  @ApiPropertyOptional({
    enum: OrderPaymentTracking,
    description:
      'TRACKED = orders with a payment record, LEGACY = orders without one. Omit for all.',
  })
  @IsEnum(OrderPaymentTracking)
  @IsOptional()
  paymentTracking?: OrderPaymentTracking;
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
