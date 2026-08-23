import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sanitizeFileName } from 'src/common/utils/sanitize-file-name';
import { StorageService } from '../config/storage/storage.service';
import { EventService } from '../event/event.service';
import type { Photo } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../types/express';
import {
  ConfirmPhotoUploadDto,
  PaginatedPhotoListResponseDto,
  PhotoListQueryDto,
  PhotoResponseDto,
  PresignPhotosBatchDto,
  PresignPhotosBatchResponseDto,
  ReuploadPhotoDto,
  ReuploadPhotoResponseDto,
} from './photo.dto';
import { PhotoRepository } from './photo.repository';

const PRESIGN_EXPIRES_IN_SECONDS = 1800;

@Injectable()
export class PhotoService {
  constructor(
    private readonly photoRepository: PhotoRepository,
    private readonly eventService: EventService,
    private readonly storageService: StorageService,
  ) {}

  async presignBatch(
    user: AuthenticatedUser,
    eventId: string,
    dto: PresignPhotosBatchDto,
  ): Promise<PresignPhotosBatchResponseDto> {
    await this.eventService.getMyEvent(user, eventId);

    const pendingRows = await Promise.all(
      dto.files.map(async (file) => {
        const id = randomUUID();
        const key = `events/${eventId}/photos/${id}-${sanitizeFileName(file.fileName)}`;
        const uploadUrl = await this.storageService.getPresignedUploadUrl({
          key,
          mimeType: file.mimeType,
          expiresIn: PRESIGN_EXPIRES_IN_SECONDS,
        });

        return {
          id,
          eventId,
          key,
          originalName: file.fileName,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          uploadUrl,
        };
      }),
    );

    await this.photoRepository.createManyPending(pendingRows);

    return {
      photos: pendingRows.map(({ id, uploadUrl, key }) => ({ photoId: id, uploadUrl, key })),
      expiresIn: PRESIGN_EXPIRES_IN_SECONDS,
    };
  }

  async confirmUpload(
    user: AuthenticatedUser,
    eventId: string,
    photoId: string,
    dto: ConfirmPhotoUploadDto,
  ): Promise<PhotoResponseDto> {
    await this.eventService.getMyEvent(user, eventId);
    const photo = await this.getOwnedPhotoOrThrow(eventId, photoId);

    const updated = await this.photoRepository.updateStatus(photo.id, {
      status: 'UPLOADED',
      uploadedAt: new Date(),
      width: dto.width,
      height: dto.height,
      capturedAt: dto.capturedAt ? new Date(dto.capturedAt) : undefined,
    });

    return this.toResponseDto(updated);
  }

  async reupload(
    user: AuthenticatedUser,
    eventId: string,
    photoId: string,
    dto: ReuploadPhotoDto,
  ): Promise<ReuploadPhotoResponseDto> {
    await this.eventService.getMyEvent(user, eventId);
    const photo = await this.getOwnedPhotoOrThrow(eventId, photoId);

    if (dto.fileName !== photo.originalName) {
      throw new BadRequestException(
        'File name does not match the original upload attempt for this photo',
      );
    }

    const alreadyOnR2 = await this.storageService.objectExists(photo.key);
    if (alreadyOnR2) {
      const updated = await this.photoRepository.updateStatus(photo.id, {
        status: 'UPLOADED',
        uploadedAt: photo.uploadedAt ?? new Date(),
      });
      return { status: updated.status, key: updated.key };
    }

    const uploadUrl = await this.storageService.getPresignedUploadUrl({
      key: photo.key,
      mimeType: dto.mimeType,
      expiresIn: PRESIGN_EXPIRES_IN_SECONDS,
    });
    const updated = await this.photoRepository.updateStatus(photo.id, { status: 'PENDING' });

    return {
      status: updated.status,
      key: updated.key,
      uploadUrl,
      expiresIn: PRESIGN_EXPIRES_IN_SECONDS,
    };
  }

  async listPhotos(
    user: AuthenticatedUser,
    eventId: string,
    query: PhotoListQueryDto,
  ): Promise<PaginatedPhotoListResponseDto> {
    await this.eventService.getMyEvent(user, eventId);
    const skip = (query.pageNumber - 1) * query.pageSize;

    const { items, totalItemCount } = await this.photoRepository.getManyByEvent(eventId, {
      status: query.status,
      skip,
      take: query.pageSize,
    });

    return {
      items: items.map((photo) => this.toResponseDto(photo)),
      totalItemCount,
      totalPageCount: Math.ceil(totalItemCount / query.pageSize),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
    };
  }

  async deletePhoto(user: AuthenticatedUser, eventId: string, photoId: string): Promise<void> {
    await this.eventService.getMyEvent(user, eventId);
    const photo = await this.getOwnedPhotoOrThrow(eventId, photoId);
    await this.photoRepository.softDelete(photo.id);
  }

  private async getOwnedPhotoOrThrow(eventId: string, photoId: string): Promise<Photo> {
    const photo = await this.photoRepository.getOneOwned(photoId, eventId);
    if (!photo) {
      throw new NotFoundException('Photo not found for this event');
    }
    return photo;
  }

  private toResponseDto(photo: Photo): PhotoResponseDto {
    return {
      id: photo.id,
      eventId: photo.eventId,
      originalName: photo.originalName,
      mimeType: photo.mimeType,
      sizeBytes: photo.sizeBytes,
      width: photo.width,
      height: photo.height,
      status: photo.status,
      url: photo.status === 'UPLOADED' ? this.storageService.buildPublicUrl(photo.key) : null,
      uploadedAt: photo.uploadedAt,
      capturedAt: photo.capturedAt,
      isEventAlbumCover: photo.isEventAlbumCover,
      createdAt: photo.createdAt,
      updatedAt: photo.updatedAt,
    };
  }
}
