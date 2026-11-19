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

async function seedReadingTestBundle(edition: 'glb' | 'irn') {
  const bundleDeps = createTestDependenciesBundle({ edition });
  const nowMs = bundleDeps.fakeClock.nowMs();

  const passageOne =
    'Municipal microgrids allow solar installations to stabilize local voltage during extreme heatwaves. Engineers report forty percent fewer blackouts.';
  const passageTwo =
    'Battery storage pricing dropped sharply over five years, encouraging hospitals to adopt hybrid backup architectures.';

  const sections: ExamBundlePayload['sections'] = [
    {
      sectionId: 'sec-r1',
      sectionIndex: 0,
      sectionType: 'reading_passage',
      title: 'Passage 1: Urban Microgrids',
      instructions: 'Read Passage 1 and answer Questions 1–2.',
      durationSeconds: 1800,
      wordCount: passageOne.split(' ').length,
      contentText: passageOne,
      mediaUrl: null,
      transcript: null,
    },
    {
      sectionId: 'sec-r2',
      sectionIndex: 1,
      sectionType: 'reading_passage',
      title: 'Passage 2: Storage Economics',
      instructions: 'Read Passage 2 and answer Question 3.',
      durationSeconds: 1800,
      wordCount: passageTwo.split(' ').length,
      contentText: passageTwo,
      mediaUrl: null,
      transcript: null,
    },
  ];

  const questions: ExamBundlePayload['questions'] = [
    {
      questionId: 'q-r1',
      sectionId: 'sec-r1',
      questionNumber: 1,
      questionType: 'tfng',
      prompt: 'Microgrids can help stabilize local voltage in severe heat.',
      options: ['TRUE', 'FALSE', 'NOT GIVEN'],
      acceptedAnswers: ['TRUE'],
      maxWords: null,
      cueTimestampMs: null,
      evidence: {
        exactQuote: 'stabilize local voltage during extreme heatwaves',
        paragraphHint: 'Paragraph 1',
      },
    },
    {
      questionId: 'q-r2',
      sectionId: 'sec-r1',
      questionNumber: 2,
      questionType: 'summary_gap_fill',
      prompt: 'Engineers documented forty percent fewer ______.',
      options: null,
      acceptedAnswers: ['blackouts'],
      maxWords: 2,
      cueTimestampMs: null,
      evidence: {
        exactQuote: 'forty percent fewer blackouts',
        paragraphHint: 'Paragraph 1',
      },
    },
    {
      questionId: 'q-r3',
      sectionId: 'sec-r2',
      questionNumber: 3,
      questionType: 'mcq_single',
      prompt: 'Why did hospitals adopt hybrid backup architectures?',
      options: [
        'A. Grid subsidies tripled',
        'B. Battery storage pricing dropped sharply',
        'C. Diesel generators were outlawed',
      ],
      acceptedAnswers: ['B'],
      maxWords: null,
      cueTimestampMs: null,
      evidence: {
        exactQuote: 'Battery storage pricing dropped sharply',
        paragraphHint: 'Paragraph 2',
      },
    },
  ];

  const sha256 = await computeCanonicalBundleSha256(sections, questions);

  const packSummary: ExamBundlePayload['pack'] = {
    packId: 'read-test-01',
    edition,
    examId: 'ielts_academic',
    track: 'academic',
    skill: 'reading',
    title: 'Solar Microgrids & Urban Resilience',
    description: '2 passages · 3 items',
    durationSeconds: 3600,
    questionCount: 3,
    isFreeSample: true,
    version: '1.0.0',
    sha256,
    byteLength: 4096,
    downloadUrl: 'https://cdn.example.invalid/packs/read-test-01.json',
    contentOrigin: 'authored_original',
    humanQaReviewed: true,
    accent: null,
    mediaUrl: null,
  };

  const pack: CatalogPackRecord = {
    ...packSummary,
    examId: 'ielts_academic',
    skill: 'reading',
    accent: null,
    mediaUrl: null,
    isCachedOffline: 1,
    bundleJson: null,
    cachedMediaInline: null,
    sizeBytes: 4096,
    cachedAtMs: nowMs,
    updatedAtMs: nowMs,
  };

  const bundle: ExamBundlePayload = {
    pack: packSummary,
    sections,
    questions,
  };

  bundleDeps.fakeCatalog.seedPackAndBundle(pack, bundle);
  return { deps: bundleDeps.deps, bundle };
}

describe('W5.1 ReadingSimulatorScreen & ObjectiveResultScreen', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
    useClockStore.getState().setActiveExamLock(false);
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    useClockStore.getState().setActiveExamLock(false);
    cleanup();
    vi.unstubAllGlobals();
  });

  it('supports split reading, passage highlight/notes, save-to-vocab, scoring, evidence jump, and AI tutor (GLB)', async () => {
    const { deps } = await seedReadingTestBundle('glb');
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
      initialEntries: ['/app/practice/reading/read-test-01'],
    });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('reading-question-card-1')).toBeTruthy();
    });
    expect(useClockStore.getState().activeExamLock).toBe(true);

    // Highlight passage text with margin note AND save to SM-2 Vocab
    const textBody = screen.getByTestId('passage-text-body');
    const firstNode = textBody.querySelector('span')?.firstChild;
    expect(firstNode).toBeTruthy();
    const range = document.createRange();
    range.setStart(firstNode!, 0);
    range.setEnd(firstNode!, 20); // "Municipal microgrids"
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    fireEvent.mouseUp(textBody);

    await waitFor(() => {
      expect(screen.getByTestId('annotator-save-vocab-btn')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('annotator-save-vocab-btn'));

    await waitFor(async () => {
      const cards = await deps.vocabStore.getAllCards();
      expect(cards.ok).toBe(true);
      if (cards.ok) {
        expect(cards.value.length).toBe(1);
        expect(cards.value[0]?.card.headword.toLowerCase()).toContain('municipal');
      }
    });

    // Add note highlight on the same text selection
    sel.removeAllRanges();
    sel.addRange(range);
    fireEvent.mouseUp(textBody);
    fireEvent.click(screen.getByTestId('annotator-note-toggle'));
    fireEvent.change(screen.getByTestId('annotator-note-input'), {
      target: { value: 'Core concept' },
    });
    fireEvent.click(screen.getByTestId('annotator-save-note-btn'));

    await waitFor(async () => {
      const anns = await deps.attemptStore.getPassageAnnotations('read-test-01');
      expect(anns.ok).toBe(true);
      if (anns.ok) {
        expect(anns.value.length).toBe(1);
        expect(anns.value[0]?.noteText).toBe('Core concept');
      }
    });

    // Switch layout to "All Questions" in section 1, answer Q1 correctly & Q2 wrongly
    fireEvent.click(screen.getByRole('tab', { name: 'All Questions' }));
    expect(screen.getByTestId('reading-question-card-2')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: 'TRUE' }));
    const gapInput = screen.getByTestId('text-answer-2');
    fireEvent.change(gapInput, { target: { value: 'delays' } });
    fireEvent.click(screen.getByTestId('flag-question-2'));

    // Switch to Passage 2 tab & answer Q3 correctly
    fireEvent.click(screen.getByTestId('reading-section-tab-1'));
    await waitFor(() => {
      expect(screen.getByTestId('reading-question-card-3')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('radio', { name: /Battery storage pricing dropped sharply/ }));

    // Submit in Exam Mode (useBlocker must allow navigation cleanly)
    fireEvent.click(screen.getByTestId('reading-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('objective-result-screen')).toBeTruthy();
      expect(screen.getByText(/2\s*\/\s*3.*67%/)).toBeTruthy();
    });
    expect(useClockStore.getState().activeExamLock).toBe(false);

    // Filter Incorrect Only -> only Question 2 remains visible
    fireEvent.click(screen.getByRole('tab', { name: 'Incorrect Only' }));
    expect(screen.queryByTestId('result-question-card-1')).toBeNull();
    expect(screen.getByTestId('result-question-card-2')).toBeTruthy();

    // Jump to Evidence highlights quote in left passage pane
    fireEvent.click(screen.getByTestId('jump-evidence-2'));
    await waitFor(() => {
      const evidenceEl = screen.getByTestId('evidence-span-highlight');
      expect(evidenceEl.textContent).toContain('forty percent fewer blackouts');
    });

    // Ask AI Why? loads contextual rationale + quote + distractor notes
    fireEvent.click(screen.getByTestId('ask-ai-why-2'));
    await waitFor(() => {
      expect(screen.getByTestId('ai-explanation-2')).toBeTruthy();
    });
    expect(screen.getByTestId('ai-explanation-2').textContent).toContain(
      'exact passage/transcript evidence',
    );
  });

  it('delivers Persian AI explanation overlay in IRN edition while keeping exam text LTR', async () => {
    const { deps } = await seedReadingTestBundle('irn');
    await deps.attemptStore.saveUserProfile({
      deviceId: 'dev-irn',
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
      initialEntries: ['/app/practice/reading/read-test-01'],
    });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('reading-question-card-1')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('reading-submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('objective-result-screen')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('ask-ai-why-1'));
    await waitFor(() => {
      const card = screen.getByTestId('ai-explanation-1');
      expect(card.textContent).toContain('پاسخ');
    });
  });
});
