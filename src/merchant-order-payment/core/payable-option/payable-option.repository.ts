import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/database/prisma.service';
import type { MerchantPaymentPlatformOptions } from '../../../../generated/prisma/client';
import { ApprovalStatus } from '../../../../generated/prisma/enums';

@Injectable()
export class PayableOptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getApprovedOptionsByPhotographerProfileId(
    photographerProfileId: string,
  ): Promise<MerchantPaymentPlatformOptions[]> {
    return await this.prisma.merchantPaymentPlatformOptions.findMany({
      where: {
        approvalStatus: ApprovalStatus.APPROVED,
        userPlatform: { photographerProfile: { id: photographerProfileId } },
      },
      orderBy: [{ isDefaultPaymentPlatform: 'desc' }, { createdAt: 'asc' }],
    });
  }
}
