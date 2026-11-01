import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalStatus, PaymentProvider } from '../../generated/prisma/enums';

export class MerchantPaymentPlatformOptionDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty({ enum: PaymentProvider })
  @IsEnum(PaymentProvider)
  provider!: PaymentProvider;
  @ApiProperty() @IsBoolean() isDefaultPaymentPlatform!: boolean;
  @ApiProperty({ enum: ApprovalStatus })
  @IsEnum(ApprovalStatus)
  approvalStatus!: ApprovalStatus;
  @ApiProperty() @IsBoolean() isImposeCommission!: boolean;
  @ApiProperty() @Type(() => Date) createdAt!: Date;
  @ApiProperty() @Type(() => Date) updatedAt!: Date;
}

export class MerchantPaymentPlatformApprovalQueryDto {
  @ApiPropertyOptional({ enum: ApprovalStatus })
  @IsEnum(ApprovalStatus)
  @IsOptional()
  status?: ApprovalStatus;

  @ApiPropertyOptional({ enum: PaymentProvider })
  @IsEnum(PaymentProvider)
  @IsOptional()
  provider?: PaymentProvider;

  @ApiPropertyOptional({ example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'pageNumber must be an integer' })
  @Min(1)
  @IsOptional()
  pageNumber: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @Type(() => Number)
  @IsInt({ message: 'pageSize must be an integer' })
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize: number = 20;
}

export class SetMerchantPaymentPlatformApprovalDto {
  // PENDING is the starting state only — a reviewed option is never sent back to it.
  @ApiProperty({ enum: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED] })
  @IsIn([ApprovalStatus.APPROVED, ApprovalStatus.REJECTED], {
    message: 'status must be APPROVED or REJECTED',
  })
  status!: ApprovalStatus;
}

export class MerchantPaymentPlatformApprovalItemDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty({ enum: PaymentProvider })
  @IsEnum(PaymentProvider)
  provider!: PaymentProvider;
  @ApiProperty({ enum: ApprovalStatus })
  @IsEnum(ApprovalStatus)
  approvalStatus!: ApprovalStatus;
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  photographerName!: string | null;
  @ApiProperty() @IsString() photographerEmail!: string;
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  categoryCode!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'When ToyyibPay last confirmed these credentials; null = never verified',
  })
  @Type(() => Date)
  verifiedAt!: Date | null;
  @ApiProperty() @Type(() => Date) createdAt!: Date;
  @ApiPropertyOptional({ nullable: true })
  @Type(() => Date)
  approvalStatusUpdatedAt!: Date | null;
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  reviewedByName!: string | null;
}

export class PaginatedMerchantPaymentPlatformApprovalDto {
  @ApiProperty({ type: [MerchantPaymentPlatformApprovalItemDto] })
  @Type(() => MerchantPaymentPlatformApprovalItemDto)
  @ValidateNested({ each: true })
  items!: MerchantPaymentPlatformApprovalItemDto[];

  @ApiProperty() @IsInt() totalItemCount!: number;
}
