export const MILLISECONDS_PER_DAY = 86_400_000;

/** Timezone-safe integer UTC day counter for streak and SRS due-date math. */
export type SerialDay = number;

function normalizeZero(value: number): number {
  return value === 0 ? 0 : value;
}

/** Converts UTC milliseconds into UTC calendar day count since Unix epoch. */
export function serialDayFromUtcMs(utcMs: number): SerialDay {
  const d = new Date(utcMs);
  const midnightUtcMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return normalizeZero(Math.trunc(midnightUtcMs / MILLISECONDS_PER_DAY));
}

/** Converts a Date into its UTC calendar day count since Unix epoch. */
export function serialDayFromUtcDate(date: Date): SerialDay {
  return serialDayFromUtcMs(date.getTime());
}

/** Adds `days` to produce a shifted SerialDay. */
export function addSerialDays(day: SerialDay, days: number): SerialDay {
  return normalizeZero(day + days);
}

/** Signed day difference (`a - b`). */
export function differenceSerialDays(a: SerialDay, b: SerialDay): number {
  return normalizeZero(a - b);
}

/** Converts a SerialDay back to UTC midnight milliseconds. */
export function utcMidnightMsFromSerialDay(day: SerialDay): number {
  return normalizeZero(day * MILLISECONDS_PER_DAY);
}
