import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventCategory } from '../../generated/prisma/enums';
import { PricingOptionSummaryDto, VoucherSummaryDto } from '../pricing-bundles/pricing-bundles.dto';
import { CLIENT_EVENTS_PAGINATION } from './client.constants';

export class ClientLatestEventDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsString() title!: string;
  @ApiProperty({ enum: EventCategory }) @IsEnum(EventCategory) category!: EventCategory;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  location!: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  coverPhotoUrl!: string | null;

  @ApiProperty() @Type(() => Date) @IsDate() eventStartDate!: Date;
  @ApiProperty() @Type(() => Date) @IsDate() eventEndDate!: Date;
  @ApiProperty() @IsInt() photoCount!: number;
  @ApiProperty() @IsString() photographerId!: string;
  @ApiProperty() @IsString() photographerName!: string;
}

export class ClientEventListQueryDto {
  @ApiPropertyOptional({ description: 'Filter by event name' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    example: '2026-09-12',
    description: 'Filter to events happening on or after this date',
  })
  @IsDateString({}, { message: 'dateFrom must be a valid date' })
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({
    example: '2026-09-20',
    description: 'Filter to events happening on or before this date',
  })
  @IsDateString({}, { message: 'dateTo must be a valid date' })
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() photographerId?: string;

  @ApiPropertyOptional({ example: CLIENT_EVENTS_PAGINATION.DEFAULT_PAGE_NUMBER })
  @Type(() => Number)
  @IsInt({ message: 'pageNumber must be an integer' })
  @Min(1, { message: 'pageNumber must be at least 1' })
  @IsOptional()
  pageNumber: number = CLIENT_EVENTS_PAGINATION.DEFAULT_PAGE_NUMBER;

  @ApiPropertyOptional({ example: CLIENT_EVENTS_PAGINATION.DEFAULT_PAGE_SIZE })
  @Type(() => Number)
  @IsInt({ message: 'pageSize must be an integer' })
  @Min(1, { message: 'pageSize must be at least 1' })
  @Max(CLIENT_EVENTS_PAGINATION.PAGE_SIZE_MAX, {
    message: `pageSize must be at most ${CLIENT_EVENTS_PAGINATION.PAGE_SIZE_MAX}`,
  })
  @IsOptional()
  pageSize: number = CLIENT_EVENTS_PAGINATION.DEFAULT_PAGE_SIZE;
}

export class PaginatedClientEventListResponseDto {
  @ApiProperty({ type: [ClientLatestEventDto] })
  @Type(() => ClientLatestEventDto)
  items!: ClientLatestEventDto[];

  @ApiProperty() @IsInt() totalItemCount!: number;
  @ApiProperty() @IsInt() totalPageCount!: number;
  @ApiProperty() @IsInt() pageNumber!: number;
  @ApiProperty() @IsInt() pageSize!: number;
}

export class ClientPhotographerListQueryDto {
  @ApiPropertyOptional({ description: 'Filter by photographer name' })
  @IsString()
  @IsOptional()
  search?: string;
}

export class ClientTopPhotographerDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsString() name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  bio!: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  profileImageUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  bannerUrl!: string | null;

  @ApiProperty() @IsInt() eventCount!: number;
}

export class ClientPhotographerProfileDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsString() name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  bio!: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  profileImageUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  bannerUrl!: string | null;

  @ApiProperty() @Type(() => Date) @IsDate() createdAt!: Date;
  @ApiProperty() @IsInt() eventCount!: number;
  @ApiProperty() @IsInt() photoCount!: number;

  @ApiPropertyOptional({ enum: EventCategory, nullable: true })
  @IsEnum(EventCategory)
  @IsOptional()
  topCategory!: EventCategory | null;
}

export class ClientEventPricingBundleDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiProperty() @IsBoolean() fullGalleryEnabled!: boolean;
  @ApiProperty() @IsNumber() fullGalleryPrice!: number;

  @ApiProperty({ type: [PricingOptionSummaryDto] })
  @ValidateNested({ each: true })
  @Type(() => PricingOptionSummaryDto)
  pricingOptions!: PricingOptionSummaryDto[];

  @ApiProperty({ type: [VoucherSummaryDto] })
  @ValidateNested({ each: true })
  @Type(() => VoucherSummaryDto)
  vouchers!: VoucherSummaryDto[];
}

export class ClientEventDetailDto extends ClientLatestEventDto {
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  description!: string | null;

  @ApiProperty({ type: [ClientEventPricingBundleDto] })
  @ValidateNested({ each: true })
  @Type(() => ClientEventPricingBundleDto)
  pricingBundles!: ClientEventPricingBundleDto[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  albumCoverPhotoUrls!: string[];
}

export class ClientEventPhotoDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsString() originalName!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  url!: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsInt() @IsOptional() width!: number | null;
  @ApiPropertyOptional({ nullable: true }) @IsInt() @IsOptional() height!: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Type(() => Date)
  @IsOptional()
  capturedAt!: Date | null;
}

export class ClientEventPhotoListQueryDto {
  @ApiPropertyOptional({ example: CLIENT_EVENTS_PAGINATION.DEFAULT_PAGE_NUMBER })
  @Type(() => Number)
  @IsInt({ message: 'pageNumber must be an integer' })
  @Min(1, { message: 'pageNumber must be at least 1' })
  @IsOptional()
  pageNumber: number = CLIENT_EVENTS_PAGINATION.DEFAULT_PAGE_NUMBER;

  @ApiPropertyOptional({ example: CLIENT_EVENTS_PAGINATION.DEFAULT_PAGE_SIZE })
  @Type(() => Number)
  @IsInt({ message: 'pageSize must be an integer' })
  @Min(1, { message: 'pageSize must be at least 1' })
  @Max(CLIENT_EVENTS_PAGINATION.PAGE_SIZE_MAX, {
    message: `pageSize must be at most ${CLIENT_EVENTS_PAGINATION.PAGE_SIZE_MAX}`,
  })
  @IsOptional()
  pageSize: number = CLIENT_EVENTS_PAGINATION.DEFAULT_PAGE_SIZE;
}

export class PaginatedClientEventPhotoListResponseDto {
  @ApiProperty({ type: [ClientEventPhotoDto] })
  @Type(() => ClientEventPhotoDto)
  items!: ClientEventPhotoDto[];

  @ApiProperty() @IsInt() totalItemCount!: number;
  @ApiProperty() @IsInt() totalPageCount!: number;
  @ApiProperty() @IsInt() pageNumber!: number;
  @ApiProperty() @IsInt() pageSize!: number;
}

export class ClientHomeResponseDto {
  @ApiProperty({ type: [ClientLatestEventDto] })
  @Type(() => ClientLatestEventDto)
  latestEvents!: ClientLatestEventDto[];

  @ApiProperty({ type: [ClientTopPhotographerDto] })
  @Type(() => ClientTopPhotographerDto)
  topPhotographers!: ClientTopPhotographerDto[];
}
