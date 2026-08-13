import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePricingOptionDto {
  @ApiProperty({ example: '30MP JPEG' })
  @IsString()
  @IsNotEmpty({ message: 'Label is required' })
  label!: string;

  @ApiProperty({ example: 12 })
  @IsNumber()
  @IsPositive({ message: 'Price must be greater than zero' })
  price!: number;
}

export class UpdatePricingOptionDto {
  @ApiProperty({ example: '30MP JPEG', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Label is required' })
  label?: string;

  @ApiProperty({ example: 12, required: false })
  @IsOptional()
  @IsNumber()
  @IsPositive({ message: 'Price must be greater than zero' })
  price?: number;
}

export class PricingOptionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() photographerId!: string;
  @ApiProperty() label!: string;
  @ApiProperty() price!: number;
}