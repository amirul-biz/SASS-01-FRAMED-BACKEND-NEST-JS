import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../config/database/prisma.service';
import { FirebaseService } from '../config/firebase/firebase.service';
import { PublicStorageService } from '../config/storage/public-storage.service';
import { PhotographerService } from '../photographer/photographer.service';
import type {
  AdminDailyStatDto,
  AdminEventDto,
  AdminOrderDto,
  AdminPaginatedEventsDto,
  AdminPaginatedOrdersDto,
  AdminPaginatedPhotographersDto,
  AdminPhotographerDto,
  AdminRegisterPhotographerDto,
  AdminStatsDto,
} from './admin.dto';

const DAILY_SERIES_DAYS = 14;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseService: FirebaseService,
    private readonly publicStorageService: PublicStorageService,
    private readonly photographerService: PhotographerService,
  ) {}

  async registerPhotographer(dto: AdminRegisterPhotographerDto): Promise<void> {
    try {
      await this.photographerService.registerPhotographer({
        email: dto.email,
        password: dto.password,
        name: dto.name,
        companyName: dto.companyName,
        phone: dto.phone,
        bio: dto.bio,
      });
    } catch (error) {
      // registerPhotographer wraps all failures (e.g. duplicate email) in a generic Error to
      // undo the Firebase user — surface the cause to the admin UI as a 400 instead of a 500.
      throw new BadRequestException((error as Error)?.message ?? 'Registration failed');
    }
  }

  async listPhotographers(
    query: { search?: string },
  ): Promise<AdminPaginatedPhotographersDto> {
    const [profiles, firebaseUsers] = await Promise.all([
      this.prisma.photographerProfile.findMany({
        where: {
          ...(query.search && {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { userPlatform: { user: { email: { contains: query.search, mode: 'insensitive' as const } } } },
            ],
          }),
        },
        select: {
          id: true,
          name: true,
          companyName: true,
          contactNo: true,
          profileImageKey: true,
          createdAt: true,
          userPlatform: { select: { user: { select: { email: true, firebaseId: true } } } },
          _count: { select: { events: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.safeListFirebaseUsers(),
    ]);

    const disabledByUid = new Map(firebaseUsers.map((user) => [user.uid, user.disabled]));

    const items: AdminPhotographerDto[] = profiles.map((profile) => ({
      id: profile.id,
      email: profile.userPlatform.user.email,
      name: profile.name,
      companyName: profile.companyName,
      contactNo: profile.contactNo,
      profileImageUrl: profile.profileImageKey
        ? this.publicStorageService.buildPublicUrl(profile.profileImageKey)
        : null,
      // No Firebase record (e.g. seeded dev accounts) still counts as active — only an explicit
      // Firebase "disabled" flag means inactive.
      isActive: !disabledByUid.get(profile.userPlatform.user.firebaseId),
      eventCount: profile._count.events,
      createdAt: profile.createdAt,
    }));

    return { items, totalItemCount: items.length };
  }

  async setPhotographerStatus(profileId: string, isActive: boolean): Promise<void> {
    const profile = await this.prisma.photographerProfile.findUnique({
      where: { id: profileId },
      select: { userPlatform: { select: { user: { select: { firebaseId: true } } } } },
    });

    if (!profile) {
      throw new NotFoundException('Photographer not found');
    }

    await this.firebaseService.setUserDisabled(profile.userPlatform.user.firebaseId, !isActive);
  }

  async getStats(): Promise<AdminStatsDto> {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (DAILY_SERIES_DAYS - 1));

    const [
      photosUploaded,
      eventsPublished,
      eventsTotal,
      photographersTotal,
      ordersTotal,
      revenueRow,
      dailyPhotos,
      dailyEvents,
      dailyPhotographers,
      dailyOrders,
      firebaseUsers,
      profilesWithPlatform,
    ] = await Promise.all([
      this.prisma.photo.count({ where: { status: 'UPLOADED', deletedAt: null } }),
      this.prisma.event.count({ where: { isPublished: true, deletedAt: null } }),
      this.prisma.event.count({ where: { deletedAt: null } }),
      this.prisma.photographerProfile.count(),
      this.prisma.order.count({ where: { status: { not: 'CANCELLED' } } }),
      this.prisma.order.aggregate({ _sum: { total: true }, where: { status: { not: 'CANCELLED' } } }),
      this.countDaily(
        `SELECT date_trunc('day', uploaded_at)::date AS day, COUNT(*)::int AS count
         FROM photos
         WHERE status = 'UPLOADED' AND deleted_at IS NULL AND uploaded_at >= ${since.toISOString()}
         GROUP BY day`,
      ),
      this.countDaily(
        `SELECT date_trunc('day', created_at)::date AS day, COUNT(*)::int AS count
         FROM events
         WHERE deleted_at IS NULL AND created_at >= ${since.toISOString()}
         GROUP BY day`,
      ),
      this.countDaily(
        `SELECT date_trunc('day', pp.created_at)::date AS day, COUNT(*)::int AS count
         FROM photographer_profiles pp
         WHERE pp.created_at >= ${since.toISOString()}
         GROUP BY day`,
      ),
      this.countDaily(
        `SELECT date_trunc('day', created_at)::date AS day, COUNT(*)::int AS count
         FROM orders
         WHERE status != 'CANCELLED' AND created_at >= ${since.toISOString()}
         GROUP BY day`,
      ),
      this.safeListFirebaseUsers(),
      this.prisma.photographerProfile.findMany({
        select: { userPlatform: { select: { user: { select: { firebaseId: true } } } } },
      }),
    ]);

    const disabledUids = new Set(firebaseUsers.filter((user) => user.disabled).map((user) => user.uid));
    const activePhotographers = profilesWithPlatform.filter(
      (profile) => !disabledUids.has(profile.userPlatform.user.firebaseId),
    ).length;

    const photoMap = new Map(dailyPhotos.map((row) => [row.day, row.count]));
    const eventMap = new Map(dailyEvents.map((row) => [row.day, row.count]));
    const photographerMap = new Map(dailyPhotographers.map((row) => [row.day, row.count]));
    const orderMap = new Map(dailyOrders.map((row) => [row.day, row.count]));

    const daily: AdminDailyStatDto[] = [];
    for (let i = 0; i < DAILY_SERIES_DAYS; i += 1) {
      const day = new Date(since);
      day.setUTCDate(day.getUTCDate() + i);
      const key = day.toISOString().slice(0, 10);
      daily.push({
        date: key,
        photosUploaded: photoMap.get(key) ?? 0,
        eventsCreated: eventMap.get(key) ?? 0,
        photographersRegistered: photographerMap.get(key) ?? 0,
        orders: orderMap.get(key) ?? 0,
      });
    }

    return {
      totalPhotosUploaded: photosUploaded,
      totalEventsPublished: eventsPublished,
      totalEvents: eventsTotal,
      totalPhotographers: photographersTotal,
      totalOrders: ordersTotal,
      totalRevenue: Number(revenueRow._sum.total ?? 0),
      activePhotographers,
      inactivePhotographers: photographersTotal - activePhotographers,
      daily,
    };
  }

  async listEvents(query: {
    search?: string;
    photographerId?: string;
    pageNumber: number;
    pageSize: number;
  }): Promise<AdminPaginatedEventsDto> {
    const where = {
      deletedAt: null,
      ...(query.search && { title: { contains: query.search, mode: 'insensitive' as const } }),
      ...(query.photographerId && { photographerId: query.photographerId }),
    };

    const [events, totalItemCount] = await Promise.all([
      this.prisma.event.findMany({
        where,
        select: {
          id: true,
          title: true,
          category: true,
          location: true,
          isPublished: true,
          eventStartDate: true,
          eventEndDate: true,
          photographerProfile: { select: { id: true, name: true } },
          _count: {
            select: {
              photos: { where: { status: 'UPLOADED', deletedAt: null } },
              orders: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.pageNumber - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.event.count({ where }),
    ]);

    const items: AdminEventDto[] = events.map((event) => ({
      id: event.id,
      title: event.title,
      category: event.category,
      location: event.location,
      photographerId: event.photographerProfile.id,
      photographerName: event.photographerProfile.name,
      isPublished: event.isPublished,
      photoCount: event._count.photos,
      orderCount: event._count.orders,
      eventStartDate: event.eventStartDate,
      eventEndDate: event.eventEndDate,
    }));

    return { items, totalItemCount };
  }

  async listOrders(query: {
    eventId?: string;
    status?: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED';
    pageNumber: number;
    pageSize: number;
  }): Promise<AdminPaginatedOrdersDto> {
    const where = {
      ...(query.eventId && { eventId: query.eventId }),
      ...(query.status && { status: query.status }),
    };

    const [orders, totalItemCount] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: {
          id: true,
          eventId: true,
          email: true,
          voucherName: true,
          status: true,
          total: true,
          createdAt: true,
          event: { select: { title: true } },
          items: {
            select: {
              id: true,
              formatLabel: true,
              price: true,
              photo: { select: { originalName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.pageNumber - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    const items: AdminOrderDto[] = orders.map((order) => ({
      id: order.id,
      eventId: order.eventId,
      eventTitle: order.event.title,
      email: order.email,
      voucherName: order.voucherName,
      status: order.status,
      total: Number(order.total),
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        id: item.id,
        photoName: item.photo.originalName,
        formatLabel: item.formatLabel,
        price: Number(item.price),
      })),
    }));

    return { items, totalItemCount };
  }

  // $queryRaw with a computed ISO string is safe (no user input interpolated); rows return
  // day as a Date object, so it's normalised to a yyyy-mm-dd key.
  private async countDaily(sql: string): Promise<{ day: string; count: number }[]> {
    const rows = await this.prisma.$queryRawUnsafe<{ day: Date; count: number }[]>(sql);
    return rows.map((row) => ({
      day: new Date(row.day).toISOString().slice(0, 10),
      count: Number(row.count),
    }));
  }

  private async safeListFirebaseUsers() {
    try {
      return await this.firebaseService.listUsers();
    } catch (error) {
      // Firebase being unavailable (e.g. missing credentials in local dev) shouldn't take the
      // whole admin panel down — accounts then default to active.
      this.logger.warn(`Failed to list Firebase users: ${(error as Error).message}`);
      return [];
    }
  }
}
