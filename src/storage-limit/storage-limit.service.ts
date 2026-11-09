import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { StorageLimit } from '../../generated/prisma/client';
import {
  AssignStorageLimitDto,
  CreateStorageLimitDto,
  PaginatedStorageAssignmentsDto,
  StorageAssignmentQueryDto,
  StorageLimitDto,
  UpdateStorageLimitDto,
} from './storage-limit.dto';
import { StorageLimitRepository } from './storage-limit.repository';

const BYTES_PER_MB = 1024 * 1024;
const MB_PER_GB = 1024;

@Injectable()
export class StorageLimitService {
  constructor(private readonly repository: StorageLimitRepository) {}

  async getLimits(): Promise<StorageLimitDto[]> {
    return await this.repository.getLimits();
  }

  async createLimit(dto: CreateStorageLimitDto): Promise<StorageLimitDto> {
    await this.assertNameFree(dto.name);
    const limit = await this.repository.createLimit(dto);
    return { ...limit, assignmentCount: 0 };
  }

  async updateLimit(
    id: string,
    dto: UpdateStorageLimitDto,
  ): Promise<StorageLimitDto> {
    await this.getLimitOrThrow(id);
    if (dto.name !== undefined) await this.assertNameFree(dto.name, id);
    const limit = await this.repository.updateLimit(id, dto);
    return {
      ...limit,
      assignmentCount: await this.repository.countAssigned(id),
    };
  }

  async deleteLimit(id: string): Promise<{ success: boolean }> {
    await this.getLimitOrThrow(id);
    if ((await this.repository.countAssigned(id)) > 0) {
      throw new ConflictException(
        'This storage limit is assigned to photographers. Unassign it first.',
      );
    }
    await this.repository.deleteLimit(id);
    return { success: true };
  }

  async getAssignments(
    query: StorageAssignmentQueryDto,
  ): Promise<PaginatedStorageAssignmentsDto> {
    const { items, totalItemCount } = await this.repository.getAssignmentRows({
      skip: (query.pageNumber - 1) * query.pageSize,
      take: query.pageSize,
    });
    const used = await this.repository.getUsedBytesByPhotographer(
      items.map((row) => row.photographerId),
    );
    return {
      totalItemCount,
      items: items.map((row) => ({
        photographerId: row.photographerId,
        name: row.name,
        email: row.email,
        usedBytes: used.get(row.photographerId) ?? 0,
        storageLimitId: row.storageLimit?.id ?? null,
        storageLimitName: row.storageLimit?.name ?? null,
        limitMb: row.storageLimit?.limitMb ?? null,
      })),
    };
  }

  async assignLimit(
    photographerId: string,
    dto: AssignStorageLimitDto,
  ): Promise<{ success: boolean }> {
    if (!(await this.repository.getPhotographerProfileById(photographerId))) {
      throw new NotFoundException('Photographer not found');
    }
    if (dto.storageLimitId !== null) {
      await this.getLimitOrThrow(dto.storageLimitId);
    }
    await this.repository.setPhotographerLimit(
      photographerId,
      dto.storageLimitId,
    );
    return { success: true };
  }

  // Called before presigning uploads. No assigned limit = unlimited.
  // ponytail: check-then-insert, concurrent batches can overshoot slightly; lock per photographer if that matters.
  async assertWithinLimit(
    photographerId: string,
    incomingBytes: number,
  ): Promise<void> {
    const limitMb =
      await this.repository.getLimitMbForPhotographer(photographerId);
    if (limitMb === null) return;
    const used =
      (await this.repository.getUsedBytesByPhotographer([photographerId])).get(
        photographerId,
      ) ?? 0;
    if (used + incomingBytes > limitMb * BYTES_PER_MB) {
      throw new BadRequestException(
        `Storage limit reached (${Number((limitMb / MB_PER_GB).toFixed(3))} GB). Delete photos or contact the admin to raise your limit.`,
      );
    }
  }

  private async getLimitOrThrow(id: string): Promise<StorageLimit> {
    const limit = await this.repository.getLimitById(id);
    if (!limit) throw new NotFoundException('Storage limit not found');
    return limit;
  }

  private async assertNameFree(name: string, exceptId?: string): Promise<void> {
    const existing = await this.repository.getLimitByName(name);
    if (existing && existing.id !== exceptId) {
      throw new ConflictException(
        'A storage limit with this name already exists',
      );
    }
  }
}
