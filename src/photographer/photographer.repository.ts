import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/config/database/prisma.service';

@Injectable()
export class PhotographerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPhotographerWithTransaction(data: {
    firebaseId: string;
    email: string;
    name: string;
    bio?: string;
    companyName?: string;
    phone?: string;
  }) {
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
          role: 'PHOTOGRAPHER',
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
}
