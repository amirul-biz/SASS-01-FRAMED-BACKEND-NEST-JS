import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  decryptSecret,
  encryptSecret,
} from '../../../common/utils/crypto.util';
import { PaymentProvider } from '../../../../generated/prisma/enums';
import type { AuthenticatedUser } from '../../../types/express';
import { MerchantPaymentPlatformService } from '../../merchant-payment-platform.service';
import {
  ToyyibPayApiClient,
  ToyyibPayCredentialError,
} from './toyyibpay-api.client';
import { ToyyibPayPaymentConfigRepository } from './toyyibpay-payment-config.repository';
import {
  CreateToyyibPayPaymentConfigOptionDto,
  ToyyibPayPaymentConfigOptionResponseDto,
  UpdateToyyibPayPaymentConfigOptionDto,
} from './toyyibpay-payment-config.dto';

type ToyyibPayPaymentConfigOption = Awaited<
  ReturnType<
    ToyyibPayPaymentConfigRepository['createToyyibPayPaymentConfigOption']
  >
>;

type ToyyibPayPaymentConfigOptionCredentials = NonNullable<
  ToyyibPayPaymentConfigOption['toyyibPayPaymentPlatformOption']
>;

export interface ToyyibPayCredentials {
  categoryCode: string;
  secretKey: string;
  chargeFpxToCustomer: boolean;
  chargeToPrepaid: boolean;
}

@Injectable()
export class ToyyibPayPaymentConfigService {
  constructor(
    private readonly toyyibPayPaymentConfigRepository: ToyyibPayPaymentConfigRepository,
    private readonly toyyibPayApiClient: ToyyibPayApiClient,
    private readonly merchantPaymentPlatformService: MerchantPaymentPlatformService,
  ) {}

  async createToyyibPayPaymentConfigOption(
    user: AuthenticatedUser,
    dto: CreateToyyibPayPaymentConfigOptionDto,
  ): Promise<ToyyibPayPaymentConfigOptionResponseDto> {
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
      await this.toyyibPayPaymentConfigRepository.createToyyibPayPaymentConfigOption(
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
    return this.getMappedToyyibPayPaymentConfigOptionResponseDto(option);
  }

  async updateToyyibPayPaymentConfigOption(
    user: AuthenticatedUser,
    optionId: string,
    dto: UpdateToyyibPayPaymentConfigOptionDto,
  ): Promise<ToyyibPayPaymentConfigOptionResponseDto> {
    const userPlatformId =
      this.merchantPaymentPlatformService.getCurrentUserPhotographerPlatformId(
        user,
      );

    const existingOption =
      await this.toyyibPayPaymentConfigRepository.getToyyibPayPaymentConfigOptionById(
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
      await this.toyyibPayPaymentConfigRepository.updateToyyibPayPaymentConfigOption(
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
    return this.getMappedToyyibPayPaymentConfigOptionResponseDto(updatedOption);
  }

  // Used by toyyibpay-order-payment (pre-payment) to build a createBill call — the merchant's
  // decrypted credentials live only here, so bill generation reuses this instead of decrypting
  // a second time elsewhere.
  async getToyyibPayCredentialsForOption(
    paymentPlatformOptionId: string,
  ): Promise<ToyyibPayCredentials> {
    const option =
      await this.toyyibPayPaymentConfigRepository.getToyyibPayPaymentConfigOptionById(
        paymentPlatformOptionId,
      );
    if (!option?.toyyibPayPaymentPlatformOption) {
      throw new NotFoundException(
        'ToyyibPay payment platform option not found',
      );
    }

    const credentials = option.toyyibPayPaymentPlatformOption;
    return {
      categoryCode: credentials.categoryCode,
      secretKey: decryptSecret(credentials.secretKey),
      chargeFpxToCustomer: credentials.chargeFpxToCustomer,
      chargeToPrepaid: credentials.chargeToPrepaid,
    };
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
    dto: UpdateToyyibPayPaymentConfigOptionDto,
    existingCredentials: ToyyibPayPaymentConfigOptionCredentials,
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

  private getMappedToyyibPayPaymentConfigOptionResponseDto(
    option: ToyyibPayPaymentConfigOption,
  ): ToyyibPayPaymentConfigOptionResponseDto {
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
