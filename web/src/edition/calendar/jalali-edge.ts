import {
  type SerialDay,
  serialDayFromUtcMs,
  utcMidnightMsFromSerialDay,
} from '@mockza/domain';
import {
  isLeapJalaaliYear,
  isValidJalaaliDate,
  jalaaliMonthLength,
  toGregorian,
  toJalaali,
} from 'jalaali-js';
import { toPersianDigits } from '../bidi/numerals';
import type { EditionCode } from '../edition-config';

export interface JalaliYmd {
  readonly jy: number;
  readonly jm: number;
  readonly jd: number;
}

function assertValidSerialDay(serialDay: number): void {
  if (!Number.isInteger(serialDay)) {
    throw new RangeError(`SerialDay must be an integer, received ${String(serialDay)}`);
  }
}

export function isJalaliLeapYear(jy: number): boolean {
  if (import.meta.env.PUBLIC_EDITION === 'glb') {
    return false;
  }
  if (!Number.isInteger(jy)) {
    throw new RangeError(`Jalali year must be an integer, received ${String(jy)}`);
  }
  return isLeapJalaaliYear(jy);
}

export function getJalaliMonthLength(jy: number, jm: number): number {
  if (import.meta.env.PUBLIC_EDITION === 'glb') {
    return 30;
  }
  if (!Number.isInteger(jy) || !Number.isInteger(jm) || jm < 1 || jm > 12) {
    throw new RangeError(`Invalid Jalali year/month: ${String(jy)}/${String(jm)}`);
  }
  return jalaaliMonthLength(jy, jm);
}

/**
 * Converts a canonical UTC integer `SerialDay` into Jalali Y/M/D components at the UI edge.
 * Never mutates or replaces canonical UTC `SerialDay` storage.
 */
export function serialDayToJalaliYmd(serialDay: SerialDay): JalaliYmd {
  assertValidSerialDay(serialDay);
  if (import.meta.env.PUBLIC_EDITION === 'glb') {
    throw new Error('Jalali calendar conversion is disabled in GLB edition');
  }
  const utcMs = utcMidnightMsFromSerialDay(serialDay);
  const date = new Date(utcMs);
  const { jy, jm, jd } = toJalaali(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
  return { jy, jm, jd };
}

/**
 * Validates Jalali `(jy, jm, jd)` calendar bounds (including leap-year Esfand 29/30)
 * and converts back to canonical UTC integer `SerialDay`.
 */
export function jalaliYmdToSerialDay(jy: number, jm: number, jd: number): SerialDay {
  if (import.meta.env.PUBLIC_EDITION === 'glb') {
    throw new Error('Jalali calendar conversion is disabled in GLB edition');
  }
  if (
    !Number.isInteger(jy) ||
    !Number.isInteger(jm) ||
    !Number.isInteger(jd) ||
    !isValidJalaaliDate(jy, jm, jd)
  ) {
    throw new RangeError(`Invalid Jalali date: ${String(jy)}/${String(jm)}/${String(jd)}`);
  }
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  const utcMs = Date.UTC(gy, gm - 1, gd);
  return serialDayFromUtcMs(utcMs);
}

/**
 * Formats canonical UTC milliseconds for UI chrome display:
 * - `'glb'`: UTC-anchored `en-US` Gregorian date (`Nov 18, 2026`)
 * - `'irn'`: UTC-anchored Jalali `YYYY/MM/DD` in Persian digits (`۱۴۰۵/۰۸/۲۷`)
 */
export function formatDisplayDate(utcMs: number, edition: EditionCode): string {
  if (!Number.isFinite(utcMs)) {
    throw new RangeError(`Invalid UTC timestamp: ${String(utcMs)}`);
  }
  const date = new Date(utcMs);

  if (edition === 'irn' && import.meta.env.PUBLIC_EDITION !== 'glb') {
    const { jy, jm, jd } = toJalaali(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
    );
    const yyyy = String(jy).padStart(4, '0');
    const mm = String(jm).padStart(2, '0');
    const dd = String(jd).padStart(2, '0');
    return toPersianDigits(`${yyyy}/${mm}/${dd}`);
  }

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * Formats a canonical UTC integer `SerialDay` for UI chrome display without timezone drift.
 */
export function formatSerialDay(serialDay: SerialDay, edition: EditionCode): string {
  assertValidSerialDay(serialDay);
  const utcMs = utcMidnightMsFromSerialDay(serialDay);
  return formatDisplayDate(utcMs, edition);
}
