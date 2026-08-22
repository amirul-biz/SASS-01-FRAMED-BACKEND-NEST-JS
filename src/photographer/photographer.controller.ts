import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { type Express } from 'express';
import {
  PhotographerProfileResponseDto,
  PresignProfileImageUploadDto,
  PresignProfileImageUploadResponseDto,
  RegisterPhotographerInputDto,
  RegisterPhotographerOutputDto,
  UpdatePhotographerProfileDto,
} from './photographer.dto';
import { PhotographerService } from './photographer.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { FirebaseAuthGuard } from 'src/common/guards/firebase-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../types/express';

@Controller('photographer')
export class PhotographerController {
  private readonly logger = new Logger(PhotographerController.name);

  constructor(private readonly photographerService: PhotographerService) {}

  @Post('register')
  @UsePipes(new ValidationPipe({ transform: true }))
  async register(
    @Body() dto: RegisterPhotographerInputDto,
  ): Promise<RegisterPhotographerOutputDto> {
    return await this.photographerService.registerPhotographer(dto);
  }

  @Post('upload')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  // @UseGuards(FirebaseAuthGuard, RolesGuard)
  // @Roles(UserRole.PHOTOGRAPHER)
  @UseInterceptors(FilesInterceptor('files'))
  uploadFiles(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) {
      throw new BadRequestException('No files uploaded');
    }

    this.photographerService.uploadPhotos(files).catch((error: Error) => {
      this.logger.error(`Failed to process photo upload: ${error.message}`);
    });

    return { accepted: true, fileCount: files.length };
  }

  @Post('profile/image/presign')
  @ApiBearerAuth()
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.PHOTOGRAPHER)
  @UsePipes(new ValidationPipe({ transform: true }))
  async presignProfileImageUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PresignProfileImageUploadDto,
  ): Promise<PresignProfileImageUploadResponseDto> {
    return await this.photographerService.presignProfileImageUpload(user, dto);
  }

  @Post('profile/banner/presign')
  @ApiBearerAuth()
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.PHOTOGRAPHER)
  @UsePipes(new ValidationPipe({ transform: true }))
  async presignProfileBannerUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PresignProfileImageUploadDto,
  ): Promise<PresignProfileImageUploadResponseDto> {
    return await this.photographerService.presignProfileBannerUpload(user, dto);
  }

  @Get('profile')
  @ApiBearerAuth()
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.PHOTOGRAPHER)
  async getMyProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PhotographerProfileResponseDto> {
    return await this.photographerService.getMyProfile(user);
  }

  @Patch('profile')
  @ApiBearerAuth()
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.PHOTOGRAPHER)
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePhotographerProfileDto,
  ): Promise<PhotographerProfileResponseDto> {
    return await this.photographerService.updateMyProfile(user, dto);
  }
}
