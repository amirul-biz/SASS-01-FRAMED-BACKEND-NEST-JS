import type { Prisma } from '../../generated/prisma/client';
import type { CountryCode } from '../../generated/prisma/enums';

export interface ValidatedOrderItem {
  photoId: string;
  formatLabel: string;
  price: number;
}

export interface ValidatedOrderPricing {
  items: ValidatedOrderItem[];
  voucherId: string | null;
  voucherName: string | null;
  subtotal: number;
  discountAmount: number;
  total: number;
}

export interface CreateOrderRecord {
  eventId: string;
  email: string;
  countryCode: CountryCode;
  phone: string;
  idempotencyKey: string;
  pricing: ValidatedOrderPricing;
  payment: Prisma.MerchantPaymentCreateWithoutOrderInput;
}
