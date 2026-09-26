import type {
  VoucherConditionDto,
  WireVoucherDiscountType,
} from '../vouchers/vouchers.dto';

export interface PricingVoucher {
  discountType: WireVoucherDiscountType;
  conditions: VoucherConditionDto[];
}

export interface OrderPricing {
  subtotal: number;
  discountAmount: number;
  total: number;
}

export function roundToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getAveragePerUnit(total: number, unitCount: number): number {
  const isNoUnits = unitCount === 0;
  return isNoUnits ? 0 : roundToCents(total / unitCount);
}

function sumPrices(prices: number[]): number {
  return prices.reduce((total, price) => total + price, 0);
}

export function findQualifyingCondition(
  photoCount: number,
  conditions: VoucherConditionDto[],
): VoucherConditionDto | undefined {
  const eligibleConditions = conditions.filter(
    (condition) => photoCount >= condition.minPhotos,
  );
  return eligibleConditions.reduce<VoucherConditionDto | undefined>(
    (deepest, condition) =>
      !deepest || condition.minPhotos > deepest.minPhotos ? condition : deepest,
    undefined,
  );
}

function getTierTotal(
  pricesDescending: number[],
  voucher: PricingVoucher,
  condition: VoucherConditionDto,
): number {
  const isMaxPhotosUnlimited =
    condition.maxPhotos === null || condition.maxPhotos === undefined;
  const coveredCount = isMaxPhotosUnlimited
    ? pricesDescending.length
    : Math.min(condition.maxPhotos as number, pricesDescending.length);
  const coveredTotal = sumPrices(pricesDescending.slice(0, coveredCount));
  const extraTotal = sumPrices(pricesDescending.slice(coveredCount));

  const isFlatTier = voucher.discountType === 'flat-tier';
  const tierPrice = isFlatTier
    ? condition.value
    : coveredTotal * (1 - condition.value / 100);
  return tierPrice + extraTotal;
}

export function calculateOrderPricing(
  photoPrices: number[],
  voucher?: PricingVoucher,
): OrderPricing {
  const subtotal = roundToCents(sumPrices(photoPrices));
  const condition = voucher
    ? findQualifyingCondition(photoPrices.length, voucher.conditions)
    : undefined;

  const isVoucherApplied = voucher !== undefined && condition !== undefined;
  if (!isVoucherApplied) {
    return { subtotal, discountAmount: 0, total: subtotal };
  }

  const pricesDescending = [...photoPrices].sort((a, b) => b - a);
  const total = roundToCents(
    getTierTotal(pricesDescending, voucher, condition),
  );
  return { subtotal, discountAmount: roundToCents(subtotal - total), total };
}
