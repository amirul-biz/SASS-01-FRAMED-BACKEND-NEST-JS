import {
  calculateOrderPricing,
  findQualifyingCondition,
} from './order-pricing.util';

describe('order-pricing.util', () => {
  const flatVoucher = {
    discountType: 'flat-tier' as const,
    conditions: [{ minPhotos: 4, maxPhotos: 5, value: 35 }],
  };
  const percentVoucher = {
    discountType: 'percent-tier' as const,
    conditions: [{ minPhotos: 3, maxPhotos: 5, value: 50 }],
  };

  describe('findQualifyingCondition', () => {
    it('picks the deepest eligible tier', () => {
      const conditions = [
        { minPhotos: 5, maxPhotos: 9, value: 10 },
        { minPhotos: 10, maxPhotos: null, value: 20 },
      ];

      expect(findQualifyingCondition(12, conditions)?.minPhotos).toBe(10);
    });

    it('returns undefined when the photo count is below every tier', () => {
      expect(
        findQualifyingCondition(2, percentVoucher.conditions),
      ).toBeUndefined();
    });
  });

  describe('calculateOrderPricing', () => {
    it('charges the plain sum when no voucher is chosen', () => {
      expect(calculateOrderPricing([12, 17])).toEqual({
        subtotal: 29,
        discountAmount: 0,
        total: 29,
      });
    });

    it('replaces the covered photos with the flat tier price', () => {
      const pricing = calculateOrderPricing([12, 12, 12, 12], flatVoucher);

      expect(pricing).toEqual({ subtotal: 48, discountAmount: 13, total: 35 });
    });

    it('discounts the covered photos by the tier percentage', () => {
      const pricing = calculateOrderPricing([12, 17, 27], percentVoucher);

      expect(pricing).toEqual({ subtotal: 56, discountAmount: 28, total: 28 });
    });

    it('bills photos beyond maxPhotos at their own price, covering the priciest first', () => {
      const pricing = calculateOrderPricing(
        [27, 17, 15, 12, 12, 12],
        flatVoucher,
      );

      expect(pricing.total).toBe(47);
      expect(pricing.subtotal).toBe(95);
    });

    it('applies no discount when the chosen voucher does not qualify', () => {
      expect(calculateOrderPricing([12, 12], flatVoucher)).toEqual({
        subtotal: 24,
        discountAmount: 0,
        total: 24,
      });
    });

    it('rounds to whole cents', () => {
      const pricing = calculateOrderPricing([10.01, 10.01, 10.01], {
        discountType: 'percent-tier',
        conditions: [{ minPhotos: 3, maxPhotos: null, value: 33 }],
      });

      expect(pricing.total).toBe(20.12);
    });
  });
});
