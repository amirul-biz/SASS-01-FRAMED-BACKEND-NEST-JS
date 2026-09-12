import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { EventService } from '../event/event.service';
import { PhotoService } from '../photo/photo.service';
import { PhotographerService } from '../photographer/photographer.service';
import { CLIENT_PHOTOGRAPHERS_LIST_MAX } from './client.constants';
import {
  ClientEventDetailDto,
  ClientEventListQueryDto,
  ClientEventPhotoListQueryDto,
  ClientHomeResponseDto,
  ClientPhotographerProfileDto,
  ClientTopPhotographerDto,
  PaginatedClientEventListResponseDto,
  PaginatedClientEventPhotoListResponseDto,
} from './client.dto';

const HOME_LATEST_EVENTS_LIMIT = 3;
const HOME_TOP_PHOTOGRAPHERS_LIMIT = 3;

@Injectable()
export class ClientService {
  constructor(
    private readonly eventService: EventService,
    private readonly photographerService: PhotographerService,
    private readonly photoService: PhotoService,
  ) {}

  async getHomeData(): Promise<ClientHomeResponseDto> {
    const [latestEvents, topPhotographers] = await Promise.all([
      this.eventService.getLatestPublishedEvents(HOME_LATEST_EVENTS_LIMIT),
      this.photographerService.getTopPhotographersByEventCount(
        HOME_TOP_PHOTOGRAPHERS_LIMIT,
      ),
    ]);

    return { latestEvents, topPhotographers };
  }

  async getEventList(
    query: ClientEventListQueryDto,
  ): Promise<PaginatedClientEventListResponseDto> {
    // photographerId may be the public UUID or a photographer's vanity nickname (profile pages
    // link by whichever the URL currently shows) — resolve a nickname to its real id the same
    // way getPublicProfile does, so filtering never silently matches zero events.
    let photographerId = query.photographerId;
    if (photographerId && !isUUID(photographerId)) {
      const profile = await this.photographerService
        .getPublicProfile(photographerId)
        .catch(() => null);
      if (!profile) {
        return {
          items: [],
          totalItemCount: 0,
          totalPageCount: 0,
          pageNumber: query.pageNumber,
          pageSize: query.pageSize,
        };
      }
      photographerId = profile.id;
    }

    const { items, totalItemCount } = await this.eventService.getPublishedEventList({
      search: query.search,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      photographerId,
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
    });

    return {
      items,
      totalItemCount,
      totalPageCount: Math.ceil(totalItemCount / query.pageSize),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
    };
  }

  async getEventDetail(id: string): Promise<ClientEventDetailDto> {
    return await this.eventService.getPublishedEventDetail(id);
  }

  async getEventPhotos(
    id: string,
    query: ClientEventPhotoListQueryDto,
  ): Promise<PaginatedClientEventPhotoListResponseDto> {
    return await this.photoService.listPublishedEventPhotos(id, {
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      search: query.search,
      capturedFrom: query.capturedFrom,
      capturedTo: query.capturedTo,
    });
  }

  async getPhotographerList(search: string | undefined): Promise<ClientTopPhotographerDto[]> {
    return await this.photographerService.searchPublicPhotographers(
      search,
      CLIENT_PHOTOGRAPHERS_LIST_MAX,
    );
  }

  async getPhotographerProfile(id: string): Promise<ClientPhotographerProfileDto> {
    return await this.photographerService.getPublicProfile(id);
  }
}
