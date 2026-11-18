import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
  AdminCommissionStatementDto,
  AdminCommissionStatementQueryDto,
  CommissionStatementDto,
  ConfirmCommissionAttachmentDto,
  CurrentCommissionDto,
  PresignCommissionAttachmentDto,
  PresignCommissionAttachmentResponseDto,
  UpdateCommissionStatementDto,
} from './commission-statement.dto';
import { CommissionStatementService } from './commission-statement.service';

@ApiTags('commission-statements')
@Controller('commission-statements')
@UsePipes(new ValidationPipe({ transform: true }))
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.PHOTOGRAPHER)
export class CommissionStatementController {
  constructor(private readonly service: CommissionStatementService) {}

  @Get()
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CommissionStatementDto[]> {
    return await this.service.listMine(user);
  }

  // Declared before ':period' routes so 'current' is never read as a period.
  @Get('current')
  async getCurrent(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CurrentCommissionDto> {
    return await this.service.getCurrent(user);
  }

  @Post(':period/attachments/presign')
  async presign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('period') period: string,
    @Body() dto: PresignCommissionAttachmentDto,
  ): Promise<PresignCommissionAttachmentResponseDto> {
    return await this.service.presignMyAttachment(user, period, dto);
  }

  @Post(':period/attachments')
  async addAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('period') period: string,
    @Body() dto: ConfirmCommissionAttachmentDto,
  ): Promise<{ success: boolean }> {
    await this.service.addMyAttachment(user, period, dto);
    return { success: true };
  }
}

@ApiTags('admin-commission-statements')
@Controller('admin/commission-statements')
@UsePipes(new ValidationPipe({ transform: true }))
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class CommissionStatementAdminController {
  constructor(private readonly service: CommissionStatementService) {}

  @Get()
  async list(
    @Query() query: AdminCommissionStatementQueryDto,
  ): Promise<AdminCommissionStatementDto[]> {
    return await this.service.listForAdmin(query);
  }

  @Patch(':photographerId/:period')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('photographerId') photographerId: string,
    @Param('period') period: string,
    @Body() dto: UpdateCommissionStatementDto,
  ): Promise<{ success: boolean }> {
    await this.service.updateStatement(user.id, photographerId, period, dto);
    return { success: true };
  }

  @Post(':photographerId/:period/attachments/presign')
  async presign(
    @Param('photographerId') photographerId: string,
    @Param('period') period: string,
    @Body() dto: PresignCommissionAttachmentDto,
  ): Promise<PresignCommissionAttachmentResponseDto> {
    return await this.service.presignAdminAttachment(
      photographerId,
      period,
      dto,
    );
  }

  @Post(':photographerId/:period/attachments')
  async addAttachment(
    @Param('photographerId') photographerId: string,
    @Param('period') period: string,
    @Body() dto: ConfirmCommissionAttachmentDto,
  ): Promise<{ success: boolean }> {
    await this.service.addAdminAttachment(photographerId, period, dto);
    return { success: true };
  }
}
