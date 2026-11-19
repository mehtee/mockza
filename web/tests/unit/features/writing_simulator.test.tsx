import { createMemoryHistory } from '@tanstack/react-router';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeCanonicalBundleSha256 } from '@/adapters/media/opfs-catalog.adapter';
import { createTestDependenciesBundle } from '@/composition/bootstrap-test';
import type { ExamBundlePayload } from '@/gateways/catalog.gateway';
import { err } from '@/gateways/result';
import type { CatalogPackRecord } from '@/gateways/storage.gateway';
import { DesktopSimulatorApp } from '@/spa/DesktopSimulatorApp';
import { createAppRouter } from '@/spa/router';
import { useClockStore } from '@/spa/stores/clock.store';

async function seedWritingPack(params: {
  readonly edition: 'glb' | 'irn';
  readonly packId: string;
  readonly examId: 'ielts_academic' | 'toefl_ibt' | 'pte_academic' | 'det';
  readonly track: 'academic' | 'toefl' | 'pte' | 'det';
  readonly sections: ExamBundlePayload['sections'];
  readonly questions: ExamBundlePayload['questions'];
}) {
  const bundleDeps = createTestDependenciesBundle({ edition: params.edition });
  const nowMs = bundleDeps.fakeClock.nowMs();
  const sha256 = await computeCanonicalBundleSha256(params.sections, params.questions);

  const packSummary: ExamBundlePayload['pack'] = {
    packId: params.packId,
    edition: params.edition,
    examId: params.examId,
    track: params.track,
    skill: 'writing',
    title: `Writing Practice (${params.examId})`,
    description: 'Clean-room desktop writing pack',
    durationSeconds: 2400,
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
  };

  const pack: CatalogPackRecord = {
    ...packSummary,
    examId: params.examId,
    skill: 'writing',
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
    questions: params.questions,
  });

  return { bundleDeps, deps: bundleDeps.deps };
}

describe('W5.3 WritingSimulatorScreen', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
    useClockStore.getState().setActiveExamLock(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    useClockStore.getState().setActiveExamLock(false);
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders IELTS chart SVG + Essay tabs, persists 500ms & pagehide Dexie drafts, enforces quota, and submits async evaluation', async () => {
    const sections: ExamBundlePayload['sections'] = [
      {
        sectionId: 'w-task1',
        sectionIndex: 0,
        sectionType: 'task1Academic',
        title: 'Task 1: Solar Output by Region',
        instructions: 'Summarize the main trends in at least 150 words.',
        durationSeconds: 1200,
        wordCount: 30,
        contentText: 'The bar chart compares regional solar output across three climate zones.',
        metadata: {
          taskType: 'task1Academic',
          minWords: 150,
          chartSvg:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><rect width="20" height="40" /></svg>',
          chartCaption: 'Figure 1: Annual solar megawatts',
        },
      },
      {
        sectionId: 'w-task2',
        sectionIndex: 1,
        sectionType: 'task2Essay',
        title: 'Task 2: Public Transit Investment',
        instructions: 'Write at least 250 words.',
        durationSeconds: 2400,
        wordCount: 25,
        contentText: 'Governments should prioritize urban rail over highways. Do you agree?',
        metadata: {
          taskType: 'task2Essay',
          minWords: 250,
        },
      },
    ];

    const { bundleDeps, deps } = await seedWritingPack({
      edition: 'glb',
      packId: 'write-ielts-01',
      examId: 'ielts_academic',
      track: 'academic',
      sections,
      questions: [],
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
      isPro: false,
      updatedAtMs: deps.clock.nowMs(),
    });

    const history = createMemoryHistory({
      initialEntries: ['/app/practice/writing/write-ielts-01'],
    });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('exam-svg-chart-card')).toBeTruthy();
    });
    expect(screen.getByTestId('essay-spellcheck-locked-badge')).toBeTruthy();
    expect(screen.getByTestId('essay-editor-textarea').getAttribute('spellcheck')).toBe('false');

    // Edit essay -> trigger pagehide flush -> verify Dexie draft persisted
    const sampleEssay =
      'Regional solar capacity expanded considerably between 2020 and 2026 across all climate corridors.';
    fireEvent.change(screen.getByTestId('essay-editor-textarea'), {
      target: { value: sampleEssay },
    });

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
      await Promise.resolve();
    });

    await waitFor(async () => {
      const savedDraft = await deps.attemptStore.getActiveDraft('write-ielts-01', 'writing');
      expect(savedDraft.ok).toBe(true);
      if (savedDraft.ok) {
        expect(savedDraft.value?.draftText).toBe(sampleEssay);
      }
    });

    // Switch to Task 2 tab & back -> keeps Task 1 draft intact
    fireEvent.click(screen.getByTestId('writing-task-tab-1'));
    expect(screen.getByTestId('writing-task-spec-summary').textContent).toContain('Task 2');
    fireEvent.click(screen.getByTestId('writing-task-tab-0'));
    expect((screen.getByTestId('essay-editor-textarea') as HTMLTextAreaElement).value).toBe(
      sampleEssay,
    );

    // Exhaust daily quota -> preserves draft and displays Paywall upgrade CTA
    bundleDeps.fakeEvaluation.setQuotaOverride({
      isPro: false,
      dailyWritingUsed: 1,
      dailyWritingLimit: 1,
    });
    fireEvent.click(screen.getByTestId('writing-submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('writing-upgrade-cta')).toBeTruthy();
    });
    expect((screen.getByTestId('essay-editor-textarea') as HTMLTextAreaElement).value).toBe(
      sampleEssay,
    );

    // Restore Pro quota -> submit enqueues remote evaluation and navigates to /evaluation/pending/$jobId
    bundleDeps.fakeEvaluation.setQuotaOverride({
      isPro: true,
      dailyWritingUsed: 0,
      dailyWritingLimit: 10,
    });
    fireEvent.click(screen.getByTestId('writing-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('evaluation-result-screen')).toBeTruthy();
    });
    expect(useClockStore.getState().activeExamLock).toBe(false);

    const attempts = await deps.attemptStore.listCompletedAttempts({
      examId: 'ielts_academic',
      skill: 'writing',
    });
    expect(attempts.ok).toBe(true);
    if (attempts.ok) {
      expect(attempts.value[0]?.status).toBe('completed');
      expect(attempts.value[0]?.remoteJobId).toBeTruthy();
    }
  });

  it('supports TOEFL Build-a-Sentence reorder, PTE Single-Sentence rule, and IRN RTL wrapper', async () => {
    const sections: ExamBundlePayload['sections'] = [
      {
        sectionId: 'toefl-sb',
        sectionIndex: 0,
        sectionType: 'toeflSentenceBuild',
        title: 'Build a Grammatical Academic Claim',
        instructions: 'Order clauses to form one formal sentence.',
        durationSeconds: 360,
        wordCount: 20,
        contentText: 'Combine the prompt chunks into an accurate opening claim.',
        metadata: { taskType: 'toeflSentenceBuild' },
      },
      {
        sectionId: 'pte-swt',
        sectionIndex: 1,
        sectionType: 'pteSummarizeWrittenText',
        title: 'Summarize Written Text (1 Sentence)',
        instructions: 'Write 5–75 words in a single sentence.',
        durationSeconds: 600,
        wordCount: 40,
        contentText: 'Urban forests lower summer street temperatures across dense residential blocks.',
        metadata: { taskType: 'pteSummarizeWrittenText', minWords: 5, maxWords: 75 },
      },
    ];

    const questions: ExamBundlePayload['questions'] = [
      {
        questionId: 'q-sb-1',
        sectionId: 'toefl-sb',
        questionNumber: 1,
        questionType: 'reorder_sequence',
        prompt: 'Arrange chunks:',
        options: ['A. Urban wetlands', 'B. rapidly absorb', 'C. seasonal stormwater.'],
        acceptedAnswers: ['A|B|C'],
        maxWords: null,
      },
    ];

    const { deps } = await seedWritingPack({
      edition: 'irn',
      packId: 'write-mixed-01',
      examId: 'toefl_ibt',
      track: 'toefl',
      sections,
      questions,
    });

    const history = createMemoryHistory({
      initialEntries: ['/app/practice/writing/write-mixed-01'],
    });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('sequence-order-control')).toBeTruthy();
    });

    // Reordering first item down populates the English essay textarea automatically
    fireEvent.click(screen.getByTestId('sequence-down-A'));
    await waitFor(() => {
      expect((screen.getByTestId('essay-editor-textarea') as HTMLTextAreaElement).value).toBe(
        'rapidly absorb Urban wetlands seasonal stormwater.',
      );
    });

    // Switch to PTE Summarize Written Text -> two sentences triggers single-sentence rule error state
    fireEvent.click(screen.getByTestId('writing-task-tab-1'));
    fireEvent.change(screen.getByTestId('essay-editor-textarea'), {
      target: { value: 'First sentence. Second sentence violates limit.' },
    });
    expect(screen.getByTestId('essay-sentence-rule').className).toContain('text-error');
  });

  it('enqueues offline writing submission into syncOutbox and flushes automatically when online returns', async () => {
    const { deps, bundleDeps } = await seedWritingPack({
      edition: 'glb',
      packId: 'write-offline-01',
      examId: 'ielts_academic',
      track: 'academic',
      sections: [
        {
          sectionId: 'task-2',
          sectionIndex: 0,
          sectionType: 'writing_task',
          title: 'Task 2: Grid Resilience',
          instructions: 'Write at least 250 words.',
          durationSeconds: 2400,
          wordCount: 30,
          contentText: 'Evaluate public investments in grid resilience.',
          metadata: { taskType: 'task2Essay' },
        },
      ],
      questions: [],
    });

    const history = createMemoryHistory({
      initialEntries: ['/app/practice/writing/write-offline-01'],
    });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('essay-editor-textarea')).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId('essay-editor-textarea'), {
      target: {
        value:
          'Renewable energy infrastructure reduces urban grid instability during peak summer demand.',
      },
    });

    // Simulate network offline on submit -> saves attempt locally & enqueues syncOutbox
    const submitSpy = vi
      .spyOn(deps.evaluation, 'submitWritingEvaluation')
      .mockResolvedValueOnce(err({ kind: 'network', message: 'Network offline', retryable: true }));
    bundleDeps.fakeStorage.setOnline(false);
    fireEvent.click(screen.getByTestId('writing-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('progress-screen')).toBeTruthy();
    });

    const attempts = await deps.attemptStore.listCompletedAttempts({
      examId: 'ielts_academic',
      skill: 'writing',
    });
    expect(attempts.ok).toBe(true);
    if (attempts.ok) {
      expect(attempts.value[0]?.status).toBe('submitted_local');
      expect(attempts.value[0]?.syncStatus).toBe('pending');
    }

    // Reconnect network -> window 'online' listener triggers flushPending()
    submitSpy.mockRestore();
    bundleDeps.fakeStorage.setOnline(true);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await new Promise((r) => setTimeout(r, 30));
    });

    const flushed = await deps.attemptStore.listCompletedAttempts({
      examId: 'ielts_academic',
      skill: 'writing',
    });
    expect(flushed.ok).toBe(true);
    if (flushed.ok) {
      expect(flushed.value[0]?.status).not.toBe('submitted_local');
    }
  });
});
