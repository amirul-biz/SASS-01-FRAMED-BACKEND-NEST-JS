import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/config/database/prisma.service';
import { UserRole } from '../../generated/prisma/enums';
import type { PhotographerProfile } from '../../generated/prisma/client';
import type { UpdatePhotographerProfileDto } from './photographer.dto';
import type {
  CreatePhotographerProfileData,
  CreatePhotographerProfileResult,
  PublicPhotographerProfile,
  TopPhotographerByEventCount,
} from './photographer.interface';

@Injectable()
export class PhotographerRepository {
  constructor(private readonly prisma: PrismaService) {}

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
  ): Promise<PhotographerProfile | null> {
    return await this.prisma.photographerProfile.findUnique({
      where: { userPlatformId },
    });
  }

  async updateProfileByUserPlatformId(
    userPlatformId: string,
    data: UpdatePhotographerProfileDto,
  ): Promise<PhotographerProfile> {
    return await this.prisma.photographerProfile.update({
      where: { userPlatformId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.companyName !== undefined && {
          companyName: data.companyName,
        }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.contactNo !== undefined && { contactNo: data.contactNo }),
        ...(data.profileImageUrl !== undefined && {
          profileImageUrl: data.profileImageUrl,
        }),
        ...(data.bannerUrl !== undefined && { bannerUrl: data.bannerUrl }),
      },
    });
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
      select: { id: true, name: true, bio: true, profileImageUrl: true, bannerUrl: true },
    });
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

    return grouped.flatMap((group) => {
      const profile = profileById.get(group.photographerId);
      return profile
        ? [{ ...profile, eventCount: group._count.id }]
        : [];
    });
  }

  async getPublicProfileById(id: string): Promise<PublicPhotographerProfile | null> {
    const profile = await this.prisma.photographerProfile.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        bio: true,
        profileImageUrl: true,
        bannerUrl: true,
        createdAt: true,
      },
    });

    if (!profile) {
      return null;
    }

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
      ...profile,
      eventCount,
      photoCount,
      topCategory: topCategoryGroups[0]?.category ?? null,
    };
  }
}
