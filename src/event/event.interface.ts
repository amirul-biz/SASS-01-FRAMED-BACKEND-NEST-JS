import type { EventCategory } from '../../generated/prisma/enums';
import type { UpdateEventDto } from './event.dto';

export interface UpdateEventRepositoryData extends UpdateEventDto {
  publishedAt?: Date;
}

export interface PaginatedEvents<T> {
  items: T[];
  totalItemCount: number;
}

export interface LatestPublishedEvent {
  id: string;
  title: string;
  category: EventCategory;
  location: string | null;
  coverPhotoUrl: string | null;
  eventStartDate: Date;
  eventEndDate: Date;
  photoCount: number;
  photographerId: string;
  photographerName: string;
}
