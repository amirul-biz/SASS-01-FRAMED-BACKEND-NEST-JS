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
  CreateToyyibPayPaymentPlatformOptionDto,
  ToyyibPayPaymentPlatformOptionResponseDto,
  UpdateToyyibPayPaymentPlatformOptionDto,
} from './toyyibpay-payment-platform.dto';
import { ToyyibPayPaymentPlatformService } from './toyyibpay-payment-platform.service';

@ApiTags('toyyibpay-payment-platform')
@Controller('toyyibpay-payment-platform')
@UsePipes(new ValidationPipe({ transform: true }))
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.PHOTOGRAPHER)
export class ToyyibPayPaymentPlatformController {
  constructor(
    private readonly toyyibPayPaymentPlatformService: ToyyibPayPaymentPlatformService,
  ) {}

  @Post()
  async createToyyibPayPaymentPlatformOption(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateToyyibPayPaymentPlatformOptionDto,
  ): Promise<ToyyibPayPaymentPlatformOptionResponseDto> {
    return await this.toyyibPayPaymentPlatformService.createToyyibPayPaymentPlatformOption(
      user,
      dto,
    );
  }

  @Patch(':id')
  async updateToyyibPayPaymentPlatformOption(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateToyyibPayPaymentPlatformOptionDto,
  ): Promise<ToyyibPayPaymentPlatformOptionResponseDto> {
    return await this.toyyibPayPaymentPlatformService.updateToyyibPayPaymentPlatformOption(
      user,
      id,
      dto,
    );
  }
}
