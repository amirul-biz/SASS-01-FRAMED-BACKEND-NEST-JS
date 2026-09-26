import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  OrderStatus,
  PaymentBillStatus,
  PaymentProvider,
} from '../../../generated/prisma/enums';

export class MarkCashPaymentAsPaidDto {
  @ApiPropertyOptional({ example: 'Received cash at the event' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string;
}

export class CashOrderPaymentResponseDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsString() orderId!: string;
  @ApiProperty({ enum: PaymentProvider }) provider!: PaymentProvider;
  @ApiProperty({ enum: PaymentBillStatus }) status!: PaymentBillStatus;
  @ApiProperty() @IsNumber() amount!: number;
  @ApiProperty({ enum: OrderStatus }) orderStatus!: OrderStatus;
}
