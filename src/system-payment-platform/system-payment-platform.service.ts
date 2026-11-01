import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { decryptSecret, encryptSecret } from '../common/utils/crypto.util';
import { PaymentProvider } from '../../generated/prisma/enums';
import { MerchantPaymentPlatformService } from '../merchant-payment-platform/merchant-payment-platform.service';
import {
  CreateToyyibPaySystemAccountDto,
  SystemPaymentPlatformDto,
  UpdateToyyibPaySystemAccountDto,
} from './system-payment-platform.dto';
import {
  SystemPaymentPlatformRepository,
  SystemPlatformPayload,
} from './system-payment-platform.repository';

@Injectable()
export class SystemPaymentPlatformService {
  constructor(
    private readonly systemPaymentPlatformRepository: SystemPaymentPlatformRepository,
    private readonly merchantPaymentPlatformService: MerchantPaymentPlatformService,
  ) {}

  async getSystemPaymentPlatforms(): Promise<SystemPaymentPlatformDto[]> {
    const systemPlatforms =
      await this.systemPaymentPlatformRepository.getSystemPlatforms();
    return systemPlatforms.map((systemPlatform) =>
      this.getMappedSystemPaymentPlatformDto(systemPlatform),
    );
  }

  async createCashSystemAccount(): Promise<SystemPaymentPlatformDto> {
    const isAlreadyRegistered =
      await this.systemPaymentPlatformRepository.isSystemPlatformRegisteredForProvider(
        PaymentProvider.CASH,
      );
    if (isAlreadyRegistered) {
      throw new ConflictException('A cash system account already exists');
    }

    const systemPlatform =
      await this.systemPaymentPlatformRepository.createCashSystemPlatform();
    return this.getMappedSystemPaymentPlatformDto(systemPlatform);
  }

  async createToyyibPaySystemAccount(
    dto: CreateToyyibPaySystemAccountDto,
  ): Promise<SystemPaymentPlatformDto> {
    await this.assertToyyibPayUsernameAvailable(dto.username);
    // Proves the key before anything is saved: ToyyibPay can't confirm the username itself, but
    // a bad key or category never reaches the database.
    await this.merchantPaymentPlatformService.verifyToyyibPayCredentials(
      dto.secretKey,
      dto.categoryCode,
    );

    const isFirstToyyibPayAccount =
      !(await this.systemPaymentPlatformRepository.isSystemPlatformRegisteredForProvider(
        PaymentProvider.TOYYIBPAY,
      ));
    const systemPlatform =
      await this.systemPaymentPlatformRepository.createToyyibPaySystemPlatform(
        dto.isDefault ?? isFirstToyyibPayAccount,
        {
          splitRecipientId: dto.username,
          encryptedSecretKey: encryptSecret(dto.secretKey),
          categoryCode: dto.categoryCode,
          verifiedAt: new Date(),
        },
      );
    return this.getMappedSystemPaymentPlatformDto(systemPlatform);
  }

  async updateToyyibPaySystemAccount(
    accountId: string,
    dto: UpdateToyyibPaySystemAccountDto,
  ): Promise<SystemPaymentPlatformDto> {
    const existingSystemPlatform =
      await this.systemPaymentPlatformRepository.getToyyibPaySystemPlatformByAccountId(
        accountId,
      );
    if (!existingSystemPlatform?.toyyibPaySystemAccount) {
      throw new NotFoundException('ToyyibPay system account not found');
    }

    const isUnsettingCurrentDefault =
      dto.isDefault === false && existingSystemPlatform.isDefault;
    if (isUnsettingCurrentDefault) {
      throw new ConflictException(
        'Set another ToyyibPay system account as default instead',
      );
    }

    const isUsernameChanging =
      dto.username !== undefined &&
      dto.username !==
        existingSystemPlatform.toyyibPaySystemAccount.splitRecipientId;
    if (isUsernameChanging) {
      await this.assertToyyibPayUsernameAvailable(dto.username, accountId);
    }

    const verifiedAt = await this.getVerifiedAtIfCredentialsChanging(
      dto,
      existingSystemPlatform.toyyibPaySystemAccount,
    );

    const updatedSystemPlatform =
      await this.systemPaymentPlatformRepository.updateToyyibPaySystemPlatform(
        existingSystemPlatform.id,
        dto.isDefault,
        {
          splitRecipientId: dto.username,
          encryptedSecretKey:
            dto.secretKey !== undefined
              ? encryptSecret(dto.secretKey)
              : undefined,
          categoryCode: dto.categoryCode,
          verifiedAt,
        },
      );
    return this.getMappedSystemPaymentPlatformDto(updatedSystemPlatform);
  }

  // Deleting a platform-owned payment channel is only allowed while nothing depends on it:
  // no processed bills, no commission split pointing at it, and — for ToyyibPay — it must not
  // be the default (promote another account first). Cash has no such rule: it is the only
  // account of its provider, so a fresh unused cash account can be removed outright.
  async deleteSystemAccount(accountId: string): Promise<{ success: boolean }> {
    const systemPlatform =
      await this.systemPaymentPlatformRepository.getSystemPlatformByAccountId(
        accountId,
      );
    if (!systemPlatform) {
      throw new NotFoundException('System payment account not found');
    }

    if (systemPlatform.provider === PaymentProvider.TOYYIBPAY) {
      const billCount =
        await this.systemPaymentPlatformRepository.countBillsForToyyibPayAccount(
          accountId,
        );
      if (billCount > 0) {
        throw new ConflictException(
          'This account has processed payments and cannot be deleted',
        );
      }

      const splitCount =
        await this.systemPaymentPlatformRepository.countCommissionSplitsForAccount(
          accountId,
        );
      if (splitCount > 0) {
        throw new ConflictException(
          'Turn off the commission splits pointing at this account before deleting it',
        );
      }

      if (systemPlatform.isDefault) {
        throw new ConflictException(
          'Set another ToyyibPay system account as default before deleting this one',
        );
      }
    }

    await this.systemPaymentPlatformRepository.deleteSystemPlatform(
      systemPlatform.id,
    );
    return { success: true };
  }

  // Re-verifies on a key or category change (E30), using whichever half the dto leaves out from
  // the stored row. Returns the new verifiedAt, or undefined when nothing credential-related changed.
  private async getVerifiedAtIfCredentialsChanging(
    dto: UpdateToyyibPaySystemAccountDto,
    account: { secretKey: string; categoryCode: string | null },
  ): Promise<Date | undefined> {
    const isCredentialChanging =
      dto.secretKey !== undefined || dto.categoryCode !== undefined;
    if (!isCredentialChanging) {
      return undefined;
    }

    const categoryCode = dto.categoryCode ?? account.categoryCode;
    if (!categoryCode) {
      throw new BadRequestException(
        'categoryCode is required to verify this account',
      );
    }
    await this.merchantPaymentPlatformService.verifyToyyibPayCredentials(
      dto.secretKey ?? decryptSecret(account.secretKey),
      categoryCode,
    );
    return new Date();
  }

  private async assertToyyibPayUsernameAvailable(
    username: string | undefined,
    excludeAccountId?: string,
  ): Promise<void> {
    if (username === undefined) {
      return;
    }

    const isUsernameTaken =
      await this.systemPaymentPlatformRepository.isToyyibPayUsernameTaken(
        username,
        excludeAccountId,
      );
    if (isUsernameTaken) {
      throw new ConflictException(
        'A ToyyibPay system account with this username already exists',
      );
    }
  }

  private getMappedSystemPaymentPlatformDto(
    systemPlatform: SystemPlatformPayload,
  ): SystemPaymentPlatformDto {
    const toyyibPayAccount = systemPlatform.toyyibPaySystemAccount;
    const cashAccount = systemPlatform.cashSystemAccount;
    const accountId = toyyibPayAccount?.id ?? cashAccount?.id;
    if (accountId === undefined) {
      throw new InternalServerErrorException(
        `System payment platform ${systemPlatform.id} has no account row for its provider`,
      );
    }

    return {
      id: systemPlatform.id,
      provider: systemPlatform.provider,
      isDefault: systemPlatform.isDefault,
      accountId,
      username: toyyibPayAccount?.splitRecipientId ?? null,
      categoryCode: toyyibPayAccount?.categoryCode ?? null,
      verifiedAt: toyyibPayAccount?.verifiedAt ?? null,
      createdAt: systemPlatform.createdAt,
    };
  }
}
