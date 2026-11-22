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

async function seedListeningTestBundle(edition: 'glb' | 'irn') {
  const bundleDeps = createTestDependenciesBundle({ edition });
  const nowMs = bundleDeps.fakeClock.nowMs();

  bundleDeps.fakeCatalog.seedRemoteMedia(
    'https://cdn.example.invalid/audio/list-test-01-p1.m4a',
    new Uint8Array([1, 2, 3, 4]),
    'audio/mp4',
  );
  bundleDeps.fakeCatalog.seedRemoteMedia(
    'https://cdn.example.invalid/audio/list-test-01-p2.m4a',
    new Uint8Array([5, 6, 7, 8]),
    'audio/mp4',
  );

  const sections: ExamBundlePayload['sections'] = [
    {
      sectionId: 'sec-l1',
      sectionIndex: 0,
      sectionType: 'listening_part',
      title: 'Part 1: Campus Library Registration',
      instructions: 'Listen once and complete Questions 1–2.',
      durationSeconds: 120,
      wordCount: 40,
      contentText: '',
      mediaUrl: 'https://cdn.example.invalid/audio/list-test-01-p1.m4a',
      transcript: [
        {
          startMs: 0,
          endMs: 22000,
          speaker: 'Librarian',
          text: 'Welcome to the Science Library desk. Please confirm your postal code.',
        },
        {
          startMs: 25000,
          endMs: 48000,
          speaker: 'Student',
          text: 'Sure, the seminar starts at nine thirty in Auditorium B.',
        },
      ],
    },
    {
      sectionId: 'sec-l2',
      sectionIndex: 1,
      sectionType: 'dictation',
      title: 'Part 2: Spoken Dictation Check',
      instructions: 'Type the exact spoken sentence.',
      durationSeconds: 60,
      wordCount: 12,
      contentText: 'Type accurately after listening.',
      mediaUrl: 'https://cdn.example.invalid/audio/list-test-01-p2.m4a',
      transcript: [
        {
          startMs: 0,
          endMs: 12000,
          speaker: 'Speaker',
          text: 'Archive permits renew automatically each October.',
        },
      ],
    },
  ];

  const questions: ExamBundlePayload['questions'] = [
    {
      questionId: 'q-l1',
      sectionId: 'sec-l1',
      questionNumber: 1,
      questionType: 'form_completion',
      prompt: 'Seminar hall room: Auditorium ______',
      options: null,
      acceptedAnswers: ['B'],
      maxWords: 1,
      cueTimestampMs: 25000,
      evidence: { exactQuote: 'Auditorium B' },
    },
    {
      questionId: 'q-l2',
      sectionId: 'sec-l1',
      questionNumber: 2,
      questionType: 'mcq_single',
      prompt: 'What time does the seminar start?',
      options: ['8:30', '9:30', '10:30'],
      acceptedAnswers: ['9:30'],
      maxWords: null,
      cueTimestampMs: 25000,
      evidence: { exactQuote: 'nine thirty' },
    },
    {
      questionId: 'q-l3',
      sectionId: 'sec-l2',
      questionNumber: 3,
      questionType: 'dictation',
      prompt: 'Type the exact sentence you hear.',
      options: null,
      acceptedAnswers: ['Archive permits renew automatically each October'],
      maxWords: 12,
      cueTimestampMs: 0,
      evidence: { exactQuote: 'Archive permits renew automatically each October' },
    },
  ];

  const sha256 = await computeCanonicalBundleSha256(sections, questions);

  const packSummary: ExamBundlePayload['pack'] = {
    packId: 'list-test-01',
    edition,
    examId: 'ielts_academic',
    track: 'academic',
    skill: 'listening',
    title: 'Academic Library & Lecture Listening',
    description: '2 tracks · 3 items',
    durationSeconds: 900,
    questionCount: 3,
    isFreeSample: true,
    version: '1.0.0',
    sha256,
    byteLength: 4096,
    downloadUrl: 'https://cdn.example.invalid/packs/list-test-01.json',
    contentOrigin: 'authored_original',
    humanQaReviewed: true,
    accent: 'en-GB',
    mediaUrl: 'https://cdn.example.invalid/audio/list-test-01-p1.m4a',
    topicKeys: [],
    weaknessTargets: [],
    cefrMin: 'B1',
    cefrMax: 'C1',
    roadmapOrder: 0,
  };

  const pack: CatalogPackRecord = {
    ...packSummary,
    examId: 'ielts_academic',
    skill: 'listening',
    accent: 'en-GB',
    mediaUrl: 'https://cdn.example.invalid/audio/list-test-01-p1.m4a',
    isCachedOffline: 1,
    bundleJson: null,
    cachedMediaInline: null,
    sizeBytes: 4096,
    cachedAtMs: nowMs,
    updatedAtMs: nowMs,
  };

  bundleDeps.fakeCatalog.seedPackAndBundle(pack, {
    pack: packSummary,
    sections,
    questions,
  });

  return { deps: bundleDeps.deps, bundleDeps };
}

describe('W5.2 ListeningSimulatorScreen', () => {
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

  it('enforces exam linear audio lock, unlocks Study transcript & speed, and jumps audio cue in review (GLB)', async () => {
    const { deps } = await seedListeningTestBundle('glb');
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
      initialEntries: ['/app/practice/listening/list-test-01'],
    });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('listening-question-card-1')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByTestId('listening-buffer-badge').textContent).toContain(
        'Studio Audio Ready',
      );
    });

    // Exam Mode locks playback linearly & hides speed + transcript
    expect(screen.getByTestId('audio-exam-locked-badge')).toBeTruthy();
    expect(screen.queryByTestId('audio-transcript-panel')).toBeNull();
    expect(
      (screen.getByTestId('audio-seek-slider') as HTMLInputElement).disabled,
    ).toBe(true);

    // Switch to Study Mode -> reveals speed control & clickable synced transcript
    fireEvent.click(screen.getByRole('tab', { name: 'Study Mode' }));
    await waitFor(() => {
      expect(screen.getByTestId('audio-transcript-panel')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('audio-speed-btn'));
    expect(screen.getByTestId('audio-speed-btn').textContent).toBe('1.25x');

    // Click transcript segment at 00:25 -> updates playhead to 00:25
    fireEvent.click(screen.getByTestId('transcript-segment-sec-l1-tr-1'));
    expect(screen.getByTestId('audio-current-time').textContent).toBe('00:25');

    // Switch to All Questions and answer Q1 correctly & Q2 wrongly
    fireEvent.click(screen.getByRole('tab', { name: 'All Questions' }));
    fireEvent.change(screen.getByTestId('text-answer-1'), { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('radio', { name: /8:30/ }));

    // Switch to Track 2 (dictation) & answer Q3
    fireEvent.click(screen.getByTestId('listening-section-tab-1'));
    await waitFor(() => {
      expect(screen.getByTestId('listening-question-card-3')).toBeTruthy();
    });
    fireEvent.change(screen.getByTestId('text-answer-3'), {
      target: { value: 'Archive permits renew automatically each October' },
    });

    // Submit -> routes to ObjectiveResultScreen with Listening review
    fireEvent.click(screen.getByTestId('listening-submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('objective-result-screen')).toBeTruthy();
      expect(screen.getByText(/2\s*\/\s*3.*67%/)).toBeTruthy();
    });

    // Jump to Evidence seeks review AudioStudioPlayer playhead to 00:25
    fireEvent.click(screen.getByTestId('jump-evidence-2'));
    await waitFor(() => {
      expect(screen.getByTestId('audio-current-time').textContent).toBe('00:25');
    });
  });

  it('supports Persian RTL shell with LTR Listening audio & dictation controls (IRN)', async () => {
    const { deps } = await seedListeningTestBundle('irn');
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
      initialEntries: ['/app/practice/listening/list-test-01'],
    });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('listening-question-card-1')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('listening-submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('objective-result-screen')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('ask-ai-why-1'));
    await waitFor(() => {
      expect(screen.getByTestId('ai-explanation-1').textContent).toContain('پاسخ');
    });
  });
});
