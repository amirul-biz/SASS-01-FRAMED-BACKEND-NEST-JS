import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FirebaseService } from '../config/firebase/firebase.service';
import { PrivateStorageService } from '../config/storage/private-storage.service';
import { PublicStorageService } from '../config/storage/public-storage.service';
import { UserRole } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../types/express';
import { randomUUID } from 'crypto';
import { sanitizeFileName } from 'src/common/utils/sanitize-file-name';
import {
  PhotographerProfileResponseDto,
  PresignProfileImageUploadDto,
  PresignProfileImageUploadResponseDto,
  RegisterPhotographerInputDto,
  RegisterPhotographerOutputDto,
  UpdatePhotographerProfileDto,
} from './photographer.dto';
import { PhotographerRepository } from './photographer.repository';
import type {
  PublicPhotographerProfile,
  TopPhotographerByEventCount,
} from './photographer.interface';

@Injectable()
export class PhotographerService {
  private readonly logger = new Logger(PhotographerService.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly photographerRepository: PhotographerRepository,
    private readonly privateStorageService: PrivateStorageService,
    private readonly publicStorageService: PublicStorageService,
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
    // concurrent R2 uploads at once.
    for (const file of files) {
      try {
        await this.privateStorageService.uploadFile({
          originalName: file.originalname,
          mimeType: file.mimetype,
          buffer: file.buffer,
        });
      } catch (error) {
        this.logger.error(
          `Failed to process upload for "${file.originalname}": ${(error as Error).message}`,
        );
      }
    }
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
      !this.publicStorageService.isOwnPublicUrl(dto.profileImageUrl)
    ) {
      throw new BadRequestException('Invalid profile image URL');
    }

    if (
      dto.bannerUrl !== undefined &&
      !this.publicStorageService.isOwnPublicUrl(dto.bannerUrl)
    ) {
      throw new BadRequestException('Invalid banner URL');
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
    const sanitizedFileName = sanitizeFileName(dto.fileName);
    const key = `photographer-profiles/${userPlatformId}/${randomUUID()}-${sanitizedFileName}`;
    const expiresIn = 300;

    const uploadUrl = await this.publicStorageService.getPresignedUploadUrl({
      key,
      mimeType: dto.mimeType,
    });
    const publicUrl = this.publicStorageService.buildPublicUrl(key);

    return { uploadUrl, publicUrl, key, expiresIn };
  }

  async presignProfileBannerUpload(
    user: AuthenticatedUser,
    dto: PresignProfileImageUploadDto,
  ): Promise<PresignProfileImageUploadResponseDto> {
    const userPlatformId = this.getOwnPhotographerPlatformId(user);
    const sanitizedFileName = sanitizeFileName(dto.fileName);
    const key = `photographer-profiles/${userPlatformId}/banner/${randomUUID()}-${sanitizedFileName}`;
    const expiresIn = 300;

    const uploadUrl = await this.publicStorageService.getPresignedUploadUrl({
      key,
      mimeType: dto.mimeType,
    });
    const publicUrl = this.publicStorageService.buildPublicUrl(key);

    return { uploadUrl, publicUrl, key, expiresIn };
  }

  async getTopPhotographersByEventCount(
    limit: number,
  ): Promise<TopPhotographerByEventCount[]> {
    return await this.photographerRepository.getPublicList({ limit });
  }

  async searchPublicPhotographers(
    search: string | undefined,
    limit: number,
  ): Promise<TopPhotographerByEventCount[]> {
    return await this.photographerRepository.getPublicList({ search, limit });
  }

  async getPublicProfile(id: string): Promise<PublicPhotographerProfile> {
    const profile = await this.photographerRepository.getPublicProfileById(id);
    if (!profile) {
      throw new NotFoundException('Photographer not found');
    }
    return profile;
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
