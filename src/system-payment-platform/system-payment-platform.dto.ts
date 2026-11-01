import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider } from '../../generated/prisma/enums';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateToyyibPaySystemAccountDto {
  @ApiProperty({ example: 'arfankareem' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'username is required' })
  username!: string;

  @ApiProperty({ example: 'w5x7srq7-rx5r-3t89-2ou2-k7361x2jewhn' })
  @IsString()
  @IsNotEmpty({ message: 'secretKey is required' })
  secretKey!: string;

  @ApiProperty({
    example: 'abc123xy',
    description:
      'A category on this account, used to verify the secret key with ToyyibPay',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'categoryCode is required' })
  categoryCode!: string;

  @ApiPropertyOptional({
    description: 'Defaults to true when this is the first ToyyibPay account',
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdateToyyibPaySystemAccountDto {
  @ApiPropertyOptional({ example: 'arfankareem' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'username must not be empty' })
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({
    description: 'Omit to keep the stored secret key',
  })
  @IsString()
  @IsNotEmpty({ message: 'secretKey must not be empty' })
  @IsOptional()
  secretKey?: string;

  @ApiPropertyOptional({ example: 'abc123xy' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'categoryCode must not be empty' })
  @IsOptional()
  categoryCode?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

// Never carries a secret key — the ToyyibPay key is write-only.
export class SystemPaymentPlatformDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty({ enum: PaymentProvider })
  @IsEnum(PaymentProvider)
  provider!: PaymentProvider;
  @ApiProperty() @IsBoolean() isDefault!: boolean;
  @ApiProperty() @IsString() accountId!: string;
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  username!: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  categoryCode!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'When ToyyibPay last confirmed the secret key; null = never verified',
  })
  @Type(() => Date)
  verifiedAt!: Date | null;
  @ApiProperty() @Type(() => Date) createdAt!: Date;
}
