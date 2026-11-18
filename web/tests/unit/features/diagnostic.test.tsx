import { createMemoryHistory } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDependencies } from '@/composition/bootstrap-test';
import { DesktopSimulatorApp } from '@/spa/DesktopSimulatorApp';
import { createAppRouter } from '@/spa/router';

describe('W4.2 Rapid Starting-Level Check (/app/diagnostic/{intro,session,result})', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
    vi.stubGlobal(
      'ResizeObserver',
      class ResizeObserverMock {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('runs Intro preflight -> adaptive Reading & Listening -> Writing -> Skip Speaking -> Baseline Result + single-skill retake', async () => {
    const deps = createTestDependencies({ edition: 'glb' });
    const history = createMemoryHistory({ initialEntries: ['/app/diagnostic/intro'] });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    // 1. Intro Preflight -> Accessible Audio mode -> Continue without Speaking
    await waitFor(() => {
      expect(screen.getByTestId('diagnostic-intro-screen')).toBeTruthy();
      expect(screen.getByTestId('compact-preflight-header')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Accessible Audio' }));
    fireEvent.click(screen.getByTestId('diag-skip-speaking-btn'));

    // 2. Stage 1: Adaptive Reading (complete up to 4 adaptive blocks until stage advances)
    await waitFor(() => {
      expect(screen.getByTestId('diagnostic-session-screen')).toBeTruthy();
      expect(document.querySelectorAll('[data-testid^="choice-1-"]').length).toBeGreaterThanOrEqual(2);
    });

    for (let step = 0; step < 4; step += 1) {
      if (screen.queryByTestId('audio-studio-player')) break;
      const q1Buttons = document.querySelectorAll<HTMLButtonElement>('[data-testid^="choice-1-"]');
      const q2Buttons = document.querySelectorAll<HTMLButtonElement>('[data-testid^="choice-2-"]');
      fireEvent.click(q1Buttons[1]!);
      fireEvent.click(q2Buttons[0]!);
      fireEvent.click(screen.getByTestId('diag-next-block-btn'));
      await new Promise((r) => setTimeout(r, 20));
    }

    // 3. Stage 2: Adaptive Listening (Accessible Audio keeps transcript visible; complete 3 blocks)
    await waitFor(() => {
      expect(screen.getByTestId('audio-studio-player')).toBeTruthy();
      expect(screen.getByTestId('audio-transcript-panel')).toBeTruthy();
    });

    for (let step = 0; step < 3; step += 1) {
      if (screen.queryByTestId('essay-editor-textarea')) break;
      const q1Buttons = document.querySelectorAll<HTMLButtonElement>('[data-testid^="choice-1-"]');
      const q2Buttons = document.querySelectorAll<HTMLButtonElement>('[data-testid^="choice-2-"]');
      fireEvent.click(q1Buttons[1]!);
      fireEvent.click(q2Buttons[0]!);
      fireEvent.click(screen.getByTestId('diag-next-block-btn'));
      await new Promise((r) => setTimeout(r, 20));
    }

    // 4. Stage 3: Writing sample -> Submit (skips speaking since launched without speaking)
    await waitFor(() => {
      expect(screen.getByTestId('essay-editor-textarea')).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId('essay-editor-textarea'), {
      target: {
        value:
          'Hybrid work improves deep-focus productivity and cuts commuting time while requiring deliberate async coordination among junior engineers.',
      },
    });
    fireEvent.click(screen.getByTestId('diag-submit-writing-btn'));

    // 5. Baseline Results Screen renders all 4 cards & Calibrated Reading/Listening/Writing + Skipped Speaking
    await waitFor(() => {
      expect(screen.getByTestId('diagnostic-result-screen')).toBeTruthy();
      expect(screen.getByTestId('diag-skill-card-reading').textContent).toContain('Calibrated');
      expect(screen.getByTestId('diag-skill-card-listening').textContent).toContain('Calibrated');
      expect(screen.getByTestId('diag-skill-card-writing').textContent).toContain('Calibrated');
      expect(screen.getByTestId('diag-skill-card-speaking').textContent).toContain('Skipped');
      expect(screen.getByTestId('diag-recommended-cta')).toBeTruthy();
    });

    // 6. Trigger single-skill retake on Speaking -> records audio clip -> updates Speaking to Calibrated
    fireEvent.click(screen.getByTestId('diag-retake-speaking-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('waveform-mic-recorder')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('recorder-start-btn'));
    await waitFor(() => expect(screen.getByTestId('recorder-stop-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('recorder-stop-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('diag-finish-btn')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('diag-finish-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('diagnostic-result-screen')).toBeTruthy();
      expect(screen.getByTestId('diag-skill-card-speaking').textContent).toContain('Calibrated');
    });
  });
});
