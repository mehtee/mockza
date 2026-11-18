import type { EditionCode } from '../edition-config';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (digit) => {
    const index = digit.charCodeAt(0) - 48;
    return PERSIAN_DIGITS[index] ?? digit;
  });
}

export function toAsciiDigits(input: string): string {
  return input
    .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
}

/**
 * Formats chrome-level numbers/dates for the active edition.
 * Never use inside `<LtrExamBoundary>` (exam timers, scores, and stimuli stay ASCII).
 */
export function formatChromeNumber(value: number | string, edition: EditionCode): string {
  const raw = String(value);
  if (edition === 'irn') {
    return toPersianDigits(raw);
  }
  return toAsciiDigits(raw);
}

/**
 * Converts canonical integer Rial (`IRR`) to Toman (`Math.trunc(amountRial / 10)`)
 * formatted with thousands separator, Persian digits, and `تومان`.
 */
export function formatTomanFromRial(amountRial: number): string {
  if (!Number.isFinite(amountRial)) {
    throw new RangeError(`Invalid Rial amount: ${String(amountRial)}`);
  }
  const toman = Math.trunc(amountRial / 10);
  const sign = toman < 0 ? '-' : '';
  const absGrouped = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Math.abs(toman));
  return `${sign}${toPersianDigits(absGrouped)} تومان`;
}

export interface FormatCurrencyPriceOptions {
  readonly isMinor?: boolean;
}

export function formatCurrencyPrice(
  amountMinorOrMajor: number,
  currency: 'USD' | 'IRR',
  edition: EditionCode,
  options?: FormatCurrencyPriceOptions,
): string {
  if (!Number.isFinite(amountMinorOrMajor)) {
    throw new RangeError(`Invalid currency amount: ${String(amountMinorOrMajor)}`);
  }

  const isMinor = options?.isMinor ?? true;

  if (currency === 'IRR') {
    const rialAmount = isMinor ? amountMinorOrMajor : amountMinorOrMajor * 10;
    if (edition === 'irn') {
      return formatTomanFromRial(rialAmount);
    }
    const toman = Math.trunc(rialAmount / 10);
    const grouped = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(toman);
    return `${grouped} Toman`;
  }

  const usdAmount = isMinor ? amountMinorOrMajor / 100 : amountMinorOrMajor;
  const formattedUsd = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(usdAmount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(usdAmount);

  return edition === 'irn' ? toPersianDigits(formattedUsd) : formattedUsd;
}
