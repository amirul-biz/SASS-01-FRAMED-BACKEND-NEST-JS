import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentProvider } from '../../../generated/prisma/enums';
import type { AuthenticatedUser } from '../../types/express';
import { MerchantPaymentPlatformService } from '../merchant-payment-platform.service';
import { CashPaymentPlatformRepository } from './cash-payment-platform.repository';
import {
  CashPaymentPlatformOptionResponseDto,
  CreateCashPaymentPlatformOptionDto,
  UpdateCashPaymentPlatformOptionDto,
} from './cash-payment-platform.dto';

type CashPaymentPlatformOption = Awaited<
  ReturnType<CashPaymentPlatformRepository['createCashPaymentPlatformOption']>
>;

@Injectable()
export class CashPaymentPlatformService {
  constructor(
    private readonly cashPaymentPlatformRepository: CashPaymentPlatformRepository,
    private readonly merchantPaymentPlatformService: MerchantPaymentPlatformService,
  ) {}

  async createCashPaymentPlatformOption(
    user: AuthenticatedUser,
    dto: CreateCashPaymentPlatformOptionDto,
  ): Promise<CashPaymentPlatformOptionResponseDto> {
    const userPlatformId =
      this.merchantPaymentPlatformService.getCurrentUserPhotographerPlatformId(
        user,
      );

    const isAlreadyRegistered =
      await this.merchantPaymentPlatformService.isPaymentPlatformOptionRegisteredForProvider(
        userPlatformId,
        PaymentProvider.CASH,
      );
    if (isAlreadyRegistered) {
      throw new ConflictException(
        'A cash payment platform option already exists for this photographer',
      );
    }

    const approvalStatus =
      this.merchantPaymentPlatformService.getConfiguredApprovalStatus();
    const option =
      await this.cashPaymentPlatformRepository.createCashPaymentPlatformOption(
        userPlatformId,
        dto.isDefaultPaymentPlatform ?? false,
        approvalStatus,
      );
    return this.getMappedCashPaymentPlatformOptionResponseDto(option);
  }

  async updateCashPaymentPlatformOption(
    user: AuthenticatedUser,
    optionId: string,
    dto: UpdateCashPaymentPlatformOptionDto,
  ): Promise<CashPaymentPlatformOptionResponseDto> {
    const userPlatformId =
      this.merchantPaymentPlatformService.getCurrentUserPhotographerPlatformId(
        user,
      );

    const existingOption =
      await this.cashPaymentPlatformRepository.getCashPaymentPlatformOptionById(
        optionId,
      );
    if (!existingOption) {
      throw new NotFoundException('Cash payment platform option not found');
    }
    this.merchantPaymentPlatformService.verifyUserOwnsPaymentPlatformOption(
      user,
      existingOption.userPlatformId,
      userPlatformId,
    );

    const updatedOption =
      await this.cashPaymentPlatformRepository.updateCashPaymentPlatformOption(
        optionId,
        userPlatformId,
        dto.isDefaultPaymentPlatform,
      );
    return this.getMappedCashPaymentPlatformOptionResponseDto(updatedOption);
  }

  private getMappedCashPaymentPlatformOptionResponseDto(
    option: CashPaymentPlatformOption,
  ): CashPaymentPlatformOptionResponseDto {
    return {
      id: option.id,
      provider: PaymentProvider.CASH,
      isDefaultPaymentPlatform: option.isDefaultPaymentPlatform,
      approvalStatus: option.approvalStatus,
      isImposeCommission: option.isImposeCommission,
      createdAt: option.createdAt,
      updatedAt: option.updatedAt,
    };
  }
}
