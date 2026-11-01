import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../../generated/prisma/enums';
import {
  CreateToyyibPaySystemAccountDto,
  SystemPaymentPlatformDto,
  UpdateToyyibPaySystemAccountDto,
} from './system-payment-platform.dto';
import { SystemPaymentPlatformService } from './system-payment-platform.service';

@ApiTags('admin-system-payment-platform')
@Controller('admin/system-payment-platform')
@UsePipes(new ValidationPipe({ transform: true }))
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class SystemPaymentPlatformController {
  constructor(
    private readonly systemPaymentPlatformService: SystemPaymentPlatformService,
  ) {}

  @Get()
  async getSystemPaymentPlatforms(): Promise<SystemPaymentPlatformDto[]> {
    return await this.systemPaymentPlatformService.getSystemPaymentPlatforms();
  }

  @Post('cash')
  async createCashSystemAccount(): Promise<SystemPaymentPlatformDto> {
    return await this.systemPaymentPlatformService.createCashSystemAccount();
  }

  @Post('toyyibpay')
  async createToyyibPaySystemAccount(
    @Body() dto: CreateToyyibPaySystemAccountDto,
  ): Promise<SystemPaymentPlatformDto> {
    return await this.systemPaymentPlatformService.createToyyibPaySystemAccount(
      dto,
    );
  }

  @Patch('toyyibpay/:id')
  async updateToyyibPaySystemAccount(
    @Param('id') id: string,
    @Body() dto: UpdateToyyibPaySystemAccountDto,
  ): Promise<SystemPaymentPlatformDto> {
    return await this.systemPaymentPlatformService.updateToyyibPaySystemAccount(
      id,
      dto,
    );
  }

  @Delete(':accountId')
  async deleteSystemAccount(
    @Param('accountId') accountId: string,
  ): Promise<{ success: boolean }> {
    return await this.systemPaymentPlatformService.deleteSystemAccount(
      accountId,
    );
  }
}
