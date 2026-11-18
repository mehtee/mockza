import { serialDayFromUtcMs } from '@mockza/domain';
import { createMemoryHistory } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDependencies } from '@/composition/bootstrap-test';
import { DesktopSimulatorApp } from '@/spa/DesktopSimulatorApp';
import { createAppRouter } from '@/spa/router';

describe('W4.1 Onboarding Wizard (/app/welcome & /app/onboarding/goal)', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('selects an exam track in Welcome, configures target & Gregorian date in Goal Setup, and launches Rapid Check', async () => {
    const deps = createTestDependencies({
      edition: 'glb',
      initialClockMs: Date.UTC(2026, 10, 18, 12, 0, 0),
    });
    const history = createMemoryHistory({ initialEntries: ['/app/welcome'] });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('welcome-screen')).toBeTruthy();
      expect(screen.getByTestId('welcome-track-toefl_ibt')).toBeTruthy();
    });

    // Switch to TOEFL iBT (2026) and continue to Goal Setup
    fireEvent.click(screen.getByTestId('welcome-track-toefl_ibt'));
    fireEvent.click(screen.getByTestId('welcome-continue-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('goal-setup-screen')).toBeTruthy();
      expect(screen.getByTestId('goal-target-readout').textContent).toBe('5.0');
      expect(screen.getByTestId('goal-cefr-badge').textContent).toContain('/120');
    });

    // Bump target +0.5 -> 5.5 and pick 30-day preset
    fireEvent.click(screen.getByTestId('goal-target-inc'));
    fireEvent.click(screen.getByTestId('goal-date-preset-30'));

    await waitFor(() => {
      expect(screen.getByTestId('goal-target-readout').textContent).toBe('5.5');
      expect(screen.getByTestId('goal-formatted-date')).toBeTruthy();
    });

    // Launch into Rapid Check (/app/diagnostic/intro) & verify profile persisted in store
    fireEvent.click(screen.getByTestId('goal-start-diagnostic-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('route-skeleton-diagnostic-intro')).toBeTruthy();
    });

    const savedProfile = await deps.attemptStore.getUserProfile();
    expect(savedProfile.ok && savedProfile.value?.examId).toBe('toefl_ibt');
    expect(savedProfile.ok && savedProfile.value?.targetBand).toBe(5.5);
    expect(savedProfile.ok && savedProfile.value?.onboardingCompleted).toBe(true);
    expect(savedProfile.ok && savedProfile.value?.targetDateSerial).toBe(
      deps.clock.todaySerialDay() + 30,
    );
  });

  it('validates Jalali dates (rejecting non-leap 1404/12/30 and storing canonical SerialDay for 1403/12/30) in IRN edition', async () => {
    const deps = createTestDependencies({ edition: 'irn' });
    const history = createMemoryHistory({ initialEntries: ['/app/onboarding/goal'] });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('goal-jalali-inputs')).toBeTruthy();
    });

    // Enter invalid non-leap date 1404/12/30 -> shows validation banner & disables launch
    fireEvent.change(screen.getByTestId('goal-jalali-year'), { target: { value: '1404' } });
    fireEvent.change(screen.getByTestId('goal-jalali-month'), { target: { value: '12' } });
    fireEvent.change(screen.getByTestId('goal-jalali-day'), { target: { value: '30' } });

    await waitFor(() => {
      expect(screen.getByText(/تاریخ تقویمی معتبری/)).toBeTruthy();
      expect((screen.getByTestId('goal-start-diagnostic-btn') as HTMLButtonElement).disabled).toBe(
        true,
      );
    });

    // Enter valid leap date 1403/12/30 == 2025-03-20 UTC -> clears error & formats Persian digits
    fireEvent.change(screen.getByTestId('goal-jalali-year'), { target: { value: '1403' } });

    await waitFor(() => {
      expect(screen.getByTestId('goal-formatted-date').textContent).toContain('۱۴۰۳/۱۲/۳۰');
      expect((screen.getByTestId('goal-start-diagnostic-btn') as HTMLButtonElement).disabled).toBe(
        false,
      );
    });

    fireEvent.click(screen.getByTestId('goal-skip-home-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('route-skeleton-home')).toBeTruthy();
    });

    const saved = await deps.attemptStore.getUserProfile();
    expect(saved.ok && saved.value?.targetDateSerial).toBe(
      serialDayFromUtcMs(Date.UTC(2025, 2, 20)),
    );
  });
});
