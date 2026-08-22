import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/config/database/prisma.service';
import { UserRole } from '../../generated/prisma/enums';
import type { PhotographerProfile } from '../../generated/prisma/client';
import type { UpdatePhotographerProfileDto } from './photographer.dto';
import type {
  CreatePhotographerProfileData,
  CreatePhotographerProfileResult,
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
}
