import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ApprovalStatus,
  CommissionType,
  PaymentProvider,
} from '../../../generated/prisma/enums';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

// Largest value the Decimal(10, 2) column holds. Percentage types are capped at 100 in the service,
// since that depends on the plan type.
const MAX_COMMISSION_VALUE = 99999999.99;

export class CreateCommissionPlanDto {
  @ApiProperty({ example: 'Standard Platform Commission' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'name is required' })
  name!: string;

  @ApiProperty({ enum: CommissionType })
  @IsEnum(CommissionType, { message: 'type must be a valid commission type' })
  type!: CommissionType;

  @ApiProperty({
    example: 10,
    description:
      'Percentage (0.01-100) for the PERCENTAGE_* types, RM amount for the AMOUNT_* types',
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'value must have at most 2 decimals' },
  )
  @Min(0.01, { message: 'value must be greater than 0' })
  @Max(MAX_COMMISSION_VALUE)
  value!: number;

  @ApiProperty({
    enum: PaymentProvider,
    description:
      'Every plan belongs to exactly one provider; only Cash and ToyyibPay are in use',
  })
  @IsEnum(PaymentProvider)
  provider!: PaymentProvider;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

// type and provider are deliberately not editable: assignments and past charges point at the plan.
export class UpdateCommissionPlanDto {
  @ApiPropertyOptional({ example: 'Standard Platform Commission' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'name must not be empty' })
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 10 })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'value must have at most 2 decimals' },
  )
  @Min(0.01, { message: 'value must be greater than 0' })
  @Max(MAX_COMMISSION_VALUE)
  @IsOptional()
  value?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class AssignCommissionPlanDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'commissionPlanId is required' })
  commissionPlanId!: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'ToyyibPay system account id to split the commission to. Omit or null to turn split payment off',
  })
  @IsString()
  @IsOptional()
  splitSystemAccountId?: string | null;
}

export class CommissionAssignmentQueryDto {
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

export class CommissionPlanDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiProperty({ enum: CommissionType })
  @IsEnum(CommissionType)
  type!: CommissionType;
  @ApiPropertyOptional({ enum: PaymentProvider, nullable: true })
  @IsEnum(PaymentProvider)
  @IsOptional()
  provider!: PaymentProvider | null;
  @ApiProperty() @IsBoolean() isDefault!: boolean;
  @ApiProperty() @IsBoolean() isActive!: boolean;
  @ApiProperty() @Type(() => Number) @IsNumber() value!: number;
  @ApiProperty() @IsInt() assignmentCount!: number;
  @ApiProperty() @Type(() => Date) createdAt!: Date;
}

export class CommissionAssignmentRowDto {
  @ApiProperty() @IsString() paymentPlatformOptionId!: string;
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
  commissionPlanId!: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  commissionPlanName!: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  splitSystemAccountId!: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  splitUsername!: string | null;
}

export class PaginatedCommissionAssignmentsDto {
  @ApiProperty({ type: [CommissionAssignmentRowDto] })
  @Type(() => CommissionAssignmentRowDto)
  @ValidateNested({ each: true })
  items!: CommissionAssignmentRowDto[];

  @ApiProperty() @IsInt() totalItemCount!: number;
}

export class CommissionReportQueryDto {
  @ApiProperty({ enum: PaymentProvider })
  @IsEnum(PaymentProvider, { message: 'provider must be a valid provider' })
  provider!: PaymentProvider;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: 'Inclusive: a bare date covers that whole day',
  })
  @IsDateString()
  @IsOptional()
  to?: string;
}

export class CommissionReportChargeRowDto {
  @ApiProperty() @IsString() paymentId!: string;
  @ApiProperty() @IsString() orderId!: string;
  @ApiProperty() @IsString() eventTitle!: string;
  @ApiProperty() @Type(() => Date) paidAt!: Date;
  @ApiProperty() @Type(() => Number) @IsNumber() paidAmount!: number;
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  planName!: string | null;
  @ApiPropertyOptional({ enum: CommissionType, nullable: true })
  @IsEnum(CommissionType)
  @IsOptional()
  commissionType!: CommissionType | null;
  @ApiProperty() @Type(() => Number) @IsNumber() baseAmount!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() commissionAmount!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() recomputedAmount!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() delta!: number;
  @ApiProperty() @IsBoolean() isReconciled!: boolean;
}

export class CommissionReportPhotographerRowDto {
  @ApiProperty() @IsString() photographerId!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiProperty() @IsInt() orderCount!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() grossPaid!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() commission!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() delta!: number;
  @ApiProperty() @IsBoolean() isReconciled!: boolean;
  @ApiProperty({ type: [CommissionReportChargeRowDto] })
  @Type(() => CommissionReportChargeRowDto)
  @ValidateNested({ each: true })
  charges!: CommissionReportChargeRowDto[];
}

export class CommissionReportPeriodCheckDto {
  @ApiProperty() @Type(() => Number) @IsNumber() grossFromRows!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() grossFromDb!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() commissionFromRows!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() commissionFromDb!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() delta!: number;
  @ApiProperty() @IsBoolean() isReconciled!: boolean;
}

export class CommissionReportResponseDto {
  @ApiProperty({ type: [CommissionReportPhotographerRowDto] })
  @Type(() => CommissionReportPhotographerRowDto)
  @ValidateNested({ each: true })
  rows!: CommissionReportPhotographerRowDto[];

  @ApiProperty() @Type(() => Number) @IsNumber() totalGrossPaid!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() totalCommission!: number;

  @ApiProperty({ type: CommissionReportPeriodCheckDto })
  @Type(() => CommissionReportPeriodCheckDto)
  @ValidateNested()
  periodCheck!: CommissionReportPeriodCheckDto;

  @ApiProperty({
    type: [String],
    description: 'Orders with more than one PAID payment in the period',
  })
  duplicatePaidOrderIds!: string[];
}
