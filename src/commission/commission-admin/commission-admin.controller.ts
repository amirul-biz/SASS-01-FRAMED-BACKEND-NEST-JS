import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../../generated/prisma/enums';
import {
  AssignCommissionPlanDto,
  CommissionAssignmentQueryDto,
  CommissionAssignmentRowDto,
  CommissionPlanDto,
  CommissionReportQueryDto,
  CommissionReportResponseDto,
  CreateCommissionPlanDto,
  PaginatedCommissionAssignmentsDto,
  UpdateCommissionPlanDto,
} from './commission-admin.dto';
import { CommissionAdminService } from './commission-admin.service';

@ApiTags('admin-commission')
@Controller('admin/commission')
@UsePipes(new ValidationPipe({ transform: true }))
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class CommissionAdminController {
  constructor(
    private readonly commissionAdminService: CommissionAdminService,
  ) {}

  @Get('report')
  async getCommissionReport(
    @Query() query: CommissionReportQueryDto,
  ): Promise<CommissionReportResponseDto> {
    return await this.commissionAdminService.getCommissionReport(query);
  }

  @Get('plans')
  async getPlans(): Promise<CommissionPlanDto[]> {
    return await this.commissionAdminService.getPlans();
  }

  @Post('plans')
  async createPlan(
    @Body() dto: CreateCommissionPlanDto,
  ): Promise<CommissionPlanDto> {
    return await this.commissionAdminService.createPlan(dto);
  }

  @Patch('plans/:id')
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdateCommissionPlanDto,
  ): Promise<CommissionPlanDto> {
    return await this.commissionAdminService.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  async deletePlan(@Param('id') id: string): Promise<{ success: boolean }> {
    return await this.commissionAdminService.deletePlan(id);
  }

  @Get('assignments')
  async getAssignments(
    @Query() query: CommissionAssignmentQueryDto,
  ): Promise<PaginatedCommissionAssignmentsDto> {
    return await this.commissionAdminService.getAssignments(query);
  }

  @Put('assignments/:paymentPlatformOptionId')
  async assignPlan(
    @Param('paymentPlatformOptionId') paymentPlatformOptionId: string,
    @Body() dto: AssignCommissionPlanDto,
  ): Promise<CommissionAssignmentRowDto> {
    return await this.commissionAdminService.assignPlan(
      paymentPlatformOptionId,
      dto,
    );
  }

  @Delete('assignments/:paymentPlatformOptionId')
  async removeAssignment(
    @Param('paymentPlatformOptionId') paymentPlatformOptionId: string,
  ): Promise<{ success: boolean }> {
    return await this.commissionAdminService.removeAssignment(
      paymentPlatformOptionId,
    );
  }
}
