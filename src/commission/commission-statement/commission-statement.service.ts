import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { sanitizeFileName } from 'src/common/utils/sanitize-file-name';
import { UserRole } from '../../../generated/prisma/enums';
import { PrivateStorageService } from '../../config/storage/private-storage.service';
import { PhotographerService } from '../../photographer/photographer.service';
import type { AuthenticatedUser } from '../../types/express';
import {
  AdminCommissionStatementDto,
  AdminCommissionStatementQueryDto,
  CommissionStatementDto,
  ConfirmCommissionAttachmentDto,
  CurrentCommissionDto,
  PresignCommissionAttachmentDto,
  PresignCommissionAttachmentResponseDto,
  UpdateCommissionStatementDto,
} from './commission-statement.dto';
import {
  displayStatus,
  parsePeriod,
  periodKey,
  periodOf,
} from './commission-statement.period';
import {
  CommissionStatementRepository,
  type StatementWithAttachments,
} from './commission-statement.repository';

const UPLOAD_URL_TTL_SECONDS = 300;

@Injectable()
export class CommissionStatementService {
  constructor(
    private readonly repository: CommissionStatementRepository,
    private readonly photographerService: PhotographerService,
    private readonly privateStorageService: PrivateStorageService,
  ) {}

  // ---- photographer ----

  async getCurrent(user: AuthenticatedUser): Promise<CurrentCommissionDto> {
    const photographerId =
      await this.photographerService.getOwnPhotographerProfileId(user);
    const period = periodOf(new Date());
    const [owed] = await this.repository.getOwed({ photographerId, period });
    return { period: periodKey(period), amount: owed?.amount ?? 0 };
  }

  async listMine(user: AuthenticatedUser): Promise<CommissionStatementDto[]> {
    const photographerId =
      await this.photographerService.getOwnPhotographerProfileId(user);
    const [owedRows, statements] = await Promise.all([
      this.repository.getOwed({ photographerId }),
      this.repository.getStatements({ photographerId }),
    ]);
    return this.merge(owedRows, statements)
      .map(({ dto }) => dto)
      .sort((a, b) => b.period.localeCompare(a.period));
  }

  async presignMyAttachment(
    user: AuthenticatedUser,
    periodParam: string,
    dto: PresignCommissionAttachmentDto,
  ): Promise<PresignCommissionAttachmentResponseDto> {
    const photographerId =
      await this.photographerService.getOwnPhotographerProfileId(user);
    parsePeriod(periodParam);
    return await this.presign(photographerId, dto);
  }

  async addMyAttachment(
    user: AuthenticatedUser,
    periodParam: string,
    dto: ConfirmCommissionAttachmentDto,
  ): Promise<void> {
    const photographerId =
      await this.photographerService.getOwnPhotographerProfileId(user);
    const period = parsePeriod(periodParam);
    const [existing] = await this.repository.getStatements({
      photographerId,
      period,
    });
    if (existing?.status === 'PAID') {
      throw new ConflictException(
        'This month is already marked as paid. Contact support to add more files.',
      );
    }
    await this.addAttachment(photographerId, period, dto, UserRole.PHOTOGRAPHER);
  }

  // ---- admin ----

  async listForAdmin(
    query: AdminCommissionStatementQueryDto,
  ): Promise<AdminCommissionStatementDto[]> {
    const period = parsePeriod(query.period);
    const [owedRows, statements] = await Promise.all([
      this.repository.getOwed({ period }),
      this.repository.getStatements({ period }),
    ]);
    const merged = this.merge(owedRows, statements);
    const photographers = new Map(
      (
        await this.repository.getPhotographers(
          merged.map((row) => row.photographerId),
        )
      ).map((p) => [p.id, p]),
    );

    // ponytail: status filter runs after the fetch; fine at this photographer count, push into SQL if it grows
    return merged
      .filter((row) => !query.status || row.dto.status === query.status)
      .map(({ photographerId, dto }) => ({
        ...dto,
        photographerId,
        photographerName: photographers.get(photographerId)?.name ?? '—',
        photographerEmail: photographers.get(photographerId)?.email ?? '',
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  async updateStatement(
    adminUserId: string,
    photographerId: string,
    periodParam: string,
    dto: UpdateCommissionStatementDto,
  ): Promise<void> {
    const period = parsePeriod(periodParam);
    await this.assertPhotographer(photographerId);

    if (dto.status === 'PAID') {
      const [owed] = await this.repository.getOwed({ photographerId, period });
      await this.repository.upsertStatement(photographerId, period, {
        status: 'PAID',
        amountPaid: owed?.amount ?? 0,
        paidAt: new Date(),
        markedByUserId: adminUserId,
        notes: dto.notes,
      });
      return;
    }
    await this.repository.upsertStatement(photographerId, period, {
      status: 'UNPAID',
      amountPaid: null,
      paidAt: null,
      markedByUserId: adminUserId,
      notes: dto.notes,
    });
  }

  async presignAdminAttachment(
    photographerId: string,
    periodParam: string,
    dto: PresignCommissionAttachmentDto,
  ): Promise<PresignCommissionAttachmentResponseDto> {
    parsePeriod(periodParam);
    await this.assertPhotographer(photographerId);
    return await this.presign(photographerId, dto);
  }

  async addAdminAttachment(
    photographerId: string,
    periodParam: string,
    dto: ConfirmCommissionAttachmentDto,
  ): Promise<void> {
    const period = parsePeriod(periodParam);
    await this.assertPhotographer(photographerId);
    await this.addAttachment(photographerId, period, dto, UserRole.ADMIN);
  }

  // ---- shared ----

  private async assertPhotographer(photographerId: string): Promise<void> {
    if (!(await this.repository.photographerExists(photographerId))) {
      throw new NotFoundException('Photographer not found');
    }
  }

  private async presign(
    photographerId: string,
    dto: PresignCommissionAttachmentDto,
  ): Promise<PresignCommissionAttachmentResponseDto> {
    // ponytail: no server-side size cap on the presigned PUT; add a content-length condition if abused
    const key = `commission-statements/${photographerId}/${randomUUID()}-${sanitizeFileName(dto.fileName)}`;
    const uploadUrl = await this.privateStorageService.getPresignedUploadUrl({
      key,
      mimeType: dto.mimeType,
      expiresIn: UPLOAD_URL_TTL_SECONDS,
    });
    return { uploadUrl, key, expiresIn: UPLOAD_URL_TTL_SECONDS };
  }

  private async addAttachment(
    photographerId: string,
    period: Date,
    dto: ConfirmCommissionAttachmentDto,
    uploadedByRole: UserRole,
  ): Promise<void> {
    if (!dto.key.startsWith(`commission-statements/${photographerId}/`)) {
      throw new BadRequestException('Invalid attachment key');
    }
    if (!(await this.privateStorageService.objectExists(dto.key))) {
      throw new BadRequestException('File was not uploaded');
    }
    const statement = await this.repository.upsertStatement(
      photographerId,
      period,
    );
    await this.repository.addAttachment(statement.id, {
      key: dto.key,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      uploadedByRole,
    });
  }

  // One entry per photographer-month that has either owed commission or a saved statement.
  private merge(
    owedRows: { photographerId: string; period: Date; amount: number }[],
    statements: StatementWithAttachments[],
  ): { photographerId: string; dto: CommissionStatementDto }[] {
    const now = new Date();
    const slot = (photographerId: string, period: Date) =>
      `${photographerId}|${periodKey(period)}`;
    const owedBySlot = new Map(
      owedRows.map((row) => [slot(row.photographerId, row.period), row]),
    );
    const statementBySlot = new Map(
      statements.map((s) => [slot(s.photographerId, s.period), s]),
    );

    return [...new Set([...owedBySlot.keys(), ...statementBySlot.keys()])].map(
      (key) => {
        const owed = owedBySlot.get(key);
        const statement = statementBySlot.get(key);
        const period = (owed?.period ?? statement?.period) as Date;
        const photographerId = (owed?.photographerId ??
          statement?.photographerId) as string;
        const isPaid = statement?.status === 'PAID';
        return {
          photographerId,
          dto: {
            period: periodKey(period),
            // Once paid the frozen figure wins, so later refunds/edits can't change a settled month.
            amount: isPaid
              ? Number(statement.amountPaid ?? 0)
              : (owed?.amount ?? 0),
            status: displayStatus(period, isPaid, now),
            paidAt: statement?.paidAt ?? null,
            notes: statement?.notes ?? null,
            attachments: (statement?.attachments ?? []).map((a) => ({
              id: a.id,
              fileName: a.fileName,
              mimeType: a.mimeType,
              url: this.privateStorageService.buildPublicUrl(a.key),
              uploadedByRole: a.uploadedByRole,
              createdAt: a.createdAt,
            })),
          },
        };
      },
    );
  }
}
