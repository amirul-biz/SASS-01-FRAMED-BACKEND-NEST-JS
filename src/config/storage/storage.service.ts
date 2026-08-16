import { Injectable, Logger } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadableFile {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client?: S3Client;
  private readonly bucketName = process.env.R2_BUCKET_NAME;
  private readonly publicUrl = process.env.R2_PUBLIC_URL;

  constructor() {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (endpoint && accessKeyId && secretAccessKey) {
      try {
        this.s3Client = new S3Client({
          endpoint,
          region: 'auto', // Cloudflare R2 requires 'auto'
          credentials: { accessKeyId, secretAccessKey },
        });
      } catch (error) {
        this.logger.warn(
          `Failed to initialize R2 client with the provided credentials: ${(error as Error).message}`,
        );
      }
    }
  }

  async uploadFile(file: UploadableFile): Promise<string> {
    if (!this.s3Client || !this.bucketName) {
      throw new Error(
        'File upload is not configured. Please set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.',
      );
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: file.originalName,
      Body: file.buffer,
      ContentType: file.mimeType,
    });

    await this.s3Client.send(command);
    return file.originalName;
  }

  async getPresignedUploadUrl(params: {
    key: string;
    mimeType: string;
  }): Promise<string> {
    if (!this.s3Client || !this.bucketName) {
      throw new Error(
        'File upload is not configured. Please set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.',
      );
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: params.key,
      ContentType: params.mimeType,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn: 300 });
  }

  buildPublicUrl(key: string): string {
    if (!this.publicUrl) {
      throw new Error('R2_PUBLIC_URL is not configured.');
    }

    return `${this.publicUrl.replace(/\/$/, '')}/${key}`;
  }

  isOwnPublicUrl(url: string): boolean {
    return !!this.publicUrl && url.startsWith(this.publicUrl.replace(/\/$/, ''));
  }
}
