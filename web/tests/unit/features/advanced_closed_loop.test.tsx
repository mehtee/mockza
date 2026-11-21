// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory } from '@tanstack/react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDependencies } from '@/composition/bootstrap-test';
import { DesktopSimulatorApp } from '@/spa/DesktopSimulatorApp';
import { createAppRouter } from '@/spa/router';

describe('Web Closed-Loop Linguistic Engine (GLB + IRN)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Home Daily Mission Card, completes Mission -> updates Graph & completes Register Shifter flow (GLB)', async () => {
    const deps = createTestDependencies({ edition: 'glb' });
    const history = createMemoryHistory({ initialEntries: ['/app/home'] });
    const router = createAppRouter(history);
    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('home-daily-mission-card')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('home-daily-mission-cta'));
    await waitFor(() => {
      expect(screen.getByTestId('daily-mission-screen')).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId('mission-response-input'), {
      target: {
        value:
          'Were companies to adopt transparent AI audits, albeit slower at first, productivity would rise sustainably.',
      },
    });
    fireEvent.click(screen.getByTestId('mission-complete-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('mission-completed-banner')).toBeTruthy();
    });

    // Navigate to Register Shifter and verify 3-Gear Ladder + Repeat-Aloud Loop
    await router.navigate({ to: '/register-shifter' });
    await waitFor(() => {
      expect(screen.getByTestId('register-shifter-screen')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('shifter-record-btn'));
    await new Promise((r) => setTimeout(r, 20));
    fireEvent.click(screen.getByTestId('shifter-record-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('register-gear-ladder')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('gear-tab-1'));
    expect(screen.getByTestId('register-active-sentence').textContent).toContain('compelling');

    fireEvent.click(screen.getByTestId('shifter-repeat-btn'));
    await new Promise((r) => setTimeout(r, 20));
    fireEvent.click(screen.getByTestId('shifter-repeat-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('shifter-repeat-verified')).toBeTruthy();
    });
  });

  it('runs Sanjia IRN Drop Anything RTL preflight (YouTube blocked) -> text ingest -> drill + SM-2 save', async () => {
    const deps = createTestDependencies({ edition: 'irn' });
    const history = createMemoryHistory({ initialEntries: ['/app/drop'] });
    const router = createAppRouter(history);
    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('drop-hub-screen')).toBeTruthy();
    });

    // YouTube blocked preflight cleanly without network spend
    fireEvent.change(screen.getByTestId('drop-url-input'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByTestId('drop-ingest-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('drop-error-banner')).toBeTruthy();
    });

    // Switch to Paste Text and generate 2-Min Micro-Drill
    fireEvent.click(screen.getByTestId('drop-tab-text'));
    fireEvent.change(screen.getByTestId('drop-text-input'), {
      target: {
        value:
          'Modern engineering teams combine structured feedback loops with deliberate practice to mitigate bottlenecks.',
      },
    });
    fireEvent.click(screen.getByTestId('drop-ingest-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('drop-drill-screen')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('save-drop-phrase-mitigate bottlenecks'));
    const cards = await deps.vocabStore.getAllCards();
    expect(cards.ok && cards.value.some((c) => c.card.headword === 'mitigate bottlenecks')).toBe(
      true,
    );
  });
});
