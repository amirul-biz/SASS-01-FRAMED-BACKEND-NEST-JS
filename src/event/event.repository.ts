import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/config/database/prisma.service';
import type { Event, Prisma } from '../../generated/prisma/client';
import { VoucherDiscountType } from '../../generated/prisma/client';
import type { VoucherConditionDto, WireVoucherDiscountType } from '../vouchers/vouchers.dto';
import type { CreateEventDto, EventResponseDto } from './event.dto';
import type {
  LatestPublishedEvent,
  PaginatedEvents,
  PublishedEventDetail,
  UpdateEventRepositoryData,
} from './event.interface';

const TO_WIRE_VOUCHER_TYPE: Record<VoucherDiscountType, WireVoucherDiscountType> = {
  [VoucherDiscountType.FLAT_TIER]: 'flat-tier',
  [VoucherDiscountType.PERCENT_TIER]: 'percent-tier',
};

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

const PUBLISHED_EVENT_DETAIL_SELECT = {
  ...PUBLISHED_EVENT_CARD_SELECT,
  description: true,
  pricingBundles: {
    include: {
      pricingBundle: {
        include: {
          vouchers: { include: { voucher: true } },
          pricingOptions: { include: { pricingOption: true } },
        },
      },
    },
  },
  photos: {
    where: { isEventAlbumCover: true, status: 'UPLOADED', deletedAt: null },
    select: { key: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.EventSelect;

type PublishedEventDetailRow = Prisma.EventGetPayload<{
  select: typeof PUBLISHED_EVENT_DETAIL_SELECT;
}>;

const EVENT_WITH_BUNDLES_INCLUDE = {
  pricingBundles: { select: { pricingBundleId: true } },
} satisfies Prisma.EventInclude;

type EventWithBundlesRow = Event & Prisma.EventGetPayload<{ include: typeof EVENT_WITH_BUNDLES_INCLUDE }>;

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

type PublishedEventDetailRaw = Omit<PublishedEventDetail, 'albumCoverPhotoUrls'> & {
  albumCoverPhotoKeys: string[];
};

function toPublishedEventDetail(event: PublishedEventDetailRow): PublishedEventDetailRaw {
  return {
    ...toLatestPublishedEvent(event),
    description: event.description,
    albumCoverPhotoKeys: event.photos.map((photo) => photo.key),
    pricingBundles: event.pricingBundles.map(({ pricingBundle }) => ({
      id: pricingBundle.id,
      name: pricingBundle.name,
      fullGalleryEnabled: pricingBundle.fullGalleryEnabled,
      fullGalleryPrice: Number(pricingBundle.fullGalleryPrice),
      pricingOptions: pricingBundle.pricingOptions.map(({ pricingOption }) => ({
        id: pricingOption.id,
        label: pricingOption.label,
        price: Number(pricingOption.price),
      })),
      vouchers: pricingBundle.vouchers.map(({ voucher }) => ({
        id: voucher.id,
        name: voucher.name,
        discountType: TO_WIRE_VOUCHER_TYPE[voucher.discountType],
        conditions: voucher.conditions as unknown as VoucherConditionDto[],
      })),
    })),
  };
}

function toEventResponse(event: EventWithBundlesRow): EventResponseDto {
  return {
    id: event.id,
    photographerId: event.photographerId,
    title: event.title,
    description: event.description,
    category: event.category,
    location: event.location,
    eventStartDate: event.eventStartDate,
    eventEndDate: event.eventEndDate,
    isPublished: event.isPublished,
    publishedAt: event.publishedAt,
    coverPhotoUrl: event.coverPhotoUrl,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    pricingBundleIds: event.pricingBundles.map((b) => b.pricingBundleId),
  };
}

@Injectable()
export class EventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(photographerId: string, data: CreateEventDto): Promise<EventResponseDto> {
    const event = await this.prisma.event.create({
      data: {
        photographerId,
        title: data.title,
        description: data.description,
        category: data.category,
        location: data.location,
        eventStartDate: new Date(data.eventStartDate),
        eventEndDate: new Date(data.eventEndDate),
        coverPhotoUrl: data.coverPhotoUrl,
        ...(data.pricingBundleIds && {
          pricingBundles: {
            create: data.pricingBundleIds.map((pricingBundleId) => ({ pricingBundleId })),
          },
        }),
      },
      include: EVENT_WITH_BUNDLES_INCLUDE,
    });
    return toEventResponse(event);
  }

  async getManyByPhotographer(
    photographerId: string,
    { skip, take }: { skip: number; take: number },
  ): Promise<PaginatedEvents<EventResponseDto>> {
    const where = { photographerId, deletedAt: null };

    const [items, totalItemCount] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        orderBy: { eventStartDate: 'desc' },
        skip,
        take,
        include: EVENT_WITH_BUNDLES_INCLUDE,
      }),
      this.prisma.event.count({ where }),
    ]);

    return { items: items.map(toEventResponse), totalItemCount };
  }

  async getOneOwned(id: string, photographerId: string): Promise<EventResponseDto | null> {
    const event = await this.prisma.event.findFirst({
      where: { id, photographerId, deletedAt: null },
      include: EVENT_WITH_BUNDLES_INCLUDE,
    });
    return event ? toEventResponse(event) : null;
  }

  async countOwnedBundles(photographerId: string, pricingBundleIds: string[]): Promise<number> {
    return await this.prisma.pricingBundle.count({
      where: { id: { in: pricingBundleIds }, photographerId },
    });
  }

  async update(id: string, data: UpdateEventRepositoryData): Promise<EventResponseDto> {
    const { pricingBundleIds } = data;

    if (pricingBundleIds !== undefined) {
      const [, , event] = await this.prisma.$transaction([
        this.prisma.eventPricingBundle.deleteMany({ where: { eventId: id } }),
        this.prisma.eventPricingBundle.createMany({
          data: pricingBundleIds.map((pricingBundleId) => ({ eventId: id, pricingBundleId })),
        }),
        this.prisma.event.update({
          where: { id },
          data: this.buildUpdateData(data),
          include: EVENT_WITH_BUNDLES_INCLUDE,
        }),
      ]);
      return toEventResponse(event);
    }

    const event = await this.prisma.event.update({
      where: { id },
      data: this.buildUpdateData(data),
      include: EVENT_WITH_BUNDLES_INCLUDE,
    });
    return toEventResponse(event);
  }

  private buildUpdateData(data: UpdateEventRepositoryData): Prisma.EventUpdateInput {
    return {
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
    };
  }

  async getPublishedDetail(id: string): Promise<PublishedEventDetailRaw | null> {
    const event = await this.prisma.event.findFirst({
      where: { id, isPublished: true, deletedAt: null },
      select: PUBLISHED_EVENT_DETAIL_SELECT,
    });
    return event ? toPublishedEventDetail(event) : null;
  }

  // Cheap existence check for endpoints (like the photo list) that only need to confirm the
  // event is published, not load its bundles/vouchers/album-cover join.
  async existsPublished(id: string): Promise<boolean> {
    const event = await this.prisma.event.findFirst({
      where: { id, isPublished: true, deletedAt: null },
      select: { id: true },
    });
    return event !== null;
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
