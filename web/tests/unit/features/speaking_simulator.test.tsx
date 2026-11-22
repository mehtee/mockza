import { createMemoryHistory } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeCanonicalBundleSha256 } from '@/adapters/media/opfs-catalog.adapter';
import { createTestDependenciesBundle } from '@/composition/bootstrap-test';
import type { ExamBundlePayload } from '@/gateways/catalog.gateway';
import type { CatalogPackRecord } from '@/gateways/storage.gateway';
import { DesktopSimulatorApp } from '@/spa/DesktopSimulatorApp';
import { createAppRouter } from '@/spa/router';
import { useClockStore } from '@/spa/stores/clock.store';

async function seedSpeakingPack(params: {
  readonly edition: 'glb' | 'irn';
  readonly packId: string;
  readonly examId: 'ielts_academic' | 'toefl_ibt';
  readonly track: 'academic' | 'toefl';
  readonly sections: ExamBundlePayload['sections'];
}) {
  const bundleDeps = createTestDependenciesBundle({ edition: params.edition });
  const nowMs = bundleDeps.fakeClock.nowMs();
  const sha256 = await computeCanonicalBundleSha256(params.sections, []);

  const packSummary: ExamBundlePayload['pack'] = {
    packId: params.packId,
    edition: params.edition,
    examId: params.examId,
    track: params.track,
    skill: 'speaking',
    title: `Speaking Studio (${params.examId})`,
    description: 'Multi-turn speaking assessment',
    durationSeconds: 600,
    questionCount: params.sections.length,
    isFreeSample: true,
    version: '1.0.0',
    sha256,
    byteLength: 2048,
    downloadUrl: `https://cdn.example.invalid/packs/${params.packId}.json`,
    contentOrigin: 'authored_original',
    humanQaReviewed: true,
    accent: null,
    mediaUrl: null,
    topicKeys: [],
    weaknessTargets: [],
    cefrMin: 'B1',
    cefrMax: 'C1',
    roadmapOrder: 0,
  };

  const pack: CatalogPackRecord = {
    ...packSummary,
    examId: params.examId,
    skill: 'speaking',
    accent: null,
    mediaUrl: null,
    isCachedOffline: 1,
    bundleJson: null,
    cachedMediaInline: null,
    sizeBytes: 2048,
    cachedAtMs: nowMs,
    updatedAtMs: nowMs,
  };

  bundleDeps.fakeCatalog.seedPackAndBundle(pack, {
    pack: packSummary,
    sections: params.sections,
    questions: [],
  });

  return { bundleDeps, deps: bundleDeps.deps };
}

describe('W5.4 SpeakingSimulatorScreen', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    useClockStore.getState().setActiveExamLock(false);
  });

  afterEach(() => {
    useClockStore.getState().setActiveExamLock(false);
    cleanup();
    vi.unstubAllGlobals();
  });

  it('handles zero-prep Turn 1, IELTS Part 2 Prep -> Skip Prep & Cue Notes, multi-turn upload, and job queue (GLB)', async () => {
    const sections: ExamBundlePayload['sections'] = [
      {
        sectionId: 'sp-p1',
        sectionIndex: 0,
        sectionType: 'speaking_part',
        title: 'Part 1: Daily Reading Habits',
        instructions: 'Answer immediately with no prep timer.',
        durationSeconds: 30,
        wordCount: 15,
        contentText: 'Do you prefer reading printed books or digital articles?',
        metadata: { prepSeconds: 0, responseSeconds: 30 },
      },
      {
        sectionId: 'sp-p2',
        sectionIndex: 1,
        sectionType: 'speaking_part',
        title: 'Part 2: Cue Card Long Turn',
        instructions: 'You have 60 seconds to prepare notes and up to 2 minutes to speak.',
        durationSeconds: 120,
        wordCount: 25,
        contentText: 'Describe a public park in your city that you enjoy visiting.',
        metadata: { prepSeconds: 60, responseSeconds: 120 },
      },
    ];

    const { bundleDeps, deps } = await seedSpeakingPack({
      edition: 'glb',
      packId: 'speak-ielts-01',
      examId: 'ielts_academic',
      track: 'academic',
      sections,
    });

    await deps.attemptStore.saveUserProfile({
      deviceId: 'dev-glb',
      examId: 'ielts_academic',
      examModule: 'academic',
      targetBand: 7.5,
      targetDateSerial: null,
      onboardingCompleted: true,
      freeDiagnosticUsed: false,
      linkedEmail: null,
      appUserId: null,
      isPro: true,
      updatedAtMs: deps.clock.nowMs(),
    });

    const history = createMemoryHistory({
      initialEntries: ['/app/practice/speaking/speak-ielts-01'],
    });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    // Part 1 has zero prep -> recorder starts immediately!
    await waitFor(() => {
      expect(screen.getByTestId('speaking-immediate-stage')).toBeTruthy();
    });
    expect(screen.getByTestId('speaking-prep-mode-badge').textContent).toContain('No Prep');
    expect((screen.getByTestId('recorder-start-btn') as HTMLButtonElement).disabled).toBe(false);

    // Record & stop Part 1
    fireEvent.click(screen.getByTestId('recorder-start-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('recorder-stop-btn')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('recorder-stop-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('speaking-turn-recorded-banner')).toBeTruthy();
    });

    // Advance to Part 2 -> Prep stage active, Cue notes available, Recorder disabled until Skip Prep
    fireEvent.click(screen.getByTestId('speaking-turn-tab-1'));
    await waitFor(() => {
      expect(screen.getByTestId('speaking-prep-stage')).toBeTruthy();
    });
    expect((screen.getByTestId('recorder-start-btn') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('speaking-cue-notes'), {
      target: { value: 'Old trees, weekend fountain, quiet jogging path' },
    });

    // Skip Prep & Start Recording enables recorder immediately
    fireEvent.click(screen.getByTestId('skip-prep-start-recording-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('speaking-immediate-stage')).toBeTruthy();
    });
    expect((screen.getByTestId('recorder-start-btn') as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByTestId('recorder-start-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('recorder-stop-btn')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('recorder-stop-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('speaking-recorded-progress').textContent).toBe('2 / 2');
    });

    // Verify quota check blocks on exhausted quota cleanly
    bundleDeps.fakeEvaluation.setQuotaOverride({
      isPro: false,
      dailySpeakingUsed: 1,
      dailySpeakingLimit: 1,
    });
    fireEvent.click(screen.getByTestId('speaking-submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('speaking-upgrade-cta')).toBeTruthy();
    });

    // Restore Pro quota & submit all 2 turns -> routes to /evaluation/pending/$jobId
    bundleDeps.fakeEvaluation.setQuotaOverride({
      isPro: true,
      dailySpeakingUsed: 0,
      dailySpeakingLimit: 10,
    });
    fireEvent.click(screen.getByTestId('speaking-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('evaluation-result-screen')).toBeTruthy();
    });
    expect(useClockStore.getState().activeExamLock).toBe(false);

    const attempts = await deps.attemptStore.listCompletedAttempts({
      examId: 'ielts_academic',
      skill: 'speaking',
    });
    expect(attempts.ok).toBe(true);
    if (attempts.ok) {
      expect(attempts.value[0]?.status).toBe('completed');
      expect(attempts.value[0]?.questionCount).toBe(2);
    }
  });

  it('supports TOEFL zero-prep Interview in IRN RTL layout without losing LTR waveform/timer', async () => {
    const { deps } = await seedSpeakingPack({
      edition: 'irn',
      packId: 'speak-toefl-01',
      examId: 'toefl_ibt',
      track: 'toefl',
      sections: [
        {
          sectionId: 'toefl-int-1',
          sectionIndex: 0,
          sectionType: 'speaking_part',
          title: 'Take an Interview · Question 1',
          instructions: 'Respond immediately for 45 seconds.',
          durationSeconds: 45,
          wordCount: 16,
          contentText: 'Why do some students prefer interdisciplinary research projects?',
          metadata: { prepSeconds: 0, responseSeconds: 45 },
        },
      ],
    });

    const history = createMemoryHistory({
      initialEntries: ['/app/practice/speaking/speak-toefl-01'],
    });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('speaking-immediate-stage')).toBeTruthy();
    });
    expect((screen.getByTestId('recorder-start-btn') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId('recorder-timer').textContent).toContain('00:45');
  });
});
