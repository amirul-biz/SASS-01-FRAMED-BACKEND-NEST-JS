import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/config/database/prisma.service';
import { PublicStorageService } from '../config/storage/public-storage.service';
import { UserRole } from '../../generated/prisma/enums';
import type { OrderStatus } from '../../generated/prisma/enums';
import type {
  Prisma,
  PhotographerProfile,
} from '../../generated/prisma/client';
import { liveEventWhere } from '../event/event.repository';
import type {
  PhotographerProfileResponseDto,
  UpdatePhotographerProfileDto,
} from './photographer.dto';
import type {
  CreatePhotographerProfileData,
  CreatePhotographerProfileResult,
  PhotographerDashboardStats,
  PublicPhotographerProfile,
  TopPhotographerByEventCount,
} from './photographer.interface';

// An order is paid once it leaves PENDING_CONFIRMATION without being cancelled.
const PAID_ORDER_STATUSES: OrderStatus[] = ['PROCESSING', 'DELIVERED'];
const TOP_EVENT_LIMIT = 5;

const PUBLIC_PROFILE_SELECT = {
  id: true,
  name: true,
  nickname: true,
  bio: true,
  profileImageKey: true,
  bannerKey: true,
  createdAt: true,
} satisfies Prisma.PhotographerProfileSelect;

type PublicProfileRow = Prisma.PhotographerProfileGetPayload<{
  select: typeof PUBLIC_PROFILE_SELECT;
}>;

function toProfileResponse(
  profile: PhotographerProfile,
  publicStorageService: PublicStorageService,
): PhotographerProfileResponseDto {
  return {
    id: profile.id,
    userPlatformId: profile.userPlatformId,
    name: profile.name,
    bio: profile.bio,
    companyName: profile.companyName,
    phone: profile.phone,
    contactNo: profile.contactNo,
    nickname: profile.nickname,
    profileImageUrl: profile.profileImageKey
      ? publicStorageService.buildPublicUrl(profile.profileImageKey)
      : null,
    bannerUrl: profile.bannerKey
      ? publicStorageService.buildPublicUrl(profile.bannerKey)
      : null,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

@Injectable()
export class PhotographerRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicStorageService: PublicStorageService,
  ) {}

  async createPhotographerWithTransaction(
    data: CreatePhotographerProfileData,
  ): Promise<CreatePhotographerProfileResult> {
    return await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firebaseId: data.firebaseId,
          email: data.email,
        },
      });

      const userPlatform = await tx.userPlatform.create({
        data: {
          userId: user.id,
          role: UserRole.PHOTOGRAPHER,
        },
      });

      const photographerProfile = await tx.photographerProfile.create({
        data: {
          userPlatformId: userPlatform.id,
          name: data.name,
          bio: data.bio,
          companyName: data.companyName,
          phone: data.phone,
        },
      });

      return { user, userPlatform, photographerProfile };
    });
  }

  async getProfileByUserPlatformId(
    userPlatformId: string,
  ): Promise<PhotographerProfileResponseDto | null> {
    const profile = await this.prisma.photographerProfile.findUnique({
      where: { userPlatformId },
    });
    return profile
      ? toProfileResponse(profile, this.publicStorageService)
      : null;
  }

  async updateProfileByUserPlatformId(
    userPlatformId: string,
    data: UpdatePhotographerProfileDto,
  ): Promise<PhotographerProfileResponseDto> {
    const profile = await this.prisma.photographerProfile.update({
      where: { userPlatformId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.companyName !== undefined && {
          companyName: data.companyName,
        }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.contactNo !== undefined && { contactNo: data.contactNo }),
        ...(data.nickname !== undefined && { nickname: data.nickname }),
        ...(data.profileImageKey !== undefined && {
          profileImageKey: data.profileImageKey,
        }),
        ...(data.bannerKey !== undefined && { bannerKey: data.bannerKey }),
      },
    });
    return toProfileResponse(profile, this.publicStorageService);
  }

  async getPublicList(options: {
    search?: string;
    limit: number;
  }): Promise<TopPhotographerByEventCount[]> {
    let photographerIdFilter: string[] | undefined;
    if (options.search) {
      const matches = await this.prisma.photographerProfile.findMany({
        where: { name: { contains: options.search, mode: 'insensitive' } },
        select: { id: true },
      });
      photographerIdFilter = matches.map((match) => match.id);
      if (photographerIdFilter.length === 0) {
        return [];
      }
    }

    const grouped = await this.prisma.event.groupBy({
      by: ['photographerId'],
      where: {
        ...liveEventWhere(),
        ...(photographerIdFilter && {
          photographerId: { in: photographerIdFilter },
        }),
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: options.limit,
    });

    if (grouped.length === 0) {
      return [];
    }

    const profiles = await this.prisma.photographerProfile.findMany({
      where: { id: { in: grouped.map((g) => g.photographerId) } },
      select: {
        id: true,
        name: true,
        bio: true,
        profileImageKey: true,
        bannerKey: true,
      },
    });
    const profileById = new Map(
      profiles.map((profile) => [profile.id, profile]),
    );

    return grouped.flatMap((group) => {
      const profile = profileById.get(group.photographerId);
      if (!profile) {
        return [];
      }
      return [
        {
          id: profile.id,
          name: profile.name,
          bio: profile.bio,
          profileImageUrl: profile.profileImageKey
            ? this.publicStorageService.buildPublicUrl(profile.profileImageKey)
            : null,
          bannerUrl: profile.bannerKey
            ? this.publicStorageService.buildPublicUrl(profile.bannerKey)
            : null,
          eventCount: group._count.id,
        },
      ];
    });
  }

  async getPublicProfileById(
    id: string,
  ): Promise<PublicPhotographerProfile | null> {
    const profile = await this.prisma.photographerProfile.findUnique({
      where: { id },
      select: PUBLIC_PROFILE_SELECT,
    });
    return profile ? this.buildPublicProfile(profile) : null;
  }

  async getPublicProfileByNickname(
    nickname: string,
  ): Promise<PublicPhotographerProfile | null> {
    const profile = await this.prisma.photographerProfile.findUnique({
      where: { nickname },
      select: PUBLIC_PROFILE_SELECT,
    });
    return profile ? this.buildPublicProfile(profile) : null;
  }

  async findByNickname(nickname: string): Promise<{ id: string } | null> {
    return await this.prisma.photographerProfile.findUnique({
      where: { nickname },
      select: { id: true },
    });
  }

  // Own-account overview. Orders and storage deliberately include inactive (soft-deleted)
  // events: their orders are still revenue and their files still occupy storage.
  async getDashboardStats(
    photographerId: string,
  ): Promise<PhotographerDashboardStats> {
    const ownEvent = { photographerId };
    const paidOrder = {
      event: ownEvent,
      status: { in: PAID_ORDER_STATUSES },
    } satisfies Prisma.OrderWhereInput;

    const [
      totalEvents,
      liveEvents,
      draftEvents,
      inactiveEvents,
      photoAgg,
      orderStatusGroups,
      photosSold,
      paidAgg,
      pendingAgg,
      commissionAgg,
      topEventGroups,
    ] = await Promise.all([
      this.prisma.event.count({ where: { ...ownEvent, deletedAt: null } }),
      this.prisma.event.count({
        where: { ...ownEvent, ...liveEventWhere() },
      }),
      this.prisma.event.count({
        where: { ...ownEvent, deletedAt: null, isPublished: false },
      }),
      this.prisma.event.count({
        where: { ...ownEvent, deletedAt: { not: null } },
      }),
      this.prisma.photo.aggregate({
        where: { event: ownEvent, status: 'UPLOADED', deletedAt: null },
        _count: { _all: true },
        _sum: { sizeBytes: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { event: ownEvent },
        _count: { _all: true },
      }),
      this.prisma.orderItem.count({ where: { order: paidOrder } }),
      this.prisma.order.aggregate({
        where: paidOrder,
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: { event: ownEvent, status: 'PENDING_CONFIRMATION' },
        _sum: { total: true },
      }),
      this.prisma.commissionCharge.aggregate({
        where: {
          payment: { status: 'PAID', order: { event: ownEvent } },
        },
        _sum: { commissionAmount: true },
      }),
      this.prisma.order.groupBy({
        by: ['eventId'],
        where: paidOrder,
        _count: { _all: true },
        _sum: { total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: TOP_EVENT_LIMIT,
      }),
    ]);

    const topEventTitles = await this.prisma.event.findMany({
      where: { id: { in: topEventGroups.map((group) => group.eventId) } },
      select: { id: true, title: true },
    });
    const titleByEventId = new Map(
      topEventTitles.map((event) => [event.id, event.title]),
    );

    const ordersByStatus = {
      PENDING_CONFIRMATION: 0,
      PROCESSING: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };
    for (const group of orderStatusGroups) {
      ordersByStatus[group.status] = group._count._all;
    }

    return {
      totalEvents,
      liveEvents,
      draftEvents,
      inactiveEvents,
      photoCount: photoAgg._count._all,
      storageBytes: photoAgg._sum.sizeBytes ?? 0,
      ordersByStatus,
      photosSold,
      grossRevenue: Number(paidAgg._sum.total ?? 0),
      pendingRevenue: Number(pendingAgg._sum.total ?? 0),
      totalCommission: Number(commissionAgg._sum.commissionAmount ?? 0),
      topEvents: topEventGroups.map((group) => ({
        eventId: group.eventId,
        title: titleByEventId.get(group.eventId) ?? '',
        orderCount: group._count._all,
        revenue: Number(group._sum.total ?? 0),
      })),
    };
  }

  private async buildPublicProfile(
    profile: PublicProfileRow,
  ): Promise<PublicPhotographerProfile> {
    const id = profile.id;
    const [eventCount, photoCount, topCategoryGroups] = await Promise.all([
      this.prisma.event.count({
        where: { photographerId: id, ...liveEventWhere() },
      }),
      this.prisma.photo.count({
        where: {
          status: 'UPLOADED',
          deletedAt: null,
          event: { photographerId: id, ...liveEventWhere() },
        },
      }),
      this.prisma.event.groupBy({
        by: ['category'],
        where: { photographerId: id, ...liveEventWhere() },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 1,
      }),
    ]);

    return {
      id: profile.id,
      name: profile.name,
      nickname: profile.nickname,
      bio: profile.bio,
      profileImageUrl: profile.profileImageKey
        ? this.publicStorageService.buildPublicUrl(profile.profileImageKey)
        : null,
      bannerUrl: profile.bannerKey
        ? this.publicStorageService.buildPublicUrl(profile.bannerKey)
        : null,
      createdAt: profile.createdAt,
      eventCount,
      photoCount,
      topCategory: topCategoryGroups[0]?.category ?? null,
    };
  }
}
