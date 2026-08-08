import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsBoolean,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterPhotographerInputDto {
  @ApiProperty({
    example: 'jane.doe@example.com',
    description: 'Photographer email address',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    example: 'securePass123',
    minLength: 6,
    description: 'Account password',
  })
  @IsString({ message: 'Password must be a string' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password!: string;

  @ApiProperty({
    example: 'Jane Doe',
    description: 'Photographer display name',
  })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @ApiPropertyOptional({
    example: 'Wedding and portrait photographer with 5 years of experience.',
  })
  @IsString({ message: 'Bio must be a string' })
  @IsOptional()
  bio?: string;

  @ApiPropertyOptional({ example: 'Jane Doe Photography' })
  @IsString({ message: 'Company name must be a string' })
  @IsOptional()
  companyName?: string;

  @ApiPropertyOptional({ example: '+60123456789' })
  @IsString({ message: 'Phone must be a string' })
  @IsOptional()
  phone?: string;
}

export class UserResponseDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsString() firebaseId!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @Type(() => Date) @IsDate() createdAt!: Date;
}

export class UserPlatformResponseDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsString() userId!: string;
  @ApiProperty() @IsString() role!: string;
  @ApiProperty() @Type(() => Date) @IsDate() createdAt!: Date;
}

export class PhotographerProfileResponseDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsString() userPlatformId!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  bio!: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  companyName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  phone!: string | null;
  @ApiProperty() @Type(() => Date) @IsDate() createdAt!: Date;
  @ApiProperty() @Type(() => Date) @IsDate() updatedAt!: Date;
}

export class RegisterPhotographerDataDto {
  @ApiProperty({ type: UserResponseDto })
  @Type(() => UserResponseDto)
  user!: UserResponseDto;

  @ApiProperty({ type: UserPlatformResponseDto })
  @Type(() => UserPlatformResponseDto)
  userPlatform!: UserPlatformResponseDto;

  @ApiProperty({ type: PhotographerProfileResponseDto })
  @Type(() => PhotographerProfileResponseDto)
  photographerProfile!: PhotographerProfileResponseDto;
}

export class RegisterPhotographerOutputDto {
  @ApiProperty() @IsBoolean() success!: boolean;
  @ApiProperty() @IsString() message!: string;

  @ApiProperty({ type: RegisterPhotographerDataDto })
  @Type(() => RegisterPhotographerDataDto)
  data!: RegisterPhotographerDataDto;
}
