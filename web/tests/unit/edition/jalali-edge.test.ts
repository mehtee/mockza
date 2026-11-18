import { serialDayFromUtcMs, utcMidnightMsFromSerialDay } from '@mockza/domain';
import { describe, expect, it } from 'vitest';
import {
  formatDisplayDate,
  formatSerialDay,
  getJalaliMonthLength,
  isJalaliLeapYear,
  jalaliYmdToSerialDay,
  serialDayToJalaliYmd,
} from '@/edition/calendar/jalali-edge';

describe('W1.4 Jalali edge calendar & canonical SerialDay invariance', () => {
  it('converts UTC timestamps without timezone day-shift in both editions', () => {
    const earlyUtc = Date.UTC(2026, 10, 18, 0, 0, 1);
    const lateUtc = Date.UTC(2026, 10, 18, 23, 59, 59);

    expect(formatDisplayDate(earlyUtc, 'glb')).toBe('Nov 18, 2026');
    expect(formatDisplayDate(lateUtc, 'glb')).toBe('Nov 18, 2026');

    expect(formatDisplayDate(earlyUtc, 'irn')).toBe('۱۴۰۵/۰۸/۲۷');
    expect(formatDisplayDate(lateUtc, 'irn')).toBe('۱۴۰۵/۰۸/۲۷');
  });

  it('round-trips SerialDay <-> Jalali YMD across leap year 1403 and non-leap year 1404', () => {
    expect(isJalaliLeapYear(1403)).toBe(true);
    expect(isJalaliLeapYear(1404)).toBe(false);
    expect(getJalaliMonthLength(1403, 12)).toBe(30);
    expect(getJalaliMonthLength(1404, 12)).toBe(29);

    // 1403/12/30 (leap day) == 2025-03-20 UTC
    const leapSerialDay = jalaliYmdToSerialDay(1403, 12, 30);
    expect(leapSerialDay).toBe(serialDayFromUtcMs(Date.UTC(2025, 2, 20)));
    expect(serialDayToJalaliYmd(leapSerialDay)).toEqual({ jy: 1403, jm: 12, jd: 30 });
    expect(formatSerialDay(leapSerialDay, 'irn')).toBe('۱۴۰۳/۱۲/۳۰');
    expect(formatSerialDay(leapSerialDay, 'glb')).toBe('Mar 20, 2025');

    // 1404/12/29 == 2026-03-20 UTC, followed by 1405/01/01 == 2026-03-21 UTC
    const commonEndSerialDay = jalaliYmdToSerialDay(1404, 12, 29);
    expect(commonEndSerialDay).toBe(serialDayFromUtcMs(Date.UTC(2026, 2, 20)));
    expect(serialDayToJalaliYmd(commonEndSerialDay)).toEqual({ jy: 1404, jm: 12, jd: 29 });

    const nextNewYearSerialDay = jalaliYmdToSerialDay(1405, 1, 1);
    expect(nextNewYearSerialDay - commonEndSerialDay).toBe(1);
    expect(serialDayToJalaliYmd(nextNewYearSerialDay)).toEqual({ jy: 1405, jm: 1, jd: 1 });
  });

  it('rejects out-of-bounds Jalali dates such as Esfand 30 in non-leap year 1404', () => {
    expect(() => jalaliYmdToSerialDay(1404, 12, 30)).toThrow(RangeError);
    expect(() => jalaliYmdToSerialDay(1405, 7, 31)).toThrow(RangeError);
    expect(() => jalaliYmdToSerialDay(1405, 13, 1)).toThrow(RangeError);
    expect(() => jalaliYmdToSerialDay(1405, 0, 1)).toThrow(RangeError);
    expect(() => jalaliYmdToSerialDay(1405, 1, 0)).toThrow(RangeError);
    expect(() => jalaliYmdToSerialDay(1405.5, 1, 1)).toThrow(RangeError);
  });

  it('keeps canonical SerialDay integers immutable when formatting across hundreds of days', () => {
    const start = serialDayFromUtcMs(Date.UTC(2024, 0, 1));
    for (let offset = 0; offset < 1200; offset += 17) {
      const day = start + offset;
      const ymd = serialDayToJalaliYmd(day);
      const roundTripped = jalaliYmdToSerialDay(ymd.jy, ymd.jm, ymd.jd);
      expect(roundTripped).toBe(day);
      expect(formatSerialDay(day, 'irn')).toBe(
        formatDisplayDate(utcMidnightMsFromSerialDay(day), 'irn'),
      );
    }
  });
});
