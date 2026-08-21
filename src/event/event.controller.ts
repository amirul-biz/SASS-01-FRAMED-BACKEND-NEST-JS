import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { FirebaseAuthGuard } from 'src/common/guards/firebase-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../types/express';
import {
  CreateEventDto,
  EventListQueryDto,
  EventResponseDto,
  PaginatedEventListResponseDto,
  PresignEventCoverPhotoUploadDto,
  PresignEventCoverPhotoUploadResponseDto,
  UpdateEventDto,
} from './event.dto';
import { EventService } from './event.service';

@Controller('events')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.PHOTOGRAPHER)
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  async createEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEventDto,
  ): Promise<EventResponseDto> {
    return await this.eventService.createEvent(user, dto);
  }

  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  async listMyEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: EventListQueryDto,
  ): Promise<PaginatedEventListResponseDto> {
    return await this.eventService.listMyEvents(user, query);
  }

  @Post('cover-photo/presign')
  @UsePipes(new ValidationPipe({ transform: true }))
  async presignCoverPhotoUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PresignEventCoverPhotoUploadDto,
  ): Promise<PresignEventCoverPhotoUploadResponseDto> {
    return await this.eventService.presignCoverPhotoUpload(user, dto);
  }

  @Get(':id')
  async getMyEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<EventResponseDto> {
    return await this.eventService.getMyEvent(user, id);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateMyEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ): Promise<EventResponseDto> {
    return await this.eventService.updateMyEvent(user, id, dto);
  }

  @Delete(':id')
  async deleteMyEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    await this.eventService.deleteMyEvent(user, id);
    return { success: true };
  }
}
