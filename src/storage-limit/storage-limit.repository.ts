import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/database/prisma.service';
import type { StorageLimit } from '../../generated/prisma/client';

export interface StorageAssignmentRow {
  photographerId: string;
  name: string;
  email: string;
  storageLimit: StorageLimit | null;
}

@Injectable()
export class StorageLimitRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getLimits(): Promise<(StorageLimit & { assignmentCount: number })[]> {
    const limits = await this.prisma.storageLimit.findMany({
      orderBy: { limitMb: 'asc' },
      include: { _count: { select: { photographers: true } } },
    });
    return limits.map(({ _count, ...limit }) => ({
      ...limit,
      assignmentCount: _count.photographers,
    }));
  }

  async getLimitById(id: string): Promise<StorageLimit | null> {
    return await this.prisma.storageLimit.findUnique({ where: { id } });
  }

  async getLimitByName(name: string): Promise<StorageLimit | null> {
    return await this.prisma.storageLimit.findUnique({ where: { name } });
  }

  async createLimit(data: {
    name: string;
    limitMb: number;
  }): Promise<StorageLimit> {
    return await this.prisma.storageLimit.create({ data });
  }

  async updateLimit(
    id: string,
    data: { name?: string; limitMb?: number },
  ): Promise<StorageLimit> {
    return await this.prisma.storageLimit.update({ where: { id }, data });
  }

  async deleteLimit(id: string): Promise<void> {
    await this.prisma.storageLimit.delete({ where: { id } });
  }

  async countAssigned(id: string): Promise<number> {
    return await this.prisma.photographerProfile.count({
      where: { storageLimitId: id },
    });
  }

  async getAssignmentRows(page: {
    skip: number;
    take: number;
  }): Promise<{ items: StorageAssignmentRow[]; totalItemCount: number }> {
    const [profiles, totalItemCount] = await this.prisma.$transaction([
      this.prisma.photographerProfile.findMany({
        orderBy: { createdAt: 'asc' },
        skip: page.skip,
        take: page.take,
        select: {
          id: true,
          name: true,
          storageLimit: true,
          userPlatform: { select: { user: { select: { email: true } } } },
        },
      }),
      this.prisma.photographerProfile.count(),
    ]);
    return {
      totalItemCount,
      items: profiles.map((profile) => ({
        photographerId: profile.id,
        name: profile.name,
        email: profile.userPlatform.user.email,
        storageLimit: profile.storageLimit,
      })),
    };
  }

  async getPhotographerProfileById(id: string): Promise<{ id: string } | null> {
    return await this.prisma.photographerProfile.findUnique({
      where: { id },
      select: { id: true },
    });
  }

  async setPhotographerLimit(
    photographerId: string,
    storageLimitId: string | null,
  ): Promise<void> {
    await this.prisma.photographerProfile.update({
      where: { id: photographerId },
      data: { storageLimitId },
    });
  }

  async getLimitMbForPhotographer(
    photographerId: string,
  ): Promise<number | null> {
    const profile = await this.prisma.photographerProfile.findUnique({
      where: { id: photographerId },
      select: { storageLimit: { select: { limitMb: true } } },
    });
    return profile?.storageLimit?.limitMb ?? null;
  }

  async getUsedBytesForEvent(eventId: string): Promise<number> {
    const agg = await this.prisma.photo.aggregate({
      where: { eventId, status: 'UPLOADED', deletedAt: null },
      _sum: { sizeBytes: true },
    });
    return agg._sum.sizeBytes ?? 0;
  }

  // Same rule as the studio dashboard: confirmed photos only, soft-deleted events still count
  // (their files still occupy storage). PENDING rows are ignored so failed uploads don't eat quota.
  async getUsedBytesByPhotographer(
    photographerIds: string[],
  ): Promise<Map<string, number>> {
    if (photographerIds.length === 0) return new Map();
    const rows = await this.prisma.$queryRaw<
      { photographer_id: string; used_bytes: bigint }[]
    >`
      SELECT e.photographer_id, COALESCE(SUM(p.size_bytes), 0)::bigint AS used_bytes
      FROM photos p
      JOIN events e ON e.id = p.event_id
      WHERE p.status = 'UPLOADED'
        AND p.deleted_at IS NULL
        AND e.photographer_id = ANY(${photographerIds})
      GROUP BY e.photographer_id`;
    return new Map(rows.map((r) => [r.photographer_id, Number(r.used_bytes)]));
  }
}
