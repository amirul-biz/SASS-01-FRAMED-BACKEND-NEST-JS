import { Injectable, Logger } from '@nestjs/common';
import { HeadObjectCommand, NotFound, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
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
  private readonly bucketName = process.env.R2_PRIVATE_BUCKET_NAME;
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
    const { client, bucketName } = this.requireClient();

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: file.originalName,
      Body: file.buffer,
      ContentType: file.mimeType,
    });

    await client.send(command);
    return file.originalName;
  }

  async getPresignedUploadUrl(params: {
    key: string;
    mimeType: string;
    expiresIn?: number;
  }): Promise<string> {
    const { client, bucketName } = this.requireClient();

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: params.key,
      ContentType: params.mimeType,
    });

    return await getSignedUrl(client, command, { expiresIn: params.expiresIn ?? 300 });
  }

  async objectExists(key: string): Promise<boolean> {
    const { client, bucketName } = this.requireClient();

    try {
      await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
      return true;
    } catch (error) {
      if (error instanceof NotFound) {
        return false;
      }
      throw error;
    }
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

  private requireClient(): { client: S3Client; bucketName: string } {
    if (!this.s3Client || !this.bucketName) {
      throw new Error(
        'File upload is not configured. Please set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_PRIVATE_BUCKET_NAME.',
      );
    }

    return { client: this.s3Client, bucketName: this.bucketName };
  }
}
