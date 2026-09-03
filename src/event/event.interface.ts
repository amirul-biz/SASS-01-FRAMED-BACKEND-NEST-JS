import type { EventCategory } from '../../generated/prisma/enums';
import type { VoucherConditionDto, WireVoucherDiscountType } from '../vouchers/vouchers.dto';
import type { UpdateEventDto } from './event.dto';

export interface UpdateEventRepositoryData extends UpdateEventDto {
  publishedAt?: Date;
}

export interface PaginatedEvents<T> {
  items: T[];
  totalItemCount: number;
}

export interface LatestPublishedEvent {
  id: string;
  title: string;
  category: EventCategory;
  location: string | null;
  coverPhotoUrl: string | null;
  eventStartDate: Date;
  eventEndDate: Date;
  photoCount: number;
  photographerId: string;
  photographerName: string;
}

export interface PublishedEventPricingOption {
  id: string;
  label: string;
  price: number;
}

export interface PublishedEventVoucher {
  id: string;
  name: string;
  discountType: WireVoucherDiscountType;
  conditions: VoucherConditionDto[];
}

export interface PublishedEventPricingBundle {
  id: string;
  name: string;
  fullGalleryEnabled: boolean;
  fullGalleryPrice: number;
  pricingOptions: PublishedEventPricingOption[];
  vouchers: PublishedEventVoucher[];
}

export interface PublishedEventDetail extends LatestPublishedEvent {
  photographerPhone: string | null;
  photographerContactNo: string | null;
  description: string | null;
  pricingBundles: PublishedEventPricingBundle[];
  albumCoverPhotoUrls: string[];
}
