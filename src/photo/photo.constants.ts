export const PHOTO_BATCH_MAX_FILES = 50;
// Deletes are a single scoped updateMany per request — much cheaper than presigning — so the
// batch cap here matches the largest photo-list page (500) rather than the presign batch limit.
export const PHOTO_DELETE_BATCH_MAX = 500;

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
