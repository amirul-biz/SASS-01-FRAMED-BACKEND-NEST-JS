import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MerchantPaymentPlatformOptionDto } from '../merchant-payment-platform.dto';

export class CreateCashPaymentPlatformOptionDto {
  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isDefaultPaymentPlatform?: boolean;
}

export class UpdateCashPaymentPlatformOptionDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isDefaultPaymentPlatform?: boolean;
}

export class CashPaymentPlatformOptionResponseDto extends MerchantPaymentPlatformOptionDto {}
