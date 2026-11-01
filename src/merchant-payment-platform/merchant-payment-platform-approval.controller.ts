import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
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
import {
  MerchantPaymentPlatformApprovalItemDto,
  MerchantPaymentPlatformApprovalQueryDto,
  PaginatedMerchantPaymentPlatformApprovalDto,
  SetMerchantPaymentPlatformApprovalDto,
} from './merchant-payment-platform.dto';
import { MerchantPaymentPlatformService } from './merchant-payment-platform.service';

@ApiTags('admin-merchant-payment-platform')
@Controller('admin/merchant-payment-platform')
@UsePipes(new ValidationPipe({ transform: true }))
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class MerchantPaymentPlatformApprovalController {
  constructor(
    private readonly merchantPaymentPlatformService: MerchantPaymentPlatformService,
  ) {}

  @Get()
  async getOptionsForApproval(
    @Query() query: MerchantPaymentPlatformApprovalQueryDto,
  ): Promise<PaginatedMerchantPaymentPlatformApprovalDto> {
    return await this.merchantPaymentPlatformService.getOptionsForApproval(
      query,
    );
  }

  @Patch(':id/approval')
  async setApprovalStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetMerchantPaymentPlatformApprovalDto,
  ): Promise<MerchantPaymentPlatformApprovalItemDto> {
    return await this.merchantPaymentPlatformService.setApprovalStatus(
      user,
      id,
      dto.status,
    );
  }
}
