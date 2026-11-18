import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import {
  formatChromeNumber,
  formatCurrencyPrice,
  formatTomanFromRial,
  toAsciiDigits,
  toPersianDigits,
} from '@/edition/bidi/numerals';

describe('W1.4 <LtrExamBoundary />', () => {
  afterEach(() => {
    cleanup();
  });

  it('enforces dir="ltr", lang="en", and unicode-bidi isolation inside RTL chrome', () => {
    render(
      <div dir="rtl" lang="fa">
        <LtrExamBoundary data-testid="exam-boundary" className="p-4">
          <span>Question 1: Complete the blank ____ with A.</span>
          <span>19:45</span>
          <span>7.5</span>
        </LtrExamBoundary>
      </div>,
    );

    const el = screen.getByTestId('exam-boundary');
    expect(el.getAttribute('dir')).toBe('ltr');
    expect(el.getAttribute('lang')).toBe('en');
    expect(el.className).toContain('font-en');
    expect(el.className).toContain('isolate');
    expect(el.className).toContain('[unicode-bidi:isolate]');
    expect(el.className).toContain('text-start');
    expect(el.className).toContain('tabular-nums');
    expect(el.className).toContain('p-4');
    expect(el.style.unicodeBidi).toBe('isolate');
  });
});

describe('W1.4 BiDi numerals & currency formatting', () => {
  it('maps ASCII digits to Persian digits and reverses both Persian and Arabic-Indic digits', () => {
    expect(toPersianDigits('0123456789')).toBe('۰۱۲۳۴۵۶۷۸۹');
    expect(toPersianDigits(1405)).toBe('۱۴۰۵');
    expect(toPersianDigits('19:45 - Band 7.5')).toBe('۱۹:۴۵ - Band ۷.۵');

    expect(toAsciiDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
    expect(toAsciiDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(toAsciiDigits('۱۴۰۵/۰۸/۲۷ - ٠٩:٣٠')).toBe('1405/08/27 - 09:30');
  });

  it('formats chrome numbers exclusively for irn while keeping glb ASCII', () => {
    expect(formatChromeNumber(42, 'glb')).toBe('42');
    expect(formatChromeNumber('2026-11-18', 'glb')).toBe('2026-11-18');
    expect(formatChromeNumber('۴۲', 'glb')).toBe('42');

    expect(formatChromeNumber(42, 'irn')).toBe('۴۲');
    expect(formatChromeNumber('1405/08/27', 'irn')).toBe('۱۴۰۵/۰۸/۲۷');
  });

  it('formats Rial amounts into Toman with thousands separators and Persian digits', () => {
    expect(formatTomanFromRial(3_900_000)).toBe('۳۹۰,۰۰۰ تومان');
    expect(formatTomanFromRial(1_990_000)).toBe('۱۹۹,۰۰۰ تومان');
    expect(formatTomanFromRial(19_999)).toBe('۱,۹۹۹ تومان');
    expect(formatTomanFromRial(0)).toBe('۰ تومان');
    expect(() => formatTomanFromRial(Number.NaN)).toThrow(RangeError);
  });

  it('formats USD and IRR prices cleanly across editions', () => {
    expect(formatCurrencyPrice(1900, 'USD', 'glb')).toBe('$19');
    expect(formatCurrencyPrice(1999, 'USD', 'glb')).toBe('$19.99');
    expect(formatCurrencyPrice(29.5, 'USD', 'glb', { isMinor: false })).toBe('$29.50');

    expect(formatCurrencyPrice(8_900_000, 'IRR', 'irn')).toBe('۸۹۰,۰۰۰ تومان');
    expect(formatCurrencyPrice(890_000, 'IRR', 'irn', { isMinor: false })).toBe('۸۹۰,۰۰۰ تومان');
    expect(formatCurrencyPrice(8_900_000, 'IRR', 'glb')).toBe('890,000 Toman');
  });
});
