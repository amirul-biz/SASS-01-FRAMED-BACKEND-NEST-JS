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
  ConfirmPhotoUploadDto,
  PaginatedPhotoListResponseDto,
  PhotoListQueryDto,
  PhotoResponseDto,
  PresignPhotosBatchDto,
  PresignPhotosBatchResponseDto,
  ReuploadPhotoDto,
  ReuploadPhotoResponseDto,
  UpdatePhotoAlbumCoverDto,
} from './photo.dto';
import { PhotoService } from './photo.service';

@Controller('events/:eventId/photos')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.PHOTOGRAPHER)
export class PhotoController {
  constructor(private readonly photoService: PhotoService) {}

  @Post('presign-batch')
  @UsePipes(new ValidationPipe({ transform: true }))
  async presignBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId') eventId: string,
    @Body() dto: PresignPhotosBatchDto,
  ): Promise<PresignPhotosBatchResponseDto> {
    return await this.photoService.presignBatch(user, eventId, dto);
  }

  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  async listPhotos(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId') eventId: string,
    @Query() query: PhotoListQueryDto,
  ): Promise<PaginatedPhotoListResponseDto> {
    return await this.photoService.listPhotos(user, eventId, query);
  }

  @Post(':photoId/confirm')
  @UsePipes(new ValidationPipe({ transform: true }))
  async confirmUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId') eventId: string,
    @Param('photoId') photoId: string,
    @Body() dto: ConfirmPhotoUploadDto,
  ): Promise<PhotoResponseDto> {
    return await this.photoService.confirmUpload(user, eventId, photoId, dto);
  }

  @Post(':photoId/reupload')
  @UsePipes(new ValidationPipe({ transform: true }))
  async reupload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId') eventId: string,
    @Param('photoId') photoId: string,
    @Body() dto: ReuploadPhotoDto,
  ): Promise<ReuploadPhotoResponseDto> {
    return await this.photoService.reupload(user, eventId, photoId, dto);
  }

  @Patch(':photoId/album-cover')
  @UsePipes(new ValidationPipe({ transform: true }))
  async setAlbumCover(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId') eventId: string,
    @Param('photoId') photoId: string,
    @Body() dto: UpdatePhotoAlbumCoverDto,
  ): Promise<PhotoResponseDto> {
    return await this.photoService.setAlbumCover(user, eventId, photoId, dto);
  }

  @Delete(':photoId')
  async deletePhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId') eventId: string,
    @Param('photoId') photoId: string,
  ): Promise<{ success: boolean }> {
    await this.photoService.deletePhoto(user, eventId, photoId);
    return { success: true };
  }
}
