import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/config/database/prisma.service';
import type { Event } from '../../generated/prisma/client';
import type { CreateEventDto } from './event.dto';
import type { PaginatedEvents, UpdateEventRepositoryData } from './event.interface';

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
}
