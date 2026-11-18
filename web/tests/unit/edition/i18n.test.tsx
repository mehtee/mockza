import { createMemoryHistory } from '@tanstack/react-router';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BdiLtr,
  type TranslationKey,
  UNICODE_LRI,
  UNICODE_PDI,
  createTranslator,
  translate,
} from '@/i18n';
import { enMessages } from '@/i18n/en';
import { faMessages } from '@/i18n/fa';
import { DesktopSimulatorApp } from '@/spa/DesktopSimulatorApp';
import { createAppRouter } from '@/spa/router';

function extractPlaceholders(template: string): string[] {
  const matches = template.match(/\{([a-zA-Z0-9_]+)\}/g) ?? [];
  return [...matches].sort();
}

describe('W1.4 i18n dictionaries & BiDi-safe interpolation', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('maintains 1:1 key parity and placeholder parity between en and fa dictionaries', () => {
    const enKeys = Object.keys(enMessages).sort();
    const faKeys = Object.keys(faMessages).sort();

    expect(faKeys).toEqual(enKeys);
    expect(enKeys.length).toBeGreaterThanOrEqual(80);

    for (const key of enKeys as TranslationKey[]) {
      expect(enMessages[key].trim().length, `Empty EN string for ${key}`).toBeGreaterThan(0);
      expect(faMessages[key].trim().length, `Empty FA string for ${key}`).toBeGreaterThan(0);
      expect(
        extractPlaceholders(faMessages[key]),
        `Placeholder mismatch for key "${key}"`,
      ).toEqual(extractPlaceholders(enMessages[key]));
    }
  });

  it('wraps interpolated variables in LRI/PDI Unicode isolates only in irn without double-wrapping', () => {
    const glbText = translate('glb', 'scoreSummaryBand', {
      score: '7.5',
      track: 'IELTS Academic',
    });
    expect(glbText).toBe('Band 7.5 (IELTS Academic)');
    expect(glbText).not.toContain(UNICODE_LRI);

    const irnText = translate('irn', 'scoreSummaryBand', {
      score: '7.5',
      track: 'IELTS Academic',
    });
    expect(irnText).toBe(
      `نمره ${UNICODE_LRI}7.5${UNICODE_PDI} (${UNICODE_LRI}IELTS Academic${UNICODE_PDI})`,
    );

    const preIsolated = `${UNICODE_LRI}19:45${UNICODE_PDI}`;
    const timerText = translate('irn', 'workspaceTimerRemaining', {
      time: preIsolated,
    });
    expect(timerText).toBe(`زمان باقی‌مانده: ${UNICODE_LRI}19:45${UNICODE_PDI}`);
    expect(timerText).not.toContain(`${UNICODE_LRI}${UNICODE_LRI}`);
  });

  it('respects active edition in createTranslator() and renders <BdiLtr>', () => {
    vi.stubEnv('PUBLIC_EDITION', 'irn');
    const tIrn = createTranslator();
    expect(tIrn('appTitle')).toBe('سنجیا');

    vi.stubEnv('PUBLIC_EDITION', 'glb');
    const tGlb = createTranslator();
    expect(tGlb('appTitle')).toBe('Mockza');

    render(
      <p dir="rtl">
        نمره کل: <BdiLtr data-testid="bdi-score">7.5 / 9.0</BdiLtr>
      </p>,
    );
    const bdi = screen.getByTestId('bdi-score');
    expect(bdi.tagName.toLowerCase()).toBe('bdi');
    expect(bdi.getAttribute('dir')).toBe('ltr');
    expect(bdi.className).toContain('font-en');
    expect(bdi.className).toContain('tabular-nums');
  });

  it('renders localized brand, logical chevron aria-label, and RTL dir in router shell', async () => {
    vi.stubGlobal('scrollTo', vi.fn());
    vi.stubEnv('PUBLIC_EDITION', 'irn');
    const history = createMemoryHistory({ initialEntries: ['/app/home'] });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} />);

    await waitFor(() => {
      expect(screen.getByTestId('route-skeleton-home')).toBeTruthy();
    });

    expect(screen.getByText('سنجیا')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'جمع کردن منوی کناری' })).toBeTruthy();
    const shell = screen.getByLabelText('ناوبری اصلی').parentElement;
    expect(shell?.getAttribute('dir')).toBe('rtl');
  });
});
