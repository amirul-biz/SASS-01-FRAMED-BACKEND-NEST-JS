export const PHOTO_BATCH_MAX_FILES = 50;

export const PHOTO_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export const PHOTO_RECONCILIATION_GRACE_MINUTES = 10;
export const PHOTO_RECONCILIATION_HARD_FAIL_HOURS = 24;

export const PHOTO_PAGINATION = {
  DEFAULT_PAGE_NUMBER: 1,
  DEFAULT_PAGE_SIZE: 30,
  PAGE_SIZE_MAX: 500,
} as const;
