import type { PhotoUploadStatus } from '../../generated/prisma/enums';

export interface CreatePendingPhotoData {
  id: string;
  eventId: string;
  key: string;
  originalName: string;
  mimeType: string;
  sizeBytes?: number;
}

export interface UpdatePhotoStatusData {
  status: PhotoUploadStatus;
  uploadedAt?: Date;
  width?: number;
  height?: number;
  capturedAt?: Date;
}

export interface PaginatedPhotos<T> {
  items: T[];
  totalItemCount: number;
}

export interface PublicPhoto {
  id: string;
  originalName: string;
  url: string | null;
  width: number | null;
  height: number | null;
  capturedAt: Date | null;
}

export interface PaginatedPublicPhotoList {
  items: PublicPhoto[];
  totalItemCount: number;
  totalPageCount: number;
  pageNumber: number;
  pageSize: number;
}
