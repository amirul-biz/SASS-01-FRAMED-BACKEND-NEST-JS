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
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma/enums';
import {
  AdminEventsQueryDto,
  AdminOrdersQueryDto,
  AdminPaginatedEventsDto,
  AdminPaginatedOrdersDto,
  AdminPaginatedPhotographersDto,
  AdminPhotographerListQueryDto,
  AdminRegisterPhotographerDto,
  AdminSetPhotographerStatusDto,
  AdminStatsDto,
} from './admin.dto';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('photographers')
  @UsePipes(new ValidationPipe({ transform: true }))
  async registerPhotographer(@Body() dto: AdminRegisterPhotographerDto): Promise<{ success: boolean }> {
    await this.adminService.registerPhotographer(dto);
    return { success: true };
  }

  @Get('photographers')
  @UsePipes(new ValidationPipe({ transform: true }))
  listPhotographers(
    @Query() query: AdminPhotographerListQueryDto,
  ): Promise<AdminPaginatedPhotographersDto> {
    return this.adminService.listPhotographers(query);
  }

  @Patch('photographers/:id/status')
  @UsePipes(new ValidationPipe({ transform: true }))
  async setPhotographerStatus(
    @Param('id') id: string,
    @Body() dto: AdminSetPhotographerStatusDto,
  ): Promise<{ success: boolean }> {
    await this.adminService.setPhotographerStatus(id, dto.isActive);
    return { success: true };
  }

  @Get('stats')
  getStats(): Promise<AdminStatsDto> {
    return this.adminService.getStats();
  }

  @Get('events')
  @UsePipes(new ValidationPipe({ transform: true }))
  listEvents(@Query() query: AdminEventsQueryDto): Promise<AdminPaginatedEventsDto> {
    return this.adminService.listEvents(query);
  }

  @Get('orders')
  @UsePipes(new ValidationPipe({ transform: true }))
  listOrders(@Query() query: AdminOrdersQueryDto): Promise<AdminPaginatedOrdersDto> {
    return this.adminService.listOrders(query);
  }
}
