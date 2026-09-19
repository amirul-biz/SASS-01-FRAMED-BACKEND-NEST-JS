import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
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
