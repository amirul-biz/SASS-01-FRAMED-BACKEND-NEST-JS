import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, PaymentProvider } from '../../generated/prisma/enums';
import { decryptSecret } from '../common/utils/crypto.util';
import type { AuthenticatedUser } from '../types/express';
import { UserRole } from '../../generated/prisma/enums';
import {
  MerchantPaymentPlatformApprovalItemDto,
  MerchantPaymentPlatformApprovalQueryDto,
  MerchantPaymentPlatformOptionDto,
  PaginatedMerchantPaymentPlatformApprovalDto,
} from './merchant-payment-platform.dto';
import {
  ApprovalOptionPayload,
  MerchantPaymentPlatformRepository,
} from './merchant-payment-platform.repository';
import {
  ToyyibPayApiClient,
  ToyyibPayCredentialError,
} from './toyyibpay-payment-platform/toyyibpay-payment-config/toyyibpay-api.client';

type PaymentPlatformOption = Awaited<
  ReturnType<
    MerchantPaymentPlatformRepository['getCurrentMerchantPaymentPlatformOptions']
  >
>[number];

@Injectable()
export class MerchantPaymentPlatformService {
  constructor(
    private readonly merchantPaymentPlatformRepository: MerchantPaymentPlatformRepository,
    private readonly toyyibPayApiClient: ToyyibPayApiClient,
  ) {}

  // Shared by the merchant option and the admin system account: proves ToyyibPay accepts this
  // secret key for this category before it is saved or approved.
  async verifyToyyibPayCredentials(
    secretKey: string,
    categoryCode: string,
  ): Promise<void> {
    try {
      await this.toyyibPayApiClient.getCategoryDetails(secretKey, categoryCode);
    } catch (error) {
      if (error instanceof ToyyibPayCredentialError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  getConfiguredApprovalStatus(): ApprovalStatus {
    const configured = process.env.DEFAULT_MERCHANT_PAYMENT_PLATFORM_STATUS;
    const validValues = Object.values(ApprovalStatus) as string[];
    const isConfiguredValueValid =
      configured !== undefined && validValues.includes(configured);

    if (isConfiguredValueValid) {
      return configured as ApprovalStatus;
    }
    return ApprovalStatus.PENDING;
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

  getCurrentUserAdminPlatformId(user: AuthenticatedUser): string {
    const adminPlatform = user.userPlatforms.find(
      (platform) => platform.role === UserRole.ADMIN,
    );

    if (!adminPlatform) {
      throw new ForbiddenException('Admin profile not found');
    }

    return adminPlatform.id;
  }

  async getOptionsForApproval(
    query: MerchantPaymentPlatformApprovalQueryDto,
  ): Promise<PaginatedMerchantPaymentPlatformApprovalDto> {
    const { items, totalItemCount } =
      await this.merchantPaymentPlatformRepository.getOptionsForApproval({
        status: query.status,
        provider: query.provider,
        skip: (query.pageNumber - 1) * query.pageSize,
        take: query.pageSize,
      });

    return {
      items: items.map((option) =>
        this.getMappedMerchantPaymentPlatformApprovalItemDto(option),
      ),
      totalItemCount,
    };
  }

  async setApprovalStatus(
    user: AuthenticatedUser,
    optionId: string,
    status: ApprovalStatus,
  ): Promise<MerchantPaymentPlatformApprovalItemDto> {
    const reviewerUserPlatformId = this.getCurrentUserAdminPlatformId(user);

    const existingOption =
      await this.merchantPaymentPlatformRepository.getOptionForApprovalById(
        optionId,
      );
    if (!existingOption) {
      throw new NotFoundException('Payment platform option not found');
    }

    const isAlreadyInRequestedStatus = existingOption.approvalStatus === status;
    if (isAlreadyInRequestedStatus) {
      throw new ConflictException(
        `Payment platform option is already ${status}`,
      );
    }

    // A key can be rotated after the first save, so approving re-proves it is still valid.
    const verifiedAt = await this.getVerifiedAtOnApprove(
      existingOption,
      status,
    );

    const updatedOption =
      await this.merchantPaymentPlatformRepository.updateApprovalStatus(
        optionId,
        status,
        reviewerUserPlatformId,
        verifiedAt,
      );
    return this.getMappedMerchantPaymentPlatformApprovalItemDto(updatedOption);
  }

  private async getVerifiedAtOnApprove(
    option: ApprovalOptionPayload,
    status: ApprovalStatus,
  ): Promise<Date | undefined> {
    const isApprovingToyyibPay =
      status === ApprovalStatus.APPROVED &&
      option.provider === PaymentProvider.TOYYIBPAY;
    if (!isApprovingToyyibPay) {
      return undefined;
    }

    const credentials =
      await this.merchantPaymentPlatformRepository.getToyyibPayCredentialsByOptionId(
        option.id,
      );
    if (!credentials) {
      throw new NotFoundException('ToyyibPay credentials not found');
    }
    await this.verifyToyyibPayCredentials(
      decryptSecret(credentials.secretKey),
      credentials.categoryCode,
    );
    return new Date();
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

  private getMappedMerchantPaymentPlatformApprovalItemDto(
    option: ApprovalOptionPayload,
  ): MerchantPaymentPlatformApprovalItemDto {
    return {
      id: option.id,
      provider: option.provider,
      approvalStatus: option.approvalStatus,
      photographerName: option.userPlatform.photographerProfile?.name ?? null,
      photographerEmail: option.userPlatform.user.email,
      categoryCode: option.toyyibPayPaymentPlatformOption?.categoryCode ?? null,
      verifiedAt: option.toyyibPayPaymentPlatformOption?.verifiedAt ?? null,
      createdAt: option.createdAt,
      approvalStatusUpdatedAt: option.approvalStatusUpdatedAt,
      reviewedByName:
        option.approvalStatusUpdatedByUserPlatform?.adminProfile?.name ?? null,
    };
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
