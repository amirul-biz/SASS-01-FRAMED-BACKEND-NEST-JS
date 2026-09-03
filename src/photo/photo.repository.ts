import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/config/database/prisma.service';
import type { Photo } from '../../generated/prisma/client';
import type { PhotoUploadStatus } from '../../generated/prisma/enums';
import type {
  CreatePendingPhotoData,
  PaginatedPhotos,
  UpdatePhotoStatusData,
} from './photo.interface';

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
      ...(hasMinuteFilter && {
        capturedMinuteOfDay: {
          ...(fromMinute !== undefined && { gte: fromMinute }),
          ...(toMinute !== undefined && { lte: toMinute }),
        },
      }),
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
