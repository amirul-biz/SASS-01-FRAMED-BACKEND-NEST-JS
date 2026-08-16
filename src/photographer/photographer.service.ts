import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { FirebaseService } from '../config/firebase/firebase.service';
import { StorageService } from '../config/storage/storage.service';
import {
  ATTACHMENT_UPLOADED_EVENT_PATTERN,
  UPLOAD_ATTACHMENT_QUEUE_CLIENT,
} from '../config/queue/attachment-queue.constants';
import { AttachmentUploadedEvent } from '../config/queue/attachment-uploaded.event';
import { UserRole } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../types/express';
import { randomUUID } from 'crypto';
import {
  PhotographerProfileResponseDto,
  PresignProfileImageUploadDto,
  PresignProfileImageUploadResponseDto,
  RegisterPhotographerInputDto,
  RegisterPhotographerOutputDto,
  UpdatePhotographerProfileDto,
} from './photographer.dto';
import { PhotographerRepository } from './photographer.repository';

@Injectable()
export class PhotographerService {
  private readonly logger = new Logger(PhotographerService.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly photographerRepository: PhotographerRepository,
    private readonly storageService: StorageService,
    @Inject(UPLOAD_ATTACHMENT_QUEUE_CLIENT)
    private readonly attachmentQueueClient: ClientProxy,
  ) {}

  async registerPhotographer(
    input: RegisterPhotographerInputDto,
  ): Promise<RegisterPhotographerOutputDto> {
    let firebaseUser: { uid: string } | null = null;

    try {
      firebaseUser = await this.firebaseService.createUser(
        input.email,
        input.password,
      );

      const result =
        await this.photographerRepository.createPhotographerWithTransaction({
          firebaseId: firebaseUser.uid,
          email: input.email,
          name: input.name,
          bio: input.bio,
          companyName: input.companyName,
          phone: input.phone,
        });

      const output = new RegisterPhotographerOutputDto();
      output.success = true;
      output.message = 'Photographer registered successfully';
      output.data = result;

      return output;
    } catch (error) {
      if (firebaseUser?.uid) {
        await this.firebaseService.deleteUser(firebaseUser.uid);
      }
      throw new Error(`Registration failed: ${(error as Error).message}`);
    }
  }

  async uploadPhotos(files: Express.Multer.File[]): Promise<void> {
    if (!files?.length) {
      throw new BadRequestException('No files uploaded');
    }

    // Sequential on purpose: a large batch shouldn't fire hundreds of
    // concurrent R2 uploads and queue publishes at once.
    for (const file of files) {
      try {
        const key = await this.storageService.uploadFile({
          originalName: file.originalname,
          mimeType: file.mimetype,
          buffer: file.buffer,
        });
        await this.publishAttachmentUploaded({
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          key,
        });
      } catch (error) {
        this.logger.error(
          `Failed to process upload for "${file.originalname}": ${(error as Error).message}`,
        );
      }
    }
  }

  private async publishAttachmentUploaded(
    event: AttachmentUploadedEvent,
  ): Promise<void> {
    await firstValueFrom(
      this.attachmentQueueClient.emit(ATTACHMENT_UPLOADED_EVENT_PATTERN, event),
    );
  }

  async getMyProfile(
    user: AuthenticatedUser,
  ): Promise<PhotographerProfileResponseDto> {
    const userPlatformId = this.getOwnPhotographerPlatformId(user);
    const profile =
      await this.photographerRepository.getProfileByUserPlatformId(
        userPlatformId,
      );

    if (!profile) {
      throw new NotFoundException('Photographer profile not found');
    }

    return profile;
  }

  async updateMyProfile(
    user: AuthenticatedUser,
    dto: UpdatePhotographerProfileDto,
  ): Promise<PhotographerProfileResponseDto> {
    if (
      dto.profileImageUrl !== undefined &&
      !this.storageService.isOwnPublicUrl(dto.profileImageUrl)
    ) {
      throw new BadRequestException('Invalid profile image URL');
    }

    const userPlatformId = this.getOwnPhotographerPlatformId(user);
    return await this.photographerRepository.updateProfileByUserPlatformId(
      userPlatformId,
      dto,
    );
  }

  async presignProfileImageUpload(
    user: AuthenticatedUser,
    dto: PresignProfileImageUploadDto,
  ): Promise<PresignProfileImageUploadResponseDto> {
    const userPlatformId = this.getOwnPhotographerPlatformId(user);
    const sanitizedFileName = dto.fileName.replace(/[^a-zA-Z0-9.-]/g, '-');
    const key = `photographer-profiles/${userPlatformId}/${randomUUID()}-${sanitizedFileName}`;
    const expiresIn = 300;

    const uploadUrl = await this.storageService.getPresignedUploadUrl({
      key,
      mimeType: dto.mimeType,
    });
    const publicUrl = this.storageService.buildPublicUrl(key);

    return { uploadUrl, publicUrl, key, expiresIn };
  }

  async getOwnPhotographerProfileId(user: AuthenticatedUser): Promise<string> {
    const userPlatformId = this.getOwnPhotographerPlatformId(user);
    const profile =
      await this.photographerRepository.getProfileByUserPlatformId(
        userPlatformId,
      );

    if (!profile) {
      throw new NotFoundException('Photographer profile not found');
    }

    return profile.id;
  }

  private getOwnPhotographerPlatformId(user: AuthenticatedUser): string {
    const photographerPlatform = user.userPlatforms.find(
      (platform) => platform.role === UserRole.PHOTOGRAPHER,
    );

    if (!photographerPlatform) {
      throw new NotFoundException('Photographer profile not found');
    }

    return photographerPlatform.id;
  }
}
