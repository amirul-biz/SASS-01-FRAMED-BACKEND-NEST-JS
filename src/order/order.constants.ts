export const ORDER_PAGINATION = {
  DEFAULT_PAGE_NUMBER: 1,
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_MAX: 100,
} as const;

export enum OrderPaymentTracking {
  TRACKED = 'TRACKED',
  LEGACY = 'LEGACY',
}

export const CLIENT_TOTAL_TOLERANCE = 0.01;
