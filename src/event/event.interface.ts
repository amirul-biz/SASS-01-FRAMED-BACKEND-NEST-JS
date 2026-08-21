import type { UpdateEventDto } from './event.dto';

export interface UpdateEventRepositoryData extends UpdateEventDto {
  publishedAt?: Date;
}

export interface PaginatedEvents<T> {
  items: T[];
  totalItemCount: number;
}
