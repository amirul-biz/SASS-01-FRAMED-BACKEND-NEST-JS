import {
  Controller,
  Get,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../types/express';
import { MerchantPaymentPlatformOptionDto } from './merchant-payment-platform.dto';
import { MerchantPaymentPlatformService } from './merchant-payment-platform.service';

@ApiTags('merchant-payment-platform')
@Controller('merchant-payment-platform')
@UsePipes(new ValidationPipe({ transform: true }))
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.PHOTOGRAPHER)
export class MerchantPaymentPlatformController {
  constructor(
    private readonly merchantPaymentPlatformService: MerchantPaymentPlatformService,
  ) {}

  @Get()
  async getCurrentMerchantPaymentPlatformOptions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MerchantPaymentPlatformOptionDto[]> {
    const userPlatformId =
      this.merchantPaymentPlatformService.getCurrentUserPhotographerPlatformId(
        user,
      );
    return await this.merchantPaymentPlatformService.getCurrentMerchantPaymentPlatformOptions(
      userPlatformId,
    );
  }
}
