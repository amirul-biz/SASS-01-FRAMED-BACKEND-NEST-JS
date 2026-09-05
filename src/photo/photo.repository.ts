import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/config/database/prisma.service';
import type { Photo, Prisma } from '../../generated/prisma/client';
import type { PhotoUploadStatus } from '../../generated/prisma/enums';
import type {
  CreatePendingPhotoData,
  PaginatedPhotos,
  UpdatePhotoStatusData,
} from './photo.interface';

// The frontend sends fromMinute/toMinute already converted to UTC time-of-day (see
// client-event.util.ts's toUtcTimeOfDay), so a range like local 06:00-12:00 (Malaysia, UTC+8)
// arrives as UTC 22:00-04:00 — fromMinute > toMinute, wrapping past midnight. A plain gte/lte AND
// would then never match anything, so a wrapped range is matched as gte OR lte instead.
function buildMinuteOfDayWhere(
  fromMinute: number | undefined,
  toMinute: number | undefined,
): Prisma.PhotoWhereInput {
  if (fromMinute !== undefined && toMinute !== undefined && fromMinute > toMinute) {
    return {
      OR: [{ capturedMinuteOfDay: { gte: fromMinute } }, { capturedMinuteOfDay: { lte: toMinute } }],
    };
  }
  return {
    capturedMinuteOfDay: {
      ...(fromMinute !== undefined && { gte: fromMinute }),
      ...(toMinute !== undefined && { lte: toMinute }),
    },
  };
}

@Injectable()
export class PhotoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createManyPending(rows: CreatePendingPhotoData[]): Promise<void> {
    await this.prisma.photo.createMany({
      data: rows.map((row) => ({
        id: row.id,
        eventId: row.eventId,
        key: row.key,
        originalName: row.originalName,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
      })),
    });
  }

  async getManyByEvent(
    eventId: string,
    { status, skip, take }: { status?: PhotoUploadStatus; skip: number; take: number },
  ): Promise<PaginatedPhotos<Photo>> {
    const where = { eventId, deletedAt: null, ...(status && { status }) };

    const [items, totalItemCount] = await this.prisma.$transaction([
      this.prisma.photo.findMany({
        where,
        // id is a tiebreaker: captured_at/uploaded_at are neither unique nor always distinct
        // (burst shots share a second, PENDING rows have no uploaded_at), so without it offset
        // pagination can duplicate or skip rows across pages when ties straddle a page boundary.
        orderBy: [{ capturedAt: { sort: 'asc', nulls: 'last' } }, { uploadedAt: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
      this.prisma.photo.count({ where }),
    ]);

    return { items, totalItemCount };
  }

  async getManyPublishedByEvent(
    eventId: string,
    {
      skip,
      take,
      search,
      fromMinute,
      toMinute,
    }: { skip: number; take: number; search?: string; fromMinute?: number; toMinute?: number },
  ): Promise<PaginatedPhotos<Photo>> {
    const hasMinuteFilter = fromMinute !== undefined || toMinute !== undefined;
    const where = {
      eventId,
      status: 'UPLOADED' as const,
      deletedAt: null,
      ...(search && { originalName: { contains: search, mode: 'insensitive' as const } }),
      ...(hasMinuteFilter && buildMinuteOfDayWhere(fromMinute, toMinute)),
    };

    const [items, totalItemCount] = await this.prisma.$transaction([
      this.prisma.photo.findMany({
        where,
        orderBy: [{ capturedAt: { sort: 'asc', nulls: 'last' } }, { uploadedAt: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
      this.prisma.photo.count({ where }),
    ]);

    return { items, totalItemCount };
  }

  async getOneOwned(id: string, eventId: string): Promise<Photo | null> {
    return await this.prisma.photo.findFirst({
      where: { id, eventId, deletedAt: null },
    });
  }

  async updateStatus(id: string, data: UpdatePhotoStatusData): Promise<Photo> {
    return await this.prisma.photo.update({
      where: { id },
      data: {
        status: data.status,
        ...(data.uploadedAt !== undefined && { uploadedAt: data.uploadedAt }),
        ...(data.width !== undefined && { width: data.width }),
        ...(data.height !== undefined && { height: data.height }),
        ...(data.capturedAt !== undefined && { capturedAt: data.capturedAt }),
      },
    });
  }

  async updateAlbumCover(id: string, isEventAlbumCover: boolean): Promise<Photo> {
    return await this.prisma.photo.update({
      where: { id },
      data: { isEventAlbumCover },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.photo.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getPendingOlderThan(cutoff: Date): Promise<Photo[]> {
    return await this.prisma.photo.findMany({
      where: { status: 'PENDING', deletedAt: null, createdAt: { lt: cutoff } },
    });
  }
}
