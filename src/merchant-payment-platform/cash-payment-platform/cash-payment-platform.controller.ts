import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../../generated/prisma/enums';
import type { AuthenticatedUser } from '../../types/express';
import {
  CashPaymentPlatformOptionResponseDto,
  CreateCashPaymentPlatformOptionDto,
  UpdateCashPaymentPlatformOptionDto,
} from './cash-payment-platform.dto';
import { CashPaymentPlatformService } from './cash-payment-platform.service';

@ApiTags('cash-payment-platform')
@Controller('cash-payment-platform')
@UsePipes(new ValidationPipe({ transform: true }))
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.PHOTOGRAPHER)
export class CashPaymentPlatformController {
  constructor(
    private readonly cashPaymentPlatformService: CashPaymentPlatformService,
  ) {}

  @Post()
  async createCashPaymentPlatformOption(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCashPaymentPlatformOptionDto,
  ): Promise<CashPaymentPlatformOptionResponseDto> {
    return await this.cashPaymentPlatformService.createCashPaymentPlatformOption(
      user,
      dto,
    );
  }

  @Patch(':id')
  async updateCashPaymentPlatformOption(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCashPaymentPlatformOptionDto,
  ): Promise<CashPaymentPlatformOptionResponseDto> {
    return await this.cashPaymentPlatformService.updateCashPaymentPlatformOption(
      user,
      id,
      dto,
    );
  }
}
