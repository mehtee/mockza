import { createMemoryHistory } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDependenciesBundle } from '@/composition/bootstrap-test';
import type { CompletedAttemptRecord, EvaluationOutputDto } from '@/gateways/storage.gateway';
import { DesktopSimulatorApp } from '@/spa/DesktopSimulatorApp';
import { createAppRouter } from '@/spa/router';

describe('W6.1 EvaluationPendingScreen & EvaluationResultScreen', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('displays non-blocking pending stepper and renders split Writing review with inline spans, TOEFL concordance & 1-click SM-2 upgrade', async () => {
    const bundleDeps = createTestDependenciesBundle({ edition: 'glb' });
    const { deps } = bundleDeps;
    const nowMs = deps.clock.nowMs();
    const attemptId = '00000000-0000-4000-8000-000000000777';

    // 1. Queued pending screen when job ID is still processing
    const pendingHistory = createMemoryHistory({
      initialEntries: ['/app/evaluation/pending/00000000-0000-4000-8000-000000000999'],
    });
    const pendingRouter = createAppRouter(pendingHistory);
    render(<DesktopSimulatorApp router={pendingRouter} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('evaluation-pending-stepper')).toBeTruthy();
    });
    expect(screen.getByTestId('evaluation-pending-continue-link')).toBeTruthy();
    cleanup();

    // 2. Seed completed TOEFL Writing attempt + EvaluationResult
    const essay =
      'Significantly, renewable storage stabilizes peak grid demand across dense metropolitan zones.';
    const evalOutput: EvaluationOutputDto = {
      attemptId,
      overallBand: 5.5,
      isEstimated: true,
      criteria: [
        { code: 'CONTENT', label: 'Content & Task Fulfillment', band: 5.5, evidenceExcerpt: essay, feedbackNote: 'Addresses policy trade-offs directly.' },
        { code: 'ORG', label: 'Organization & Cohesion', band: 5.5, evidenceExcerpt: essay, feedbackNote: 'Logical topic progression.' },
        { code: 'VOCAB', label: 'Vocabulary Precision', band: 5.0, evidenceExcerpt: essay, feedbackNote: 'Upgrade verb modifiers.' },
        { code: 'GRAM', label: 'Grammatical Control', band: 5.5, evidenceExcerpt: essay, feedbackNote: 'Effective complex clauses.' },
      ],
      inlineEdits: [
        {
          editId: 'edit-1',
          startOffset: 0,
          endOffset: 13,
          originalText: 'Significantly',
          suggestedText: 'Critically',
          criterionCode: 'VOCAB',
          rationale: 'More precise argumentative framing adverb.',
        },
        {
          editId: 'edit-2',
          startOffset: 15,
          endOffset: 32,
          originalText: 'renewable storage',
          suggestedText: 'utility-scale battery storage',
          criterionCode: 'CONTENT',
          rationale: 'Concrete technical noun phrase lifts precision.',
        },
      ],
      modelRewrite: {
        targetBandDelta: 0.5,
        title: 'Band 6.0 Upgrade',
        rewrittenText: 'Critically, utility-scale battery storage mitigates peak grid stress across urban corridors.',
        preservedIdeasNote: 'Retains thesis while sharpening collocations.',
      },
      vocabUpgrades: [
        {
          id: 'vu-toefl-1',
          term: 'mitigate',
          ipa: '/ˈmɪt.ɪ.ɡeɪt/',
          definition: 'Make less severe or painful',
          contextSentence: 'Utility storage mitigates peak evening surges.',
          paraphrases: ['alleviate', 'soften'],
          bandRationale: 'Strong academic transitive verb.',
        },
      ],
      recommendedDrill: {
        drillType: 'lexical_precision',
        weakestCriterionCode: 'VOCAB',
        title: 'Academic Verb Precision',
        durationMinutes: 3,
      },
      actionableNextStep: 'Replace broad adjectives with concrete technical modifiers.',
      modelId: 'eval-v2',
      rubricVersion: 'toefl-2026-v1',
    };

    const attempt: CompletedAttemptRecord = {
      attemptId,
      examId: 'toefl_ibt',
      packId: 'toefl-writing-pack-01',
      skill: 'writing',
      status: 'completed',
      syncStatus: 'synced',
      remoteJobId: null,
      submissionJson: JSON.stringify({ essayText: essay, wordCount: 12 }),
      evaluationJson: JSON.stringify(evalOutput),
      overallBand: 5.5,
      errorCode: null,
      startedAtUtcMs: nowMs - 300_000,
      completedAtMs: nowMs,
      durationSeconds: 300,
      usedStudyMode: false,
      questionCount: 1,
      isCalibratedFullPack: true,
      contentVersion: '1.0.0',
      mockSessionId: null,
      mockStageKey: null,
      updatedAtMs: nowMs,
    };

    await deps.attemptStore.saveAttemptRecord(attempt);
    await deps.attemptStore.saveEvaluationResult({
      id: 'eval-rec-1',
      attemptId,
      submissionId: 'sub-1',
      examId: 'toefl_ibt',
      skill: 'writing',
      overallBand: 5.5,
      resultJson: evalOutput,
      createdAtMs: nowMs,
    });

    const resultHistory = createMemoryHistory({
      initialEntries: [`/app/evaluation/result/${attemptId}`],
    });
    const resultRouter = createAppRouter(resultHistory);
    render(<DesktopSimulatorApp router={resultRouter} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('eval-annotated-essay')).toBeTruthy();
    });

    // TOEFL 5.5 displays legacy /120 concordance
    expect(screen.getByText(/\/120/)).toBeTruthy();

    // Clicking second inline edit span updates inspector panel
    fireEvent.click(screen.getByTestId('inline-edit-span-edit-2'));
    expect(screen.getByTestId('inline-edit-inspector').textContent).toContain(
      'utility-scale battery storage',
    );

    // 1-click Add to SM-2 Deck persists card
    fireEvent.click(screen.getByTestId('add-vocab-sm2-vu-toefl-1'));
    await waitFor(async () => {
      const cards = await deps.vocabStore.getAllCards();
      expect(cards.ok).toBe(true);
      if (cards.ok) {
        expect(cards.value.some((c) => c.card.headword === 'mitigate')).toBe(true);
      }
    });
  });

  it('displays DET 4 integrated subscores and IRN Persian glosses in Speaking review', async () => {
    const { deps } = createTestDependenciesBundle({ edition: 'irn' });
    const nowMs = deps.clock.nowMs();
    const attemptId = '00000000-0000-4000-8000-000000000888';

    const evalOutput: EvaluationOutputDto = {
      attemptId,
      overallBand: 130,
      isEstimated: true,
      criteria: [
        { code: 'FC', label: 'Fluency', band: 130, evidenceExcerpt: 'Sample', feedbackNote: 'روانی گفتار بسیار خوب است.' },
        { code: 'LR', label: 'Lexis', band: 125, evidenceExcerpt: 'Sample', feedbackNote: 'واژگان علمی دقیق.' },
        { code: 'GRA', label: 'Grammar', band: 130, evidenceExcerpt: 'Sample', feedbackNote: 'ساختارهای پیچیده صحیح.' },
        { code: 'PR', label: 'Pronunciation', band: 135, evidenceExcerpt: 'Sample', feedbackNote: 'تلفظ شفاف و واضح.' },
      ],
      transcriptSegments: [
        {
          segmentId: 'seg-irn-1',
          partIndex: 1,
          startMs: 0,
          endMs: 3200,
          text: 'Community museums foster cross-generational curiosity.',
          annotations: [{ type: 'phrasing', suggestion: 'spark lifelong curiosity', rationale: 'Natural collocation' }],
        },
      ],
      vocabUpgrades: [
        {
          id: 'vu-det-1',
          term: 'foster',
          definition: 'Encourage the development of something desirable',
          glossFa: 'پرورش دادن یا تقویت کردن',
          contextSentence: 'Public spaces foster civic trust.',
          paraphrases: ['cultivate'],
          bandRationale: 'Academic verb boost.',
        },
      ],
      actionableNextStep: 'در پاسخ‌های طولانی از جملات شرطی بیشتری استفاده کنید.',
      modelId: 'eval-irn-v2',
      rubricVersion: 'det-2026-v1',
    };

    await deps.attemptStore.saveEvaluationResult({
      id: 'eval-rec-irn',
      attemptId,
      submissionId: 'sub-irn',
      examId: 'det',
      skill: 'speaking',
      overallBand: 130,
      resultJson: evalOutput,
      createdAtMs: nowMs,
    });

    const history = createMemoryHistory({
      initialEntries: [`/app/evaluation/result/${attemptId}`],
    });
    const router = createAppRouter(history);
    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('eval-transcript-card')).toBeTruthy();
    });
    expect(screen.getByText(/Literacy:/)).toBeTruthy();
    expect(screen.getByText('پرورش دادن یا تقویت کردن')).toBeTruthy();
    expect(screen.getByTestId('ecosystem-handoff-card')).toBeTruthy();
  });
});
