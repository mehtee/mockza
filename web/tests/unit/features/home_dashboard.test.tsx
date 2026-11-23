import { createMemoryHistory } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDependencies } from '@/composition/bootstrap-test';
import { DesktopSimulatorApp } from '@/spa/DesktopSimulatorApp';
import { createAppRouter } from '@/spa/router';

describe('W4.3 Desktop Home Bento Dashboard (/app/home)', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('computes 4-skill & overall metrics, streak, and Due SM-2 cards, and migrates track safely', async () => {
    const deps = createTestDependencies({
      edition: 'glb',
      initialClockMs: Date.UTC(2026, 10, 18, 12, 0, 0),
    });
    const nowMs = deps.clock.nowMs();
    const todaySerial = deps.clock.todaySerialDay();

    // Seed IELTS Academic profile + 4-skill attempts + 2-day study streak + 1 due SM-2 card
    await deps.attemptStore.saveUserProfile({
      deviceId: 'dev-1',
      examId: 'ielts_academic',
      examModule: 'academic',
      targetBand: 7.5,
      targetDateSerial: todaySerial + 45,
      onboardingCompleted: true,
      freeDiagnosticUsed: false,
      linkedEmail: null,
      appUserId: null,
      isPro: false,
      updatedAtMs: nowMs,
    });

    const skills = [
      { skill: 'reading', band: 7.5 },
      { skill: 'listening', band: 8.0 },
      { skill: 'writing', band: 6.5 },
      { skill: 'speaking', band: 7.0 },
    ] as const;

    for (const item of skills) {
      await deps.attemptStore.saveAttemptRecord({
        attemptId: `att-${item.skill}`,
        examId: 'ielts_academic',
        packId: `pack-${item.skill}`,
        skill: item.skill,
        status: 'completed',
        syncStatus: 'synced',
        remoteJobId: null,
        submissionJson: '{}',
        evaluationJson: null,
        overallBand: item.band,
        errorCode: null,
        startedAtUtcMs: nowMs - 600_000,
        completedAtMs: nowMs,
        durationSeconds: 300,
        usedStudyMode: false,
        questionCount: 10,
        isCalibratedFullPack: false,
        contentVersion: 'v1',
        mockSessionId: null,
        mockStageKey: null,
        updatedAtMs: nowMs,
      });
    }

    // Seed 2 DET attempts (Literacy & Production coverage)
    await deps.attemptStore.saveAttemptRecord({
      attemptId: 'att-det-r',
      examId: 'det',
      packId: 'det-r-1',
      skill: 'reading',
      status: 'completed',
      syncStatus: 'synced',
      remoteJobId: null,
      submissionJson: '{}',
      evaluationJson: null,
      overallBand: 125,
      errorCode: null,
      startedAtUtcMs: nowMs - 600_000,
      completedAtMs: nowMs,
      durationSeconds: 300,
      usedStudyMode: false,
      questionCount: 10,
      isCalibratedFullPack: false,
      contentVersion: 'v1',
      mockSessionId: null,
      mockStageKey: null,
      updatedAtMs: nowMs,
    });
    await deps.attemptStore.saveAttemptRecord({
      attemptId: 'att-det-w',
      examId: 'det',
      packId: 'det-w-1',
      skill: 'writing',
      status: 'completed',
      syncStatus: 'synced',
      remoteJobId: null,
      submissionJson: '{}',
      evaluationJson: null,
      overallBand: 135,
      errorCode: null,
      startedAtUtcMs: nowMs - 600_000,
      completedAtMs: nowMs,
      durationSeconds: 300,
      usedStudyMode: false,
      questionCount: 1,
      isCalibratedFullPack: false,
      contentVersion: 'v1',
      mockSessionId: null,
      mockStageKey: null,
      updatedAtMs: nowMs,
    });

    await deps.attemptStore.incrementDailyStudyLog({
      serialDay: todaySerial - 1,
      addSeconds: 600,
      addCompletedItems: 1,
    });
    await deps.attemptStore.incrementDailyStudyLog({
      serialDay: todaySerial,
      addSeconds: 900,
      addCompletedItems: 2,
    });

    await deps.vocabStore.upsertMistakeCard({
      cardId: 'card-1',
      examId: 'ielts_academic',
      headword: 'ubiquitous',
      ipa: '/juːˈbɪk.wɪ.təs/',
      definition: 'Present or found everywhere.',
      glossFa: 'همه‌جا حاضر و فراگیر',
      topicTag: 'technology',
      sourceKind: 'mistake_to_deck',
      tags: ['c1'],
      contextSentence: 'Smartphones have become ubiquitous in classrooms.',
      paraphraseHints: ['omnipresent'],
      usageNote: null,
      sourceSkill: 'writing',
      sourceAttemptId: 'att-writing',
      sourceRefLabel: null,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    const history = createMemoryHistory({ initialEntries: ['/app/home'] });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    // 1. IELTS Academic shows calculated 7.5 average overall + 2-day streak + 1 due card
    await waitFor(() => {
      expect(screen.getByTestId('home-screen')).toBeTruthy();
      expect(screen.getByTestId('home-overall-score').textContent).toBe('7.5');
      expect(screen.getByTestId('home-skill-card-listening').textContent).toContain('8.0');
      expect(screen.getByTestId('home-streak-badge').textContent).toContain('2-day streak');
      expect(screen.getByTestId('home-due-vocab-card').textContent).toContain('ubiquitous');
    });

    // 2. Switching to IELTS General in Settings preserves shared 7.5 IELTS target cleanly via nextTargetWhenSwitchingFrom
    expect(screen.queryByTestId('home-track-ielts_general')).toBeNull();
    fireEvent.click(screen.getByTestId('nav-settings-link'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-track-ielts_general')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('settings-track-ielts_general'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-track-ielts_general').getAttribute('aria-checked')).toBe('true');
    });
    fireEvent.click(screen.getByTestId('nav-home-link'));
    await waitFor(() => {
      expect(screen.getByTestId('home-target-score-pill').textContent).toContain('7.5');
    });

    // 3. Switching to TOEFL iBT (2026) in Settings resets target safely to 5.0 + shows /120 concordance on Home
    fireEvent.click(screen.getByTestId('nav-settings-link'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-track-toefl_ibt')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('settings-track-toefl_ibt'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-track-toefl_ibt').getAttribute('aria-checked')).toBe('true');
    });
    fireEvent.click(screen.getByTestId('nav-home-link'));
    await waitFor(() => {
      expect(screen.getByTestId('home-target-score-pill').textContent).toContain('5.0');
      expect(screen.getByTestId('home-toefl-concordance').textContent).toContain('/ 120');
    });

    // 4. Switching to DET in Settings shows Literacy subscore computed from Reading (125) + Writing (135) -> 130 on Home
    fireEvent.click(screen.getByTestId('nav-settings-link'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-track-det')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('settings-track-det'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-track-det').getAttribute('aria-checked')).toBe('true');
    });
    fireEvent.click(screen.getByTestId('nav-home-link'));
    await waitFor(() => {
      expect(screen.getByTestId('home-det-subscores').textContent).toContain('Literacy: 130');
    });
  });

  it('displays IRN Jalali exam date and Persian glosses for due SM-2 vocabulary cards', async () => {
    const deps = createTestDependencies({
      edition: 'irn',
      initialClockMs: Date.UTC(2026, 10, 18, 12, 0, 0),
    });
    const todaySerial = deps.clock.todaySerialDay();

    await deps.attemptStore.saveUserProfile({
      deviceId: 'dev-irn',
      examId: 'ielts_academic',
      examModule: 'academic',
      targetBand: 7.0,
      targetDateSerial: todaySerial,
      onboardingCompleted: true,
      freeDiagnosticUsed: false,
      linkedEmail: null,
      appUserId: null,
      isPro: false,
      updatedAtMs: deps.clock.nowMs(),
    });

    await deps.vocabStore.upsertMistakeCard({
      cardId: 'card-irn-1',
      examId: 'ielts_academic',
      headword: 'mitigate',
      ipa: '/ˈmɪt.ɪ.ɡeɪt/',
      definition: 'Make less severe.',
      glossFa: 'کاهش دادن و تعدیل کردن',
      topicTag: 'environment',
      sourceKind: 'mistake_to_deck',
      tags: ['b2'],
      contextSentence: null,
      paraphraseHints: [],
      usageNote: null,
      sourceSkill: null,
      sourceAttemptId: null,
      sourceRefLabel: null,
      createdAtMs: deps.clock.nowMs(),
      updatedAtMs: deps.clock.nowMs(),
    });

    const history = createMemoryHistory({ initialEntries: ['/app/home'] });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('home-screen')).toBeTruthy();
      expect(screen.getByTestId('home-target-date-badge').textContent).toContain('۱۴۰۵/۰۸/۲۷');
      expect(screen.getByTestId('home-due-vocab-card').textContent).toContain(
        'کاهش دادن و تعدیل کردن',
      );
    });
  });
});
