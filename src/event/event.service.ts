import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { sanitizeFileName } from 'src/common/utils/sanitize-file-name';
import { StorageService } from '../config/storage/storage.service';
import { PhotographerService } from '../photographer/photographer.service';
import type { AuthenticatedUser } from '../types/express';
import {
  CreateEventDto,
  EventListQueryDto,
  EventResponseDto,
  PaginatedEventListResponseDto,
  PresignEventCoverPhotoUploadDto,
  PresignEventCoverPhotoUploadResponseDto,
  UpdateEventDto,
} from './event.dto';
import { EventRepository } from './event.repository';
import type { LatestPublishedEvent, PaginatedEvents } from './event.interface';

const DATE_RANGE_CHECK_CONSTRAINT = 'events_date_range_check';

@Injectable()
export class EventService {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly photographerService: PhotographerService,
    private readonly storageService: StorageService,
  ) {}

  async createEvent(
    user: AuthenticatedUser,
    dto: CreateEventDto,
  ): Promise<EventResponseDto> {
    this.assertOwnedCoverPhotoUrl(dto.coverPhotoUrl);
    const photographerId = await this.photographerService.getOwnPhotographerProfileId(user);

    return await this.runWithDateRangeCheck(() =>
      this.eventRepository.create(photographerId, dto),
    );
  }

  async listMyEvents(
    user: AuthenticatedUser,
    query: EventListQueryDto,
  ): Promise<PaginatedEventListResponseDto> {
    const photographerId = await this.photographerService.getOwnPhotographerProfileId(user);
    const skip = (query.pageNumber - 1) * query.pageSize;

    const { items, totalItemCount } = await this.eventRepository.getManyByPhotographer(
      photographerId,
      { skip, take: query.pageSize },
    );

    return {
      items,
      totalItemCount,
      totalPageCount: Math.ceil(totalItemCount / query.pageSize),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
    };
  }

  async getMyEvent(user: AuthenticatedUser, id: string): Promise<EventResponseDto> {
    const photographerId = await this.photographerService.getOwnPhotographerProfileId(user);
    return await this.getOwnedEventOrThrow(id, photographerId);
  }

  async updateMyEvent(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateEventDto,
  ): Promise<EventResponseDto> {
    this.assertOwnedCoverPhotoUrl(dto.coverPhotoUrl);
    const photographerId = await this.photographerService.getOwnPhotographerProfileId(user);
    const existing = await this.getOwnedEventOrThrow(id, photographerId);

    const justPublished = dto.isPublished === true && !existing.isPublished;

    return await this.runWithDateRangeCheck(() =>
      this.eventRepository.update(id, {
        ...dto,
        ...(justPublished && { publishedAt: new Date() }),
      }),
    );
  }

  async deleteMyEvent(user: AuthenticatedUser, id: string): Promise<void> {
    const photographerId = await this.photographerService.getOwnPhotographerProfileId(user);
    await this.getOwnedEventOrThrow(id, photographerId);
    await this.eventRepository.softDelete(id);
  }

  async presignCoverPhotoUpload(
    user: AuthenticatedUser,
    dto: PresignEventCoverPhotoUploadDto,
  ): Promise<PresignEventCoverPhotoUploadResponseDto> {
    const photographerId = await this.photographerService.getOwnPhotographerProfileId(user);
    const sanitizedFileName = sanitizeFileName(dto.fileName);
    const key = `events/${photographerId}/${randomUUID()}-${sanitizedFileName}`;
    const expiresIn = 300;

    const uploadUrl = await this.storageService.getPresignedUploadUrl({
      key,
      mimeType: dto.mimeType,
    });
    const publicUrl = this.storageService.buildPublicUrl(key);

    return { uploadUrl, publicUrl, key, expiresIn };
  }

  async getLatestPublishedEvents(limit: number): Promise<LatestPublishedEvent[]> {
    return await this.eventRepository.getLatestPublished(limit);
  }

  async getPublishedEventList(filters: {
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    photographerId?: string;
    pageNumber: number;
    pageSize: number;
  }): Promise<PaginatedEvents<LatestPublishedEvent>> {
    const skip = (filters.pageNumber - 1) * filters.pageSize;
    return await this.eventRepository.getPublishedList({
      search: filters.search,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      photographerId: filters.photographerId,
      skip,
      take: filters.pageSize,
    });
  }

  private async getOwnedEventOrThrow(
    id: string,
    photographerId: string,
  ): Promise<EventResponseDto> {
    const event = await this.eventRepository.getOneOwned(id, photographerId);

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  private assertOwnedCoverPhotoUrl(coverPhotoUrl: string | undefined): void {
    if (coverPhotoUrl !== undefined && !this.storageService.isOwnPublicUrl(coverPhotoUrl)) {
      throw new BadRequestException('Invalid cover photo URL');
    }
  }

  private async runWithDateRangeCheck<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Error && error.message.includes(DATE_RANGE_CHECK_CONSTRAINT)) {
        throw new BadRequestException(
          'Event end date must be on or after the start date',
        );
      }
      throw error;
    }
  }
}
