import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MerchantPaymentPlatformOptionDto } from '../../merchant-payment-platform.dto';

export class CreateToyyibPayPaymentConfigOptionDto {
  @ApiProperty({ example: 'gcbhict9' })
  @IsString()
  @IsNotEmpty({ message: 'categoryCode is required' })
  categoryCode!: string;

  @ApiProperty({ example: 'w5x7srq7-rx5r-3t89-2ou2-k7361x2jewhn' })
  @IsString()
  @IsNotEmpty({ message: 'secretKey is required' })
  secretKey!: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  chargeFpxToCustomer?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  chargeToPrepaid?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isDefaultPaymentPlatform?: boolean;
}

export class UpdateToyyibPayPaymentConfigOptionDto {
  @ApiPropertyOptional({ example: 'gcbhict9' })
  @IsString()
  @IsOptional()
  categoryCode?: string;

  @ApiPropertyOptional({ example: 'w5x7srq7-rx5r-3t89-2ou2-k7361x2jewhn' })
  @IsString()
  @IsOptional()
  secretKey?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  chargeFpxToCustomer?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  chargeToPrepaid?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isDefaultPaymentPlatform?: boolean;
}

export class ToyyibPayPaymentConfigOptionResponseDto extends MerchantPaymentPlatformOptionDto {
  @ApiProperty() @IsString() categoryCode!: string;
  @ApiProperty() @IsBoolean() chargeFpxToCustomer!: boolean;
  @ApiProperty() @IsBoolean() chargeToPrepaid!: boolean;
}
