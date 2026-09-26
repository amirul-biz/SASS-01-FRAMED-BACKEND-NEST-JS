import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  PublishedEventDetail,
  PublishedEventPricingOption,
  PublishedEventVoucher,
} from '../event/event.interface';
import { CreateOrderDto, CreateOrderItemDto } from './order.dto';
import { CLIENT_TOTAL_TOLERANCE } from './order.constants';
import type {
  ValidatedOrderItem,
  ValidatedOrderPricing,
} from './order.interface';
import {
  OrderPricing,
  calculateOrderPricing,
  findQualifyingCondition,
} from './order-pricing.util';

const PRICES_CHANGED_MESSAGE =
  'Prices have changed, please refresh and try again';

@Injectable()
export class OrderPricingService {
  getValidatedPricing(
    event: PublishedEventDetail,
    dto: CreateOrderDto,
  ): ValidatedOrderPricing {
    const allowedOptions = this.getAllowedPricingOptions(event);
    const items = this.getResolvedItems(dto.items, allowedOptions);
    const voucher = this.getApplicableVoucher(
      event,
      dto.voucherId,
      items.length,
    );
    const pricing = calculateOrderPricing(
      items.map((item) => item.price),
      voucher,
    );
    if (!this.isClientPricingMatching(dto, pricing)) {
      throw new BadRequestException(PRICES_CHANGED_MESSAGE);
    }

    return {
      items,
      voucherId: voucher?.id ?? null,
      voucherName: voucher?.name ?? null,
      ...pricing,
    };
  }

  private getAllowedPricingOptions(
    event: PublishedEventDetail,
  ): PublishedEventPricingOption[] {
    const eventOptions = event.pricingBundles.flatMap(
      (bundle) => bundle.pricingOptions,
    );
    const isEventOptionsEmpty = eventOptions.length === 0;
    if (isEventOptionsEmpty) {
      throw new BadRequestException(
        'This event has no pricing options yet, so its photos cannot be ordered',
      );
    }
    return eventOptions;
  }

  private getResolvedItems(
    items: CreateOrderItemDto[],
    allowedOptions: PublishedEventPricingOption[],
  ): ValidatedOrderItem[] {
    return items.map((item) => this.getResolvedItem(item, allowedOptions));
  }

  private getResolvedItem(
    item: CreateOrderItemDto,
    allowedOptions: PublishedEventPricingOption[],
  ): ValidatedOrderItem {
    const option = allowedOptions.find(
      (allowedOption) => allowedOption.id === item.pricingOptionId,
    );
    if (!option) {
      throw new BadRequestException('Unknown pricing option for this event');
    }
    if (!this.isWithinTolerance(item.price, option.price)) {
      throw new BadRequestException(PRICES_CHANGED_MESSAGE);
    }
    return {
      photoId: item.photoId,
      formatLabel: option.label,
      price: option.price,
    };
  }

  private getApplicableVoucher(
    event: PublishedEventDetail,
    voucherId: string | undefined,
    photoCount: number,
  ): PublishedEventVoucher | undefined {
    if (!voucherId) {
      return undefined;
    }
    const eventVouchers = event.pricingBundles.flatMap(
      (bundle) => bundle.vouchers,
    );
    const voucher = eventVouchers.find(
      (eventVoucher) => eventVoucher.id === voucherId,
    );
    if (!voucher) {
      throw new BadRequestException('Voucher is not available for this event');
    }
    const qualifyingCondition = findQualifyingCondition(
      photoCount,
      voucher.conditions,
    );
    if (!qualifyingCondition) {
      throw new BadRequestException(
        'Voucher does not apply to this number of photos',
      );
    }
    return voucher;
  }

  private isClientPricingMatching(
    dto: CreateOrderDto,
    pricing: OrderPricing,
  ): boolean {
    const isSubtotalMatching = this.isWithinTolerance(
      dto.subtotal,
      pricing.subtotal,
    );
    const isDiscountMatching = this.isWithinTolerance(
      dto.discountAmount,
      pricing.discountAmount,
    );
    const isTotalMatching = this.isWithinTolerance(dto.total, pricing.total);

    return isSubtotalMatching && isDiscountMatching && isTotalMatching;
  }

  private isWithinTolerance(clientValue: number, serverValue: number): boolean {
    return Math.abs(clientValue - serverValue) <= CLIENT_TOTAL_TOLERANCE;
  }
}
