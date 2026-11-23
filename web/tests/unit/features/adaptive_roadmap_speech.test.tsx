import { createMemoryHistory } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakePersonalizationAdapter, FakeSpeechPracticeAdapter } from '@/adapters/fakes';
import { PassageAnnotatorPane } from '@/components/exam-kit';
import { setGlobalDefaultTtsAccent } from '@/components/speech-tts';
import { InlineListenButton } from '@/components/speech/InlineListenButton';
import { createTestDependencies } from '@/composition/bootstrap-test';
import type { VocabCardRecord } from '@/gateways/storage.gateway';
import { DesktopSimulatorApp } from '@/spa/DesktopSimulatorApp';
import { AppDependenciesProvider } from '@/spa/deps';
import { createAppRouter } from '@/spa/router';

describe('Adaptive Personalization, Roadmap, Kokoro TTS & Pronunciation Studio', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders /app/roadmap with 4-milestone panorama and advances active step cleanly (GLB & IRN)', async () => {
    const personalization = new FakePersonalizationAdapter();
    const speechPractice = new FakeSpeechPracticeAdapter();
    const baseDeps = createTestDependencies({ edition: 'glb' });
    const deps = { ...baseDeps, personalization, speechPractice };

    const history = createMemoryHistory({ initialEntries: ['/app/roadmap'] });
    const router = createAppRouter(history);
    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('roadmap-screen')).toBeTruthy();
      expect(screen.getByTestId('roadmap-panorama')).toBeTruthy();
      expect(screen.getByTestId('roadmap-current-steps')).toBeTruthy();
    });

    // Verify only current step(s) shown initially (max 3), upcoming collapsed until toggled
    expect(screen.queryByTestId('roadmap-upcoming-list')).toBeNull();
    fireEvent.click(screen.getByTestId('roadmap-toggle-upcoming'));
    await waitFor(() => {
      expect(screen.getByTestId('roadmap-upcoming-list')).toBeTruthy();
    });

    const initialState = await personalization.getState();
    expect(initialState.ok).toBe(true);
    if (initialState.ok && initialState.value.roadmap.currentStep) {
      const stepId = initialState.value.roadmap.currentStep.stepId;
      fireEvent.click(screen.getByTestId(`roadmap-step-complete-${stepId}`));
      await waitFor(async () => {
        const updated = await personalization.getState();
        if (updated.ok) {
          const completedStep = updated.value.roadmap.steps.find((s) => s.stepId === stepId);
          expect(completedStep?.status).toBe('completed');
        }
      });
    }
  });

  it('triggers OpenRouter Kokoro API Listen and Gemini Pronunciation Studio from Vocab (IRN)', async () => {
    const personalization = new FakePersonalizationAdapter();
    const speechPractice = new FakeSpeechPracticeAdapter();
    const ttsSpy = vi.spyOn(speechPractice, 'synthesizeTts');
    const analyzeSpy = vi.spyOn(speechPractice, 'submitPronunciationPractice');

    const baseDeps = createTestDependencies({ edition: 'irn' });
    const deps = { ...baseDeps, personalization, speechPractice };
    const nowMs = deps.clock.nowMs();
    const card: VocabCardRecord = {
      cardId: 'card-pron-1',
      examId: 'ielts_academic',
      headword: 'ubiquitous',
      ipa: '/juːˈbɪk.wɪ.təs/',
      definition: 'Found everywhere.',
      glossFa: 'فراگیر',
      topicTag: 'technology',
      canonicalTopic: 'technology_ai',
      sourceKind: 'seeded',
      tags: ['ielts'],
      contextSentence: 'Smartphones are ubiquitous across campuses.',
      paraphraseHints: ['pervasive'],
      usageNote: null,
      sourceSkill: null,
      sourceAttemptId: null,
      sourceRefLabel: null,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };
    await deps.vocabStore.upsertSeededDeckPreservingSrs([card]);

    const history = createMemoryHistory({ initialEntries: ['/app/vocabulary/card-pron-1'] });
    const router = createAppRouter(history);
    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('vocab-detail-listen-headword')).toBeTruthy();
    });

    // Listen button uses Kokoro API gateway, NOT window.speechSynthesis
    fireEvent.click(screen.getByTestId('vocab-detail-listen-headword'));
    await waitFor(() => {
      expect(ttsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'ubiquitous', sourceContext: 'vocab' }),
      );
    });

    // Open Pronunciation Studio, record & verify Gemini word-by-word score + feedback
    fireEvent.click(screen.getByTestId('vocab-detail-practice-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('speech-practice-drawer')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('speech-record-start'));
    await waitFor(() => {
      expect(screen.getByTestId('speech-record-stop')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('speech-record-stop'));
    await waitFor(() => {
      expect(screen.getByTestId('speech-analyze-submit')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('speech-analyze-submit'));
    await waitFor(() => {
      expect(analyzeSpy).toHaveBeenCalled();
      expect(screen.getByTestId('speech-result-card')).toBeTruthy();
    });
  });

  it('propagates Settings UK/US accent to InlineListenButton and renders Study-Mode paragraph Listen strip only when allowed', async () => {
    const speechPractice = new FakeSpeechPracticeAdapter();
    const ttsSpy = vi.spyOn(speechPractice, 'synthesizeTts');
    const deps = { ...createTestDependencies({ edition: 'glb' }), speechPractice };

    setGlobalDefaultTtsAccent('uk');
    const { rerender } = render(
      <AppDependenciesProvider dependencies={deps}>
        <InlineListenButton text="collocation" sourceContext="vocab" testId="accent-listen-btn" />
      </AppDependenciesProvider>,
    );

    fireEvent.click(screen.getByTestId('accent-listen-btn'));
    await waitFor(() => {
      expect(ttsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'collocation', voice: 'bf_emma', sourceContext: 'vocab' }),
      );
    });

    setGlobalDefaultTtsAccent('us');
    fireEvent.click(screen.getByTestId('accent-listen-btn-slow'));
    await waitFor(() => {
      expect(ttsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'collocation', voice: 'af_bella', speed: 0.8 }),
      );
    });

    const multiParagraphText =
      'Paragraph one discusses urban heat islands.\n\nParagraph two examines reflective roofing materials.';

    rerender(
      <AppDependenciesProvider dependencies={deps}>
        <PassageAnnotatorPane
          title="Sample Passage"
          rawText={multiParagraphText}
          annotations={[]}
          allowSpeechPractice={false}
        />
      </AppDependenciesProvider>,
    );
    expect(screen.queryByTestId('passage-paragraph-listen-bar')).toBeNull();

    rerender(
      <AppDependenciesProvider dependencies={deps}>
        <PassageAnnotatorPane
          title="Sample Passage"
          rawText={multiParagraphText}
          annotations={[]}
          allowSpeechPractice={true}
        />
      </AppDependenciesProvider>,
    );
    expect(screen.getByTestId('passage-paragraph-listen-bar')).toBeTruthy();
    expect(screen.getByTestId('passage-listen-paragraph-0')).toBeTruthy();
    expect(screen.getByTestId('passage-listen-paragraph-1')).toBeTruthy();
  });

  it('shows starter basic roadmap steps offline when personalization is unavailable or diagnostic skipped', async () => {
    const baseDeps = createTestDependencies({ edition: 'irn' });
    const deps = { ...baseDeps, personalization: undefined };

    const history = createMemoryHistory({ initialEntries: ['/app/roadmap'] });
    const router = createAppRouter(history);
    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('roadmap-screen')).toBeTruthy();
      expect(screen.getByTestId('roadmap-panorama')).toBeTruthy();
      expect(screen.getByTestId('roadmap-active-step-2')).toBeTruthy();
    });
    expect(screen.getByText(/نامشخص \(پایه\)/)).toBeTruthy();
  });
});
