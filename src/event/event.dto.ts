import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventCategory } from '../../generated/prisma/enums';
import { EVENT_PAGINATION } from './event.constants';

export class CreateEventDto {
  @ApiProperty({ example: 'KL Century Ride 2026' })
  @IsString({ message: 'Title must be a string' })
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(255, { message: 'Title must be at most 255 characters' })
  title!: string;

  @ApiPropertyOptional({ example: 'Annual charity cycling event around KL.' })
  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: EventCategory, example: EventCategory.CYCLING })
  @IsEnum(EventCategory, { message: 'Invalid event category' })
  category!: EventCategory;

  @ApiPropertyOptional({ example: 'Dataran Merdeka, Kuala Lumpur' })
  @IsString({ message: 'Location must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'Location must be at most 255 characters' })
  location?: string;

  @ApiProperty({ example: '2026-09-12T00:00:00.000Z' })
  @IsDateString({}, { message: 'Event start date must be a valid date' })
  eventStartDate!: string;

  @ApiProperty({ example: '2026-09-12T23:59:59.000Z' })
  @IsDateString({}, { message: 'Event end date must be a valid date' })
  eventEndDate!: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/events/abc/cover.jpg',
  })
  @IsUrl({}, { message: 'Cover photo URL must be a valid URL' })
  @IsOptional()
  coverPhotoUrl?: string;
}

export class UpdateEventDto {
  @ApiPropertyOptional({ example: 'KL Century Ride 2026' })
  @IsString({ message: 'Title must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'Title must be at most 255 characters' })
  title?: string;

  @ApiPropertyOptional({ example: 'Annual charity cycling event around KL.' })
  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: EventCategory })
  @IsEnum(EventCategory, { message: 'Invalid event category' })
  @IsOptional()
  category?: EventCategory;

  @ApiPropertyOptional({ example: 'Dataran Merdeka, Kuala Lumpur' })
  @IsString({ message: 'Location must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'Location must be at most 255 characters' })
  location?: string;

  @ApiPropertyOptional({ example: '2026-09-12T00:00:00.000Z' })
  @IsDateString({}, { message: 'Event start date must be a valid date' })
  @IsOptional()
  eventStartDate?: string;

  @ApiPropertyOptional({ example: '2026-09-12T23:59:59.000Z' })
  @IsDateString({}, { message: 'Event end date must be a valid date' })
  @IsOptional()
  eventEndDate?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/events/abc/cover.jpg',
  })
  @IsUrl({}, { message: 'Cover photo URL must be a valid URL' })
  @IsOptional()
  coverPhotoUrl?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean({ message: 'isPublished must be a boolean' })
  @IsOptional()
  isPublished?: boolean;
}

export class EventListQueryDto {
  @ApiPropertyOptional({ example: EVENT_PAGINATION.DEFAULT_PAGE_NUMBER })
  @Type(() => Number)
  @IsInt({ message: 'pageNumber must be an integer' })
  @Min(1, { message: 'pageNumber must be at least 1' })
  @IsOptional()
  pageNumber: number = EVENT_PAGINATION.DEFAULT_PAGE_NUMBER;

  @ApiPropertyOptional({ example: EVENT_PAGINATION.DEFAULT_PAGE_SIZE })
  @Type(() => Number)
  @IsInt({ message: 'pageSize must be an integer' })
  @Min(1, { message: 'pageSize must be at least 1' })
  @Max(EVENT_PAGINATION.PAGE_SIZE_MAX, {
    message: `pageSize must be at most ${EVENT_PAGINATION.PAGE_SIZE_MAX}`,
  })
  @IsOptional()
  pageSize: number = EVENT_PAGINATION.DEFAULT_PAGE_SIZE;
}

export class EventResponseDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsString() photographerId!: string;
  @ApiProperty() @IsString() title!: string;
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  description!: string | null;

  @ApiProperty({ enum: EventCategory }) @IsEnum(EventCategory) category!: EventCategory;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  location!: string | null;

  @ApiProperty() @Type(() => Date) @IsDate() eventStartDate!: Date;
  @ApiProperty() @Type(() => Date) @IsDate() eventEndDate!: Date;
  @ApiProperty() @IsBoolean() isPublished!: boolean;

  @ApiPropertyOptional({ nullable: true })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  publishedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  coverPhotoUrl!: string | null;

  @ApiProperty() @Type(() => Date) @IsDate() createdAt!: Date;
  @ApiProperty() @Type(() => Date) @IsDate() updatedAt!: Date;
}

export class PaginatedEventListResponseDto {
  @ApiProperty({ type: [EventResponseDto] })
  @Type(() => EventResponseDto)
  items!: EventResponseDto[];

  @ApiProperty() @IsInt() totalItemCount!: number;
  @ApiProperty() @IsInt() totalPageCount!: number;
  @ApiProperty() @IsInt() pageNumber!: number;
  @ApiProperty() @IsInt() pageSize!: number;
}

const ALLOWED_COVER_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export class PresignEventCoverPhotoUploadDto {
  @ApiProperty({ example: 'cover.jpg' })
  @IsString({ message: 'File name must be a string' })
  @IsNotEmpty({ message: 'File name is required' })
  fileName!: string;

  @ApiProperty({
    example: 'image/jpeg',
    enum: ALLOWED_COVER_PHOTO_MIME_TYPES,
  })
  @IsIn(ALLOWED_COVER_PHOTO_MIME_TYPES, {
    message: `Mime type must be one of: ${ALLOWED_COVER_PHOTO_MIME_TYPES.join(', ')}`,
  })
  mimeType!: string;
}

export class PresignEventCoverPhotoUploadResponseDto {
  @ApiProperty() @IsString() uploadUrl!: string;
  @ApiProperty() @IsString() publicUrl!: string;
  @ApiProperty() @IsString() key!: string;
  @ApiProperty() @IsNumber() expiresIn!: number;
}
