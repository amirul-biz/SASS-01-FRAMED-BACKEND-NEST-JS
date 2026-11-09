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
import { Roles } from '../common/decorators/roles.decorator';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../../generated/prisma/enums';
import {
  AssignStorageLimitDto,
  CreateStorageLimitDto,
  PaginatedStorageAssignmentsDto,
  StorageAssignmentQueryDto,
  StorageLimitDto,
  UpdateStorageLimitDto,
} from './storage-limit.dto';
import { StorageLimitService } from './storage-limit.service';

@ApiTags('admin-storage-limits')
@Controller('admin/storage-limits')
@UsePipes(new ValidationPipe({ transform: true }))
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class StorageLimitController {
  constructor(private readonly storageLimitService: StorageLimitService) {}

  @Get()
  async getLimits(): Promise<StorageLimitDto[]> {
    return await this.storageLimitService.getLimits();
  }

  @Post()
  async createLimit(
    @Body() dto: CreateStorageLimitDto,
  ): Promise<StorageLimitDto> {
    return await this.storageLimitService.createLimit(dto);
  }

  // Declared before ':id' so 'assignments' is never read as an id.
  @Get('assignments')
  async getAssignments(
    @Query() query: StorageAssignmentQueryDto,
  ): Promise<PaginatedStorageAssignmentsDto> {
    return await this.storageLimitService.getAssignments(query);
  }

  @Put('assignments/:photographerId')
  async assignLimit(
    @Param('photographerId') photographerId: string,
    @Body() dto: AssignStorageLimitDto,
  ): Promise<{ success: boolean }> {
    return await this.storageLimitService.assignLimit(photographerId, dto);
  }

  @Patch(':id')
  async updateLimit(
    @Param('id') id: string,
    @Body() dto: UpdateStorageLimitDto,
  ): Promise<StorageLimitDto> {
    return await this.storageLimitService.updateLimit(id, dto);
  }

  @Delete(':id')
  async deleteLimit(@Param('id') id: string): Promise<{ success: boolean }> {
    return await this.storageLimitService.deleteLimit(id);
  }
}
