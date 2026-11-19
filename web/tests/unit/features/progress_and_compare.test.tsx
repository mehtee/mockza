import { createMemoryHistory } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDependencies } from '@/composition/bootstrap-test';
import type { CompletedAttemptRecord, EvaluationOutputDto } from '@/gateways/storage.gateway';
import { DesktopSimulatorApp } from '@/spa/DesktopSimulatorApp';
import { createAppRouter } from '@/spa/router';

async function seedScoredAttempts(edition: 'glb' | 'irn') {
  const deps = createTestDependencies({
    edition,
    initialClockMs: Date.UTC(2026, 10, 18, 12, 0, 0),
  });
  const nowMs = deps.clock.nowMs();
  const todaySerial = deps.clock.todaySerialDay();

  await deps.attemptStore.saveUserProfile({
    deviceId: 'dev-1',
    examId: 'ielts_academic',
    examModule: 'academic',
    targetBand: 7.5,
    targetDateSerial: todaySerial + 30,
    onboardingCompleted: true,
    freeDiagnosticUsed: true,
    linkedEmail: null,
    appUserId: null,
    isPro: true,
    updatedAtMs: nowMs,
  });

  await deps.attemptStore.incrementDailyStudyLog({
    serialDay: todaySerial,
    addSeconds: 1800,
    addCompletedItems: 2,
  });

  const makeEval = (attemptId: string, overall: number, lr: number): EvaluationOutputDto => ({
    attemptId,
    overallBand: overall,
    isEstimated: true,
    criteria: [
      { code: 'TR', label: 'Task Response', band: overall, evidenceExcerpt: 'q', feedbackNote: 'ok' },
      { code: 'CC', label: 'Coherence', band: overall, evidenceExcerpt: 'q', feedbackNote: 'ok' },
      { code: 'LR', label: 'Lexical Resource', band: lr, evidenceExcerpt: 'q', feedbackNote: 'ok' },
      { code: 'GRA', label: 'Grammar', band: overall, evidenceExcerpt: 'q', feedbackNote: 'ok' },
    ],
    vocabUpgrades: [],
    modelId: 'eval-v1',
    rubricVersion: 'v1',
  });

  const records: CompletedAttemptRecord[] = [
    {
      attemptId: 'att-w-1',
      examId: 'ielts_academic',
      packId: 'w-1',
      skill: 'writing',
      status: 'completed',
      syncStatus: 'synced',
      remoteJobId: null,
      submissionJson: JSON.stringify({ essayText: 'First draft response.' }),
      evaluationJson: JSON.stringify(makeEval('att-w-1', 6.0, 5.5)),
      overallBand: 6.0,
      errorCode: null,
      startedAtUtcMs: nowMs - 20 * 86_400_000,
      completedAtMs: nowMs - 20 * 86_400_000,
      durationSeconds: 1200,
      usedStudyMode: false,
      questionCount: 1,
      isCalibratedFullPack: true,
      contentVersion: '1.0.0',
      mockSessionId: null,
      mockStageKey: null,
      updatedAtMs: nowMs - 20 * 86_400_000,
    },
    {
      attemptId: 'att-w-2',
      examId: 'ielts_academic',
      packId: 'w-1',
      skill: 'writing',
      status: 'completed',
      syncStatus: 'synced',
      remoteJobId: null,
      submissionJson: JSON.stringify({ essayText: 'Second improved draft.' }),
      evaluationJson: JSON.stringify(makeEval('att-w-2', 7.0, 7.5)),
      overallBand: 7.0,
      errorCode: null,
      startedAtUtcMs: nowMs - 2 * 86_400_000,
      completedAtMs: nowMs - 2 * 86_400_000,
      durationSeconds: 1100,
      usedStudyMode: false,
      questionCount: 1,
      isCalibratedFullPack: true,
      contentVersion: '1.0.0',
      mockSessionId: null,
      mockStageKey: null,
      updatedAtMs: nowMs - 2 * 86_400_000,
    },
    {
      attemptId: 'att-r-1',
      examId: 'ielts_academic',
      packId: 'r-1',
      skill: 'reading',
      status: 'completed',
      syncStatus: 'synced',
      remoteJobId: null,
      submissionJson: JSON.stringify({ correctCount: 34, totalCount: 40 }),
      evaluationJson: null,
      overallBand: 7.5,
      errorCode: null,
      startedAtUtcMs: nowMs - 1 * 86_400_000,
      completedAtMs: nowMs - 1 * 86_400_000,
      durationSeconds: 1500,
      usedStudyMode: false,
      questionCount: 40,
      isCalibratedFullPack: true,
      contentVersion: '1.0.0',
      mockSessionId: null,
      mockStageKey: null,
      updatedAtMs: nowMs - 1 * 86_400_000,
    },
  ];

  for (const r of records) {
    await deps.attemptStore.saveAttemptRecord(r);
  }

  return deps;
}

describe('W6.3 Progress Analytics & Attempt Compare', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders TrendChart, readiness gap, weakness priority, and side-by-side Attempt A vs B compare (GLB)', async () => {
    const deps = await seedScoredAttempts('glb');
    const history = createMemoryHistory({ initialEntries: ['/app/progress'] });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('progress-trend-chart')).toBeTruthy();
      expect(screen.getByTestId('progress-radar-chart')).toBeTruthy();
      expect(screen.getByTestId('progress-export-btn')).toBeTruthy();
    });
    expect(screen.getByTestId('progress-weakest-card').textContent).toContain('Writing');
    expect(screen.queryByTestId('ecosystem-handoff-card')).toBeNull();

    fireEvent.click(screen.getByTestId('progress-export-btn'));
    await waitFor(() => {
      expect(screen.getByText(/Study history downloaded/)).toBeTruthy();
    });

    // Navigate to Attempt Compare & select two Writing attempts for criterion diff
    fireEvent.click(screen.getByTestId('progress-compare-cta'));
    await waitFor(() => {
      expect(screen.getByTestId('compare-attempts-screen')).toBeTruthy();
      expect(screen.getByTestId('compare-select-a')).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId('compare-select-a'), { target: { value: 'att-w-1' } });
    fireEvent.change(screen.getByTestId('compare-select-b'), { target: { value: 'att-w-2' } });

    await waitFor(() => {
      expect(screen.getByTestId('compare-delta-value').textContent).toBe('+1');
    });
    expect(screen.getByTestId('compare-criteria-table').textContent).toContain('Lexical Resource');
    expect(screen.getByTestId('compare-criteria-table').textContent).toContain('5.5 → 7.5');
    expect(screen.getByTestId('compare-lexical-metrics')).toBeTruthy();
    expect(screen.getByTestId('compare-diff-panel')).toBeTruthy();
  });

  it('displays IRN verified Navia ecosystem handoff card and Jalali dates', async () => {
    const deps = await seedScoredAttempts('irn');
    const history = createMemoryHistory({ initialEntries: ['/app/progress'] });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('ecosystem-handoff-card')).toBeTruthy();
    });
    const link = screen.getByTestId('ecosystem-handoff-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://navia.ir');
  });
});
