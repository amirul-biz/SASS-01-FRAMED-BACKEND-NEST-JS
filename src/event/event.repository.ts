import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/config/database/prisma.service';
import type { Event, Prisma } from '../../generated/prisma/client';
import type { CreateEventDto } from './event.dto';
import type {
  LatestPublishedEvent,
  PaginatedEvents,
  UpdateEventRepositoryData,
} from './event.interface';

const PUBLISHED_EVENT_CARD_SELECT = {
  id: true,
  title: true,
  category: true,
  location: true,
  coverPhotoUrl: true,
  eventStartDate: true,
  eventEndDate: true,
  photographerProfile: { select: { id: true, name: true } },
  _count: {
    select: { photos: { where: { status: 'UPLOADED', deletedAt: null } } },
  },
} satisfies Prisma.EventSelect;

type PublishedEventCardRow = Prisma.EventGetPayload<{
  select: typeof PUBLISHED_EVENT_CARD_SELECT;
}>;

function toLatestPublishedEvent(
  event: PublishedEventCardRow,
): LatestPublishedEvent {
  return {
    id: event.id,
    title: event.title,
    category: event.category,
    location: event.location,
    coverPhotoUrl: event.coverPhotoUrl,
    eventStartDate: event.eventStartDate,
    eventEndDate: event.eventEndDate,
    photoCount: event._count.photos,
    photographerId: event.photographerProfile.id,
    photographerName: event.photographerProfile.name,
  };
}

@Injectable()
export class EventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(photographerId: string, data: CreateEventDto): Promise<Event> {
    return await this.prisma.event.create({
      data: {
        photographerId,
        title: data.title,
        description: data.description,
        category: data.category,
        location: data.location,
        eventStartDate: new Date(data.eventStartDate),
        eventEndDate: new Date(data.eventEndDate),
        coverPhotoUrl: data.coverPhotoUrl,
      },
    });
  }

  async getManyByPhotographer(
    photographerId: string,
    { skip, take }: { skip: number; take: number },
  ): Promise<PaginatedEvents<Event>> {
    const where = { photographerId, deletedAt: null };

    const [items, totalItemCount] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        orderBy: { eventStartDate: 'desc' },
        skip,
        take,
      }),
      this.prisma.event.count({ where }),
    ]);

    return { items, totalItemCount };
  }

  async getOneOwned(id: string, photographerId: string): Promise<Event | null> {
    return await this.prisma.event.findFirst({
      where: { id, photographerId, deletedAt: null },
    });
  }

  async update(id: string, data: UpdateEventRepositoryData): Promise<Event> {
    return await this.prisma.event.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.eventStartDate !== undefined && {
          eventStartDate: new Date(data.eventStartDate),
        }),
        ...(data.eventEndDate !== undefined && {
          eventEndDate: new Date(data.eventEndDate),
        }),
        ...(data.coverPhotoUrl !== undefined && {
          coverPhotoUrl: data.coverPhotoUrl,
        }),
        ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
        ...(data.publishedAt !== undefined && { publishedAt: data.publishedAt }),
      },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.event.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getLatestPublished(limit: number): Promise<LatestPublishedEvent[]> {
    const events = await this.prisma.event.findMany({
      where: { isPublished: true, deletedAt: null },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: PUBLISHED_EVENT_CARD_SELECT,
    });

    return events.map(toLatestPublishedEvent);
  }

  async getPublishedList(filters: {
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    photographerId?: string;
    skip: number;
    take: number;
  }): Promise<PaginatedEvents<LatestPublishedEvent>> {
    const where = {
      isPublished: true,
      deletedAt: null,
      ...(filters.search && {
        title: { contains: filters.search, mode: 'insensitive' as const },
      }),
      ...(filters.photographerId && { photographerId: filters.photographerId }),
      // Overlap check: an event matches if any part of its date range falls
      // within [dateFrom, dateTo] — either bound alone still narrows correctly.
      ...(filters.dateFrom && {
        eventEndDate: { gte: new Date(`${filters.dateFrom}T00:00:00.000Z`) },
      }),
      ...(filters.dateTo && {
        eventStartDate: { lte: new Date(`${filters.dateTo}T23:59:59.999Z`) },
      }),
    };

    const [events, totalItemCount] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: filters.skip,
        take: filters.take,
        select: PUBLISHED_EVENT_CARD_SELECT,
      }),
      this.prisma.event.count({ where }),
    ]);

    return { items: events.map(toLatestPublishedEvent), totalItemCount };
  }
}
