import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  CommissionStatementStatus,
  UserRole,
} from '../../../generated/prisma/enums';
import type { CommissionDisplayStatus } from './commission-statement.period';

const ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;

export class PresignCommissionAttachmentDto {
  @ApiProperty({ example: 'receipt.pdf' })
  @IsString()
  @IsNotEmpty({ message: 'File name is required' })
  fileName!: string;

  @ApiProperty({ enum: ATTACHMENT_MIME_TYPES })
  @IsIn(ATTACHMENT_MIME_TYPES, {
    message: `Mime type must be one of: ${ATTACHMENT_MIME_TYPES.join(', ')}`,
  })
  mimeType!: string;
}

export class ConfirmCommissionAttachmentDto extends PresignCommissionAttachmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  key!: string;
}

export class UpdateCommissionStatementDto {
  @ApiProperty({ enum: CommissionStatementStatus })
  @IsEnum(CommissionStatementStatus)
  status!: CommissionStatementStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class AdminCommissionStatementQueryDto {
  @ApiProperty({ example: '2026-11' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Period must be YYYY-MM' })
  period!: string;

  @ApiPropertyOptional({ enum: ['ACCRUING', 'DUE', 'OVERDUE', 'PAID'] })
  @IsOptional()
  @IsIn(['ACCRUING', 'DUE', 'OVERDUE', 'PAID'])
  status?: CommissionDisplayStatus;
}

export class PresignCommissionAttachmentResponseDto {
  @ApiProperty() uploadUrl!: string;
  @ApiProperty() key!: string;
  @ApiProperty() expiresIn!: number;
}

export class CommissionAttachmentDto {
  @ApiProperty() id!: string;
  @ApiProperty() fileName!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() url!: string;
  @ApiProperty({ enum: UserRole }) uploadedByRole!: UserRole;
  @ApiProperty() createdAt!: Date;
}

export class CommissionStatementDto {
  @ApiProperty({ example: '2026-11' }) period!: string;
  @ApiProperty() amount!: number;
  @ApiProperty({ enum: ['ACCRUING', 'DUE', 'OVERDUE', 'PAID'] })
  status!: CommissionDisplayStatus;
  @ApiPropertyOptional({ nullable: true }) paidAt!: Date | null;
  @ApiPropertyOptional({ nullable: true }) notes!: string | null;
  @ApiProperty({ type: [CommissionAttachmentDto] })
  attachments!: CommissionAttachmentDto[];
}

export class AdminCommissionStatementDto extends CommissionStatementDto {
  @ApiProperty() photographerId!: string;
  @ApiProperty() photographerName!: string;
  @ApiProperty() photographerEmail!: string;
}

export class CurrentCommissionDto {
  @ApiProperty({ example: '2026-11' }) period!: string;
  @ApiProperty() amount!: number;
}
