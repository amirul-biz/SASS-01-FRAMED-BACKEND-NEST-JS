import { OrderPaymentTracking } from './order.constants';
import { getPaymentTrackingWhere } from './order.repository';

describe('getPaymentTrackingWhere', () => {
  it('matches only orders that have a payment for TRACKED', () => {
    expect(getPaymentTrackingWhere(OrderPaymentTracking.TRACKED)).toEqual({
      payments: { some: {} },
    });
  });

  it('matches only orders without any payment for LEGACY', () => {
    expect(getPaymentTrackingWhere(OrderPaymentTracking.LEGACY)).toEqual({
      payments: { none: {} },
    });
  });

  it('adds no condition when no tracking filter is given', () => {
    expect(getPaymentTrackingWhere()).toEqual({});
  });
});
