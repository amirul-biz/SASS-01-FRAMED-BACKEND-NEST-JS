import { BadRequestException } from '@nestjs/common';
import { OrderPricingService } from './order-pricing.service';

describe('OrderPricingService', () => {
  const service = new OrderPricingService();

  const event = {
    pricingBundles: [
      {
        pricingOptions: [
          { id: 'opt-jpeg', label: '30MP JPEG', price: 12 },
          { id: 'opt-raw', label: 'RAW', price: 27 },
        ],
        vouchers: [
          {
            id: 'voucher-1',
            name: 'Group Deal',
            discountType: 'flat-tier',
            conditions: [{ minPhotos: 2, maxPhotos: 2, value: 30 }],
          },
        ],
      },
    ],
  } as any;

  const buildDto = (overrides: Record<string, unknown> = {}): any => ({
    eventId: 'event-1',
    items: [
      {
        photoId: 'p1',
        pricingOptionId: 'opt-jpeg',
        formatLabel: '30MP JPEG',
        price: 12,
      },
      {
        photoId: 'p2',
        pricingOptionId: 'opt-raw',
        formatLabel: 'RAW',
        price: 27,
      },
    ],
    subtotal: 39,
    discountAmount: 0,
    total: 39,
    ...overrides,
  });

  it('prices items from the event options and returns server-computed totals', () => {
    const pricing = service.getValidatedPricing(event, buildDto());

    expect(pricing.total).toBe(39);
    expect(pricing.items).toEqual([
      { photoId: 'p1', formatLabel: '30MP JPEG', price: 12 },
      { photoId: 'p2', formatLabel: 'RAW', price: 27 },
    ]);
    expect(pricing.voucherId).toBeNull();
  });

  it('applies the chosen voucher and snapshots its name', () => {
    const pricing = service.getValidatedPricing(
      event,
      buildDto({ voucherId: 'voucher-1', discountAmount: 9, total: 30 }),
    );

    expect(pricing).toMatchObject({
      voucherId: 'voucher-1',
      voucherName: 'Group Deal',
      subtotal: 39,
      discountAmount: 9,
      total: 30,
    });
  });

  it('rejects an event with no pricing options - there is no built-in default price', () => {
    const eventWithoutOptions = { pricingBundles: [] } as any;

    expect(() =>
      service.getValidatedPricing(eventWithoutOptions, buildDto()),
    ).toThrow('no pricing options');
  });

  it('does not accept a made-up "standard" option on an event that has options', () => {
    const dto = buildDto({
      items: [
        {
          photoId: 'p1',
          pricingOptionId: 'standard',
          formatLabel: 'Standard',
          price: 12,
        },
      ],
      subtotal: 12,
      total: 12,
    });

    expect(() => service.getValidatedPricing(event, dto)).toThrow(
      BadRequestException,
    );
  });

  it('rejects an unknown pricing option', () => {
    const dto = buildDto({
      items: [
        { photoId: 'p1', pricingOptionId: 'nope', formatLabel: 'x', price: 12 },
      ],
    });

    expect(() => service.getValidatedPricing(event, dto)).toThrow(
      'Unknown pricing option',
    );
  });

  it('rejects an item price that differs from the option price', () => {
    const dto = buildDto({
      items: [
        {
          photoId: 'p1',
          pricingOptionId: 'opt-raw',
          formatLabel: 'RAW',
          price: 0.01,
        },
      ],
    });

    expect(() => service.getValidatedPricing(event, dto)).toThrow(
      'Prices have changed',
    );
  });

  it('rejects a tampered total', () => {
    expect(() =>
      service.getValidatedPricing(event, buildDto({ total: 1 })),
    ).toThrow('Prices have changed');
  });

  it('rejects a voucher that is not part of the event', () => {
    expect(() =>
      service.getValidatedPricing(event, buildDto({ voucherId: 'other' })),
    ).toThrow('Voucher is not available');
  });

  it('rejects a voucher whose tier the photo count does not reach', () => {
    const dto = buildDto({
      voucherId: 'voucher-1',
      items: [
        {
          photoId: 'p1',
          pricingOptionId: 'opt-jpeg',
          formatLabel: '30MP JPEG',
          price: 12,
        },
      ],
      subtotal: 12,
      total: 12,
    });

    expect(() => service.getValidatedPricing(event, dto)).toThrow(
      'does not apply',
    );
  });
});
