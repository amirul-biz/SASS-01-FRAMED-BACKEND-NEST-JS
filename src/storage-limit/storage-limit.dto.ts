import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

// 10 TB in MB. Keeps limit_mb * 1024 * 1024 well inside a JS safe integer.
const MAX_LIMIT_MB = 10 * 1024 * 1024;

export class CreateStorageLimitDto {
  @ApiProperty({ example: 'Starter 5 GB' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'name is required' })
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 5120, description: 'Limit in MB (1 GB = 1024 MB)' })
  @Type(() => Number)
  @IsInt({ message: 'limitMb must be a whole number of MB' })
  @Min(1, { message: 'limitMb must be at least 1' })
  @Max(MAX_LIMIT_MB)
  limitMb!: number;
}

export class UpdateStorageLimitDto {
  @ApiPropertyOptional({ example: 'Starter 5 GB' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'name must not be empty' })
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 5120 })
  @Type(() => Number)
  @IsInt({ message: 'limitMb must be a whole number of MB' })
  @Min(1, { message: 'limitMb must be at least 1' })
  @Max(MAX_LIMIT_MB)
  @IsOptional()
  limitMb?: number;
}

export class StorageAssignmentQueryDto {
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

export class AssignStorageLimitDto {
  @ApiProperty({
    nullable: true,
    description: 'Storage limit id, or null to remove the limit (unlimited)',
  })
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  storageLimitId!: string | null;
}

export class StorageLimitDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() limitMb!: number;
  @ApiProperty() assignmentCount!: number;
  @ApiProperty() createdAt!: Date;
}

export class StorageAssignmentRowDto {
  @ApiProperty() photographerId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiProperty() usedBytes!: number;
  @ApiProperty({ nullable: true }) storageLimitId!: string | null;
  @ApiProperty({ nullable: true }) storageLimitName!: string | null;
  @ApiProperty({ nullable: true }) limitMb!: number | null;
}

export class PaginatedStorageAssignmentsDto {
  @ApiProperty({ type: [StorageAssignmentRowDto] })
  items!: StorageAssignmentRowDto[];
  @ApiProperty() totalItemCount!: number;
}
