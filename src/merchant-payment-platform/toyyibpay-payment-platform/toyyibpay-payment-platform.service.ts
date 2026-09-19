import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { decryptSecret, encryptSecret } from '../../common/utils/crypto.util';
import { PaymentProvider } from '../../../generated/prisma/enums';
import type { AuthenticatedUser } from '../../types/express';
import { MerchantPaymentPlatformService } from '../merchant-payment-platform.service';
import {
  ToyyibPayApiClient,
  ToyyibPayCredentialError,
} from './toyyibpay-api.client';
import { ToyyibPayPaymentPlatformRepository } from './toyyibpay-payment-platform.repository';
import {
  CreateToyyibPayPaymentPlatformOptionDto,
  ToyyibPayPaymentPlatformOptionResponseDto,
  UpdateToyyibPayPaymentPlatformOptionDto,
} from './toyyibpay-payment-platform.dto';

type ToyyibPayPaymentPlatformOption = Awaited<
  ReturnType<
    ToyyibPayPaymentPlatformRepository['createToyyibPayPaymentPlatformOption']
  >
>;

type ToyyibPayPaymentPlatformOptionCredentials = NonNullable<
  ToyyibPayPaymentPlatformOption['toyyibPayPaymentPlatformOption']
>;

@Injectable()
export class ToyyibPayPaymentPlatformService {
  constructor(
    private readonly toyyibPayPaymentPlatformRepository: ToyyibPayPaymentPlatformRepository,
    private readonly toyyibPayApiClient: ToyyibPayApiClient,
    private readonly merchantPaymentPlatformService: MerchantPaymentPlatformService,
  ) {}

  async createToyyibPayPaymentPlatformOption(
    user: AuthenticatedUser,
    dto: CreateToyyibPayPaymentPlatformOptionDto,
  ): Promise<ToyyibPayPaymentPlatformOptionResponseDto> {
    const userPlatformId =
      this.merchantPaymentPlatformService.getCurrentUserPhotographerPlatformId(
        user,
      );

    const isAlreadyRegistered =
      await this.merchantPaymentPlatformService.isPaymentPlatformOptionRegisteredForProvider(
        userPlatformId,
        PaymentProvider.TOYYIBPAY,
      );
    if (isAlreadyRegistered) {
      throw new ConflictException(
        'A ToyyibPay payment platform option already exists for this photographer',
      );
    }

    await this.verifyToyyibPayCredentials(dto.secretKey, dto.categoryCode);

    const approvalStatus =
      this.merchantPaymentPlatformService.getConfiguredApprovalStatus();
    const option =
      await this.toyyibPayPaymentPlatformRepository.createToyyibPayPaymentPlatformOption(
        userPlatformId,
        dto.isDefaultPaymentPlatform ?? false,
        approvalStatus,
        {
          categoryCode: dto.categoryCode,
          encryptedSecretKey: encryptSecret(dto.secretKey),
          chargeFpxToCustomer: dto.chargeFpxToCustomer,
          chargeToPrepaid: dto.chargeToPrepaid,
        },
      );
    return this.getMappedToyyibPayPaymentPlatformOptionResponseDto(option);
  }

  async updateToyyibPayPaymentPlatformOption(
    user: AuthenticatedUser,
    optionId: string,
    dto: UpdateToyyibPayPaymentPlatformOptionDto,
  ): Promise<ToyyibPayPaymentPlatformOptionResponseDto> {
    const userPlatformId =
      this.merchantPaymentPlatformService.getCurrentUserPhotographerPlatformId(
        user,
      );

    const existingOption =
      await this.toyyibPayPaymentPlatformRepository.getToyyibPayPaymentPlatformOptionById(
        optionId,
      );
    if (!existingOption?.toyyibPayPaymentPlatformOption) {
      throw new NotFoundException(
        'ToyyibPay payment platform option not found',
      );
    }
    this.merchantPaymentPlatformService.verifyUserOwnsPaymentPlatformOption(
      user,
      existingOption.userPlatformId,
      userPlatformId,
    );

    await this.verifyToyyibPayCredentialsIfChanging(
      dto,
      existingOption.toyyibPayPaymentPlatformOption,
    );

    const updatedOption =
      await this.toyyibPayPaymentPlatformRepository.updateToyyibPayPaymentPlatformOption(
        optionId,
        userPlatformId,
        dto.isDefaultPaymentPlatform,
        {
          categoryCode: dto.categoryCode,
          encryptedSecretKey:
            dto.secretKey !== undefined
              ? encryptSecret(dto.secretKey)
              : undefined,
          chargeFpxToCustomer: dto.chargeFpxToCustomer,
          chargeToPrepaid: dto.chargeToPrepaid,
        },
      );
    return this.getMappedToyyibPayPaymentPlatformOptionResponseDto(
      updatedOption,
    );
  }

  private async verifyToyyibPayCredentials(
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

  private async verifyToyyibPayCredentialsIfChanging(
    dto: UpdateToyyibPayPaymentPlatformOptionDto,
    existingCredentials: ToyyibPayPaymentPlatformOptionCredentials,
  ): Promise<void> {
    const isCredentialFieldChanging =
      dto.categoryCode !== undefined || dto.secretKey !== undefined;
    if (!isCredentialFieldChanging) {
      return;
    }

    const secretKeyToVerify =
      dto.secretKey ?? decryptSecret(existingCredentials.secretKey);
    const categoryCodeToVerify =
      dto.categoryCode ?? existingCredentials.categoryCode;
    await this.verifyToyyibPayCredentials(
      secretKeyToVerify,
      categoryCodeToVerify,
    );
  }

  private getMappedToyyibPayPaymentPlatformOptionResponseDto(
    option: ToyyibPayPaymentPlatformOption,
  ): ToyyibPayPaymentPlatformOptionResponseDto {
    if (!option.toyyibPayPaymentPlatformOption) {
      throw new InternalServerErrorException(
        'ToyyibPay option row missing toyyibPayPaymentPlatformOption relation',
      );
    }

    return {
      id: option.id,
      provider: PaymentProvider.TOYYIBPAY,
      isDefaultPaymentPlatform: option.isDefaultPaymentPlatform,
      approvalStatus: option.approvalStatus,
      isImposeCommission: option.isImposeCommission,
      createdAt: option.createdAt,
      updatedAt: option.updatedAt,
      categoryCode: option.toyyibPayPaymentPlatformOption.categoryCode,
      chargeFpxToCustomer:
        option.toyyibPayPaymentPlatformOption.chargeFpxToCustomer,
      chargeToPrepaid: option.toyyibPayPaymentPlatformOption.chargeToPrepaid,
    };
  }
}
