import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/config/database/prisma.service';
import { PublicStorageService } from '../config/storage/public-storage.service';
import { UserRole } from '../../generated/prisma/enums';
import type { Prisma, PhotographerProfile } from '../../generated/prisma/client';
import type {
  PhotographerProfileResponseDto,
  UpdatePhotographerProfileDto,
} from './photographer.dto';
import type {
  CreatePhotographerProfileData,
  CreatePhotographerProfileResult,
  PublicPhotographerProfile,
  TopPhotographerByEventCount,
} from './photographer.interface';

const PUBLIC_PROFILE_SELECT = {
  id: true,
  name: true,
  nickname: true,
  bio: true,
  profileImageKey: true,
  bannerKey: true,
  createdAt: true,
} satisfies Prisma.PhotographerProfileSelect;

type PublicProfileRow = Prisma.PhotographerProfileGetPayload<{ select: typeof PUBLIC_PROFILE_SELECT }>;

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
    return profile ? toProfileResponse(profile, this.publicStorageService) : null;
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
        isPublished: true,
        deletedAt: null,
        ...(photographerIdFilter && { photographerId: { in: photographerIdFilter } }),
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
      select: { id: true, name: true, bio: true, profileImageKey: true, bannerKey: true },
    });
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

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

  async getPublicProfileById(id: string): Promise<PublicPhotographerProfile | null> {
    const profile = await this.prisma.photographerProfile.findUnique({
      where: { id },
      select: PUBLIC_PROFILE_SELECT,
    });
    return profile ? this.buildPublicProfile(profile) : null;
  }

  async getPublicProfileByNickname(nickname: string): Promise<PublicPhotographerProfile | null> {
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

  private async buildPublicProfile(
    profile: PublicProfileRow,
  ): Promise<PublicPhotographerProfile> {
    const id = profile.id;
    const [eventCount, photoCount, topCategoryGroups] = await Promise.all([
      this.prisma.event.count({
        where: { photographerId: id, isPublished: true, deletedAt: null },
      }),
      this.prisma.photo.count({
        where: {
          status: 'UPLOADED',
          deletedAt: null,
          event: { photographerId: id, isPublished: true, deletedAt: null },
        },
      }),
      this.prisma.event.groupBy({
        by: ['category'],
        where: { photographerId: id, isPublished: true, deletedAt: null },
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
