import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PhotoUploadStatus } from '../../generated/prisma/enums';
import { PHOTO_ALLOWED_MIME_TYPES, PHOTO_BATCH_MAX_FILES, PHOTO_PAGINATION } from './photo.constants';

export class PresignPhotoFileDto {
  @ApiProperty({ example: 'DSC_0042.jpg' })
  @IsString({ message: 'File name must be a string' })
  @IsNotEmpty({ message: 'File name is required' })
  fileName!: string;

  @ApiProperty({ example: 'image/jpeg', enum: PHOTO_ALLOWED_MIME_TYPES })
  @IsIn(PHOTO_ALLOWED_MIME_TYPES, {
    message: `Mime type must be one of: ${PHOTO_ALLOWED_MIME_TYPES.join(', ')}`,
  })
  mimeType!: string;

  @ApiPropertyOptional({ example: 4_500_000 })
  @IsInt({ message: 'sizeBytes must be an integer' })
  @IsPositive({ message: 'sizeBytes must be positive' })
  @IsOptional()
  sizeBytes?: number;
}

export class PresignPhotosBatchDto {
  @ApiProperty({ type: [PresignPhotoFileDto] })
  @ValidateNested({ each: true })
  @Type(() => PresignPhotoFileDto)
  @ArrayMinSize(1, { message: 'At least one file is required' })
  @ArrayMaxSize(PHOTO_BATCH_MAX_FILES, {
    message: `A batch can contain at most ${PHOTO_BATCH_MAX_FILES} files`,
  })
  files!: PresignPhotoFileDto[];
}

export class PresignedPhotoDto {
  @ApiProperty() @IsString() photoId!: string;
  @ApiProperty() @IsString() uploadUrl!: string;
  @ApiProperty() @IsString() key!: string;
}

export class PresignPhotosBatchResponseDto {
  @ApiProperty({ type: [PresignedPhotoDto] })
  @Type(() => PresignedPhotoDto)
  photos!: PresignedPhotoDto[];

  @ApiProperty() @IsNumber() expiresIn!: number;
}

export class ConfirmPhotoUploadDto {
  @ApiPropertyOptional({ example: 4032 })
  @IsInt({ message: 'width must be an integer' })
  @IsPositive({ message: 'width must be positive' })
  @IsOptional()
  width?: number;

  @ApiPropertyOptional({ example: 3024 })
  @IsInt({ message: 'height must be an integer' })
  @IsPositive({ message: 'height must be positive' })
  @IsOptional()
  height?: number;

  @ApiPropertyOptional({
    example: '2026-07-02T09:08:05.000Z',
    description: "The photo's EXIF capture date, if available",
  })
  @IsDateString({}, { message: 'capturedAt must be a valid date' })
  @IsOptional()
  capturedAt?: string;
}

export class ReuploadPhotoDto {
  @ApiProperty({ example: 'DSC_0042.jpg' })
  @IsString({ message: 'File name must be a string' })
  @IsNotEmpty({ message: 'File name is required' })
  fileName!: string;

  @ApiProperty({ example: 'image/jpeg', enum: PHOTO_ALLOWED_MIME_TYPES })
  @IsIn(PHOTO_ALLOWED_MIME_TYPES, {
    message: `Mime type must be one of: ${PHOTO_ALLOWED_MIME_TYPES.join(', ')}`,
  })
  mimeType!: string;
}

export class ReuploadPhotoResponseDto {
  @ApiProperty({ enum: PhotoUploadStatus }) @IsEnum(PhotoUploadStatus) status!: PhotoUploadStatus;
  @ApiProperty() @IsString() key!: string;

  @ApiPropertyOptional() @IsString() @IsOptional() uploadUrl?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() expiresIn?: number;
}

export class PhotoListQueryDto {
  @ApiPropertyOptional({ enum: PhotoUploadStatus })
  @IsEnum(PhotoUploadStatus, { message: 'Invalid photo status' })
  @IsOptional()
  status?: PhotoUploadStatus;

  @ApiPropertyOptional({ example: PHOTO_PAGINATION.DEFAULT_PAGE_NUMBER })
  @Type(() => Number)
  @IsInt({ message: 'pageNumber must be an integer' })
  @Min(1, { message: 'pageNumber must be at least 1' })
  @IsOptional()
  pageNumber: number = PHOTO_PAGINATION.DEFAULT_PAGE_NUMBER;

  @ApiPropertyOptional({ example: PHOTO_PAGINATION.DEFAULT_PAGE_SIZE })
  @Type(() => Number)
  @IsInt({ message: 'pageSize must be an integer' })
  @Min(1, { message: 'pageSize must be at least 1' })
  @Max(PHOTO_PAGINATION.PAGE_SIZE_MAX, {
    message: `pageSize must be at most ${PHOTO_PAGINATION.PAGE_SIZE_MAX}`,
  })
  @IsOptional()
  pageSize: number = PHOTO_PAGINATION.DEFAULT_PAGE_SIZE;
}

export class PhotoResponseDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsString() eventId!: string;
  @ApiProperty() @IsString() originalName!: string;
  @ApiProperty() @IsString() mimeType!: string;

  @ApiPropertyOptional({ nullable: true }) @IsInt() @IsOptional() sizeBytes!: number | null;
  @ApiPropertyOptional({ nullable: true }) @IsInt() @IsOptional() width!: number | null;
  @ApiPropertyOptional({ nullable: true }) @IsInt() @IsOptional() height!: number | null;

  @ApiProperty({ enum: PhotoUploadStatus }) @IsEnum(PhotoUploadStatus) status!: PhotoUploadStatus;

  @ApiPropertyOptional({ nullable: true, description: 'Only set once status is UPLOADED' })
  @IsString()
  @IsOptional()
  url!: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Type(() => Date)
  @IsOptional()
  uploadedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true, description: 'EXIF capture date, if available' })
  @Type(() => Date)
  @IsOptional()
  capturedAt!: Date | null;

  @ApiProperty() @IsBoolean() isEventAlbumCover!: boolean;

  @ApiProperty() @Type(() => Date) createdAt!: Date;
  @ApiProperty() @Type(() => Date) updatedAt!: Date;
}

export class PaginatedPhotoListResponseDto {
  @ApiProperty({ type: [PhotoResponseDto] })
  @Type(() => PhotoResponseDto)
  items!: PhotoResponseDto[];

  @ApiProperty() @IsInt() totalItemCount!: number;
  @ApiProperty() @IsInt() totalPageCount!: number;
  @ApiProperty() @IsInt() pageNumber!: number;
  @ApiProperty() @IsInt() pageSize!: number;
}
