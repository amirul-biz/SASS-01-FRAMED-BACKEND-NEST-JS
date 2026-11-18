import { BadRequestException } from '@nestjs/common';

// Months are Malaysia time (UTC+8, no DST). A "period" is the first day of the month as a UTC-midnight
// Date, which is what the DATE column stores.
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
const PAYMENT_WINDOW_LAST_DAY = 5;

export type CommissionDisplayStatus = 'ACCRUING' | 'DUE' | 'OVERDUE' | 'PAID';

const toMyt = (date: Date): Date => new Date(date.getTime() + MYT_OFFSET_MS);

export function periodOf(date: Date): Date {
  const myt = toMyt(date);
  return new Date(Date.UTC(myt.getUTCFullYear(), myt.getUTCMonth(), 1));
}

export function nextPeriod(period: Date): Date {
  return new Date(
    Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 1, 1),
  );
}

// The real instants a period covers: [gte, lt).
export function periodRange(period: Date): { gte: Date; lt: Date } {
  return {
    gte: new Date(period.getTime() - MYT_OFFSET_MS),
    lt: new Date(nextPeriod(period).getTime() - MYT_OFFSET_MS),
  };
}

export function periodKey(period: Date): string {
  return period.toISOString().slice(0, 7);
}

export function parsePeriod(key: string): Date {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) {
    throw new BadRequestException('Period must be formatted as YYYY-MM.');
  }
  return new Date(`${key}-01T00:00:00.000Z`);
}

// November's commission is paid on 1–5 December (Malaysia time). Only PAID is set by an admin.
export function displayStatus(
  period: Date,
  isPaid: boolean,
  now: Date,
): CommissionDisplayStatus {
  if (isPaid) return 'PAID';
  const current = periodOf(now);
  if (period.getTime() >= current.getTime()) return 'ACCRUING';
  const isLastMonth = nextPeriod(period).getTime() === current.getTime();
  return isLastMonth && toMyt(now).getUTCDate() <= PAYMENT_WINDOW_LAST_DAY
    ? 'DUE'
    : 'OVERDUE';
}
