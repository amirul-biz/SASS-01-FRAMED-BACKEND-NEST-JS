import {
  displayStatus,
  parsePeriod,
  periodOf,
  periodRange,
} from './commission-statement.period';

describe('commission statement periods (Malaysia time)', () => {
  it('puts 00:30 MYT on the 1st in the new month, not the previous UTC month', () => {
    // 2026-11-30T16:30Z is 2026-12-01 00:30 in Malaysia.
    expect(periodOf(new Date('2026-11-30T16:30:00Z'))).toEqual(
      parsePeriod('2026-12'),
    );
    expect(periodOf(new Date('2026-11-30T15:59:59Z'))).toEqual(
      parsePeriod('2026-11'),
    );
  });

  it('range starts at 16:00Z the day before', () => {
    const { gte, lt } = periodRange(parsePeriod('2026-11'));
    expect(gte.toISOString()).toBe('2026-10-31T16:00:00.000Z');
    expect(lt.toISOString()).toBe('2026-11-30T16:00:00.000Z');
  });

  it('derives accruing / due / overdue / paid', () => {
    const nov = parsePeriod('2026-11');
    expect(displayStatus(nov, false, new Date('2026-11-20T00:00:00Z'))).toBe(
      'ACCRUING',
    );
    expect(displayStatus(nov, false, new Date('2026-12-04T00:00:00Z'))).toBe(
      'DUE',
    );
    // 2026-12-05 23:00 MYT is still inside the window; 6th is not.
    expect(displayStatus(nov, false, new Date('2026-12-05T15:00:00Z'))).toBe(
      'DUE',
    );
    expect(displayStatus(nov, false, new Date('2026-12-06T00:00:00Z'))).toBe(
      'OVERDUE',
    );
    expect(displayStatus(nov, false, new Date('2027-01-02T00:00:00Z'))).toBe(
      'OVERDUE',
    );
    expect(displayStatus(nov, true, new Date('2027-01-02T00:00:00Z'))).toBe(
      'PAID',
    );
  });

  it('rejects a malformed period', () => {
    expect(() => parsePeriod('2026-13')).toThrow();
    expect(() => parsePeriod('nov')).toThrow();
  });
});
