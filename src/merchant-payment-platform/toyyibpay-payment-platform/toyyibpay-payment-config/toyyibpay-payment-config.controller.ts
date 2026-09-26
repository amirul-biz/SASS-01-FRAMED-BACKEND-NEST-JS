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
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { FirebaseAuthGuard } from '../../../common/guards/firebase-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserRole } from '../../../../generated/prisma/enums';
import type { AuthenticatedUser } from '../../../types/express';
import {
  CreateToyyibPayPaymentConfigOptionDto,
  ToyyibPayPaymentConfigOptionResponseDto,
  UpdateToyyibPayPaymentConfigOptionDto,
} from './toyyibpay-payment-config.dto';
import { ToyyibPayPaymentConfigService } from './toyyibpay-payment-config.service';

@ApiTags('toyyibpay-config')
@Controller('toyyibpay-config')
@UsePipes(new ValidationPipe({ transform: true }))
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.PHOTOGRAPHER)
export class ToyyibPayPaymentConfigController {
  constructor(
    private readonly toyyibPayPaymentConfigService: ToyyibPayPaymentConfigService,
  ) {}

  @Post()
  async createToyyibPayPaymentConfigOption(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateToyyibPayPaymentConfigOptionDto,
  ): Promise<ToyyibPayPaymentConfigOptionResponseDto> {
    return await this.toyyibPayPaymentConfigService.createToyyibPayPaymentConfigOption(
      user,
      dto,
    );
  }

  @Patch(':id')
  async updateToyyibPayPaymentConfigOption(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateToyyibPayPaymentConfigOptionDto,
  ): Promise<ToyyibPayPaymentConfigOptionResponseDto> {
    return await this.toyyibPayPaymentConfigService.updateToyyibPayPaymentConfigOption(
      user,
      id,
      dto,
    );
  }
}
