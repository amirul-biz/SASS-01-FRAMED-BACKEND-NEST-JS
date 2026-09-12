import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminRegisterPhotographerDto {
  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({ example: 'securePass123', minLength: 6 })
  @IsString({ message: 'Password must be a string' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password!: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @ApiPropertyOptional({ example: 'Jane Lens Studio' })
  @IsString({ message: 'Company name must be a string' })
  @IsOptional()
  companyName?: string;

  @ApiPropertyOptional({ example: '60123456789' })
  @IsString({ message: 'Phone must be a string' })
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'Sports and events photographer.' })
  @IsString({ message: 'Bio must be a string' })
  @IsOptional()
  bio?: string;
}

export class AdminSetPhotographerStatusDto {
  @ApiProperty({ example: false, description: 'true = activate login, false = deactivate (blocks login)' })
  @IsBoolean()
  isActive!: boolean;
}

export class AdminPhotographerListQueryDto {
  @ApiPropertyOptional({ description: 'Filter by photographer name or email' })
  @IsString()
  @IsOptional()
  search?: string;
}

export class AdminPhotographerDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsString() email!: string;
  @ApiProperty() @IsString() name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  companyName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  contactNo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  profileImageUrl!: string | null;

  @ApiProperty({ description: 'true = account enabled in Firebase Auth (can log in)' })
  @IsBoolean()
  isActive!: boolean;

  @ApiProperty() @IsInt() eventCount!: number;

  @ApiProperty() @Type(() => Date) @IsDate() createdAt!: Date;
}

export class AdminPaginatedPhotographersDto {
  @ApiProperty({ type: [AdminPhotographerDto] })
  @Type(() => AdminPhotographerDto)
  @ValidateNested({ each: true })
  items!: AdminPhotographerDto[];

  @ApiProperty() @IsInt() totalItemCount!: number;
}

export class AdminEventsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by event title' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by photographer profile id' })
  @IsString()
  @IsOptional()
  photographerId?: string;

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

export class AdminEventDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsString() title!: string;
  @ApiProperty() @IsString() category!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  location!: string | null;

  @ApiProperty() @IsString() photographerId!: string;
  @ApiProperty() @IsString() photographerName!: string;
  @ApiProperty() @IsBoolean() isPublished!: boolean;
  @ApiProperty() @IsInt() photoCount!: number;
  @ApiProperty() @IsInt() orderCount!: number;

  @ApiProperty() @Type(() => Date) @IsDate() eventStartDate!: Date;
  @ApiProperty() @Type(() => Date) @IsDate() eventEndDate!: Date;
}

export class AdminPaginatedEventsDto {
  @ApiProperty({ type: [AdminEventDto] })
  @Type(() => AdminEventDto)
  @ValidateNested({ each: true })
  items!: AdminEventDto[];

  @ApiProperty() @IsInt() totalItemCount!: number;
}

export class AdminOrdersQueryDto {
  @ApiPropertyOptional({ description: 'Filter orders by event id' })
  @IsString()
  @IsOptional()
  eventId?: string;

  @ApiPropertyOptional({ enum: ['PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED'] })
  @IsIn(['PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED'])
  @IsOptional()
  status?: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED';

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

export class AdminOrderItemDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsString() photoName!: string;
  @ApiProperty() @IsString() formatLabel!: string;
  @ApiProperty() @Type(() => Number) @IsNumber() price!: number;
}

export class AdminOrderDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsString() eventId!: string;
  @ApiProperty() @IsString() eventTitle!: string;
  @ApiProperty() @IsString() email!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  voucherName!: string | null;

  @ApiProperty() @IsString() status!: string;
  @ApiProperty() @Type(() => Number) @IsNumber() total!: number;

  @ApiProperty({ type: [AdminOrderItemDto] })
  @Type(() => AdminOrderItemDto)
  @ValidateNested({ each: true })
  @IsArray()
  @ArrayMaxSize(200)
  items!: AdminOrderItemDto[];

  @ApiProperty() @Type(() => Date) @IsDate() createdAt!: Date;
}

export class AdminPaginatedOrdersDto {
  @ApiProperty({ type: [AdminOrderDto] })
  @Type(() => AdminOrderDto)
  @ValidateNested({ each: true })
  items!: AdminOrderDto[];

  @ApiProperty() @IsInt() totalItemCount!: number;
}

export class AdminDailyStatDto {
  @ApiProperty({ example: '2026-09-09' })
  @IsString()
  date!: string;

  @ApiProperty() @IsInt() photosUploaded!: number;
  @ApiProperty() @IsInt() eventsCreated!: number;
  @ApiProperty() @IsInt() photographersRegistered!: number;
  @ApiProperty() @IsInt() orders!: number;
}

export class AdminStatsDto {
  @ApiProperty() @IsInt() totalPhotosUploaded!: number;
  @ApiProperty() @IsInt() totalEventsPublished!: number;
  @ApiProperty() @IsInt() totalEvents!: number;
  @ApiProperty() @IsInt() totalPhotographers!: number;
  @ApiProperty() @IsInt() totalOrders!: number;
  @ApiProperty() @IsNumber() totalRevenue!: number;
  @ApiProperty() @IsInt() activePhotographers!: number;
  @ApiProperty() @IsInt() inactivePhotographers!: number;

  @ApiProperty({ type: [AdminDailyStatDto] })
  @Type(() => AdminDailyStatDto)
  @ValidateNested({ each: true })
  daily!: AdminDailyStatDto[];
}
