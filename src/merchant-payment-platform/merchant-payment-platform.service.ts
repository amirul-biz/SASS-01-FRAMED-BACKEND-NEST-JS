import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, PaymentProvider } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../types/express';
import { UserRole } from '../../generated/prisma/enums';
import { MerchantPaymentPlatformOptionDto } from './merchant-payment-platform.dto';
import { MerchantPaymentPlatformRepository } from './merchant-payment-platform.repository';

type PaymentPlatformOption = Awaited<
  ReturnType<
    MerchantPaymentPlatformRepository['getCurrentMerchantPaymentPlatformOptions']
  >
>[number];

@Injectable()
export class MerchantPaymentPlatformService {
  constructor(
    private readonly merchantPaymentPlatformRepository: MerchantPaymentPlatformRepository,
  ) {}

  getConfiguredApprovalStatus(): ApprovalStatus {
    const configured = process.env.DEFAULT_MERCHANT_PAYMENT_PLATFORM_STATUS;
    const validValues = Object.values(ApprovalStatus) as string[];
    const isConfiguredValueValid =
      configured !== undefined && validValues.includes(configured);

    if (isConfiguredValueValid) {
      return configured as ApprovalStatus;
    }
    return ApprovalStatus.APPROVED;
  }

  async getCurrentMerchantPaymentPlatformOptions(
    userPlatformId: string,
  ): Promise<MerchantPaymentPlatformOptionDto[]> {
    const options =
      await this.merchantPaymentPlatformRepository.getCurrentMerchantPaymentPlatformOptions(
        userPlatformId,
      );
    return options.map((option) =>
      this.getMappedMerchantPaymentPlatformOptionDto(option),
    );
  }

  async isPaymentPlatformOptionRegisteredForProvider(
    userPlatformId: string,
    provider: PaymentProvider,
  ): Promise<boolean> {
    return await this.merchantPaymentPlatformRepository.isPaymentPlatformOptionRegisteredForProvider(
      userPlatformId,
      provider,
    );
  }

  getCurrentUserPhotographerPlatformId(user: AuthenticatedUser): string {
    const photographerPlatform = user.userPlatforms.find(
      (platform) => platform.role === UserRole.PHOTOGRAPHER,
    );

    if (!photographerPlatform) {
      throw new NotFoundException('Photographer profile not found');
    }

    return photographerPlatform.id;
  }

  verifyUserOwnsPaymentPlatformOption(
    user: AuthenticatedUser,
    optionOwnerUserPlatformId: string,
    userPlatformId: string,
  ): void {
    const isOwnedByCurrentUser = optionOwnerUserPlatformId === userPlatformId;
    const isCurrentUserAdmin = this.isCurrentUserAdmin(user);

    if (!isOwnedByCurrentUser && !isCurrentUserAdmin) {
      throw new ForbiddenException(
        'You do not have access to this payment platform option',
      );
    }
  }

  getAuthorizedUserPlatformId(
    user: AuthenticatedUser,
    optionOwnerUserPlatformId: string,
  ): string {
    const isOwner = user.userPlatforms.some(
      (platform) => platform.id === optionOwnerUserPlatformId,
    );
    if (isOwner) {
      return optionOwnerUserPlatformId;
    }

    const adminPlatform = user.userPlatforms.find(
      (platform) => platform.role === UserRole.ADMIN,
    );
    const isAdmin = adminPlatform !== undefined;
    if (!isAdmin) {
      throw new ForbiddenException(
        'You do not have access to this payment platform option',
      );
    }
    return adminPlatform.id;
  }

  private isCurrentUserAdmin(user: AuthenticatedUser): boolean {
    return user.userPlatforms.some(
      (platform) => platform.role === UserRole.ADMIN,
    );
  }

  private getMappedMerchantPaymentPlatformOptionDto(
    option: PaymentPlatformOption,
  ): MerchantPaymentPlatformOptionDto {
    return {
      id: option.id,
      provider: option.provider,
      isDefaultPaymentPlatform: option.isDefaultPaymentPlatform,
      approvalStatus: option.approvalStatus,
      isImposeCommission: option.isImposeCommission,
      createdAt: option.createdAt,
      updatedAt: option.updatedAt,
    };
  }
}
