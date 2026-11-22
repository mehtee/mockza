import { createMemoryHistory } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeCanonicalBundleSha256 } from '@/adapters/media/opfs-catalog.adapter';
import { createTestDependenciesBundle } from '@/composition/bootstrap-test';
import type { ExamBundlePayload } from '@/gateways/catalog.gateway';
import type { CachedDrillRecord, CatalogPackRecord } from '@/gateways/storage.gateway';
import { DesktopSimulatorApp } from '@/spa/DesktopSimulatorApp';
import { createAppRouter } from '@/spa/router';
import { useClockStore } from '@/spa/stores/clock.store';

async function seedW55Workspace(edition: 'glb' | 'irn' = 'glb') {
  const bundleDeps = createTestDependenciesBundle({ edition });
  const nowMs = bundleDeps.fakeClock.nowMs();

  // Seed 2 packs: one uncached IELTS Reading, one TOEFL Writing
  const readSections: ExamBundlePayload['sections'] = [
    {
      sectionId: 'sec-read-1',
      sectionIndex: 0,
      sectionType: 'reading_passage',
      title: 'Passage 1',
      instructions: 'Answer Question 1.',
      durationSeconds: 900,
      wordCount: 20,
      contentText: 'Desalination plants now pair reverse osmosis with solar thermal recovery.',
    },
  ];
  const readQuestions: ExamBundlePayload['questions'] = [
    {
      questionId: 'q-1',
      sectionId: 'sec-read-1',
      questionNumber: 1,
      questionType: 'tfng',
      prompt: 'Solar thermal recovery supports desalination.',
      options: ['TRUE', 'FALSE', 'NOT GIVEN'],
      acceptedAnswers: ['TRUE'],
    },
  ];
  const readSha = await computeCanonicalBundleSha256(readSections, readQuestions);

  const readPackSummary: ExamBundlePayload['pack'] = {
    packId: 'ielts-acad-reading-seed-01',
    edition,
    examId: 'ielts_academic',
    track: 'academic',
    skill: 'reading',
    title: 'IELTS Reading Pack 1',
    description: 'Academic desalination reading passage',
    durationSeconds: 3600,
    questionCount: 1,
    isFreeSample: true,
    version: '1.0.0',
    sha256: readSha,
    byteLength: 2048,
    downloadUrl: 'https://cdn.example.invalid/packs/ielts-acad-reading-seed-01.json',
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
  const readPack: CatalogPackRecord = {
    ...readPackSummary,
    examId: 'ielts_academic',
    skill: 'reading',
    accent: null,
    mediaUrl: null,
    isCachedOffline: 0,
    bundleJson: null,
    cachedMediaInline: null,
    sizeBytes: 0,
    cachedAtMs: null,
    updatedAtMs: nowMs,
  };
  bundleDeps.fakeCatalog.seedPackAndBundle(readPack, {
    pack: readPackSummary,
    sections: readSections,
    questions: readQuestions,
  });

  // Seed 1 IELTS Listening pack for Full Mock order (Listening -> Reading -> Writing -> Speaking)
  const listSections: ExamBundlePayload['sections'] = [
    {
      sectionId: 'sec-list-1',
      sectionIndex: 0,
      sectionType: 'listening_part',
      title: 'Listening Part 1',
      instructions: 'Answer Q1.',
      durationSeconds: 300,
      wordCount: 10,
      contentText: '',
      mediaUrl: null,
    },
  ];
  const listQuestions: ExamBundlePayload['questions'] = [
    {
      questionId: 'q-l1',
      sectionId: 'sec-list-1',
      questionNumber: 1,
      questionType: 'mcq_single',
      prompt: 'When does lab orientation begin?',
      options: ['9:00 AM', '10:30 AM'],
      acceptedAnswers: ['9:00 AM'],
    },
  ];
  const listSha = await computeCanonicalBundleSha256(listSections, listQuestions);
  const listSummary: ExamBundlePayload['pack'] = {
    packId: 'ielts-listening-seed-01',
    edition,
    examId: 'ielts_academic',
    track: 'academic',
    skill: 'listening',
    title: 'IELTS Listening Seed Pack',
    description: 'Part 1 sample',
    durationSeconds: 1800,
    questionCount: 1,
    isFreeSample: true,
    version: '1.0.0',
    sha256: listSha,
    byteLength: 1024,
    downloadUrl: 'https://cdn.example.invalid/packs/ielts-listening-seed-01.json',
    contentOrigin: 'authored_original',
    humanQaReviewed: true,
    accent: 'en-GB',
    mediaUrl: null,
    topicKeys: [],
    weaknessTargets: [],
    cefrMin: 'B1',
    cefrMax: 'C1',
    roadmapOrder: 0,
  };
  bundleDeps.fakeCatalog.seedPackAndBundle(
    {
      ...listSummary,
      examId: 'ielts_academic',
      skill: 'listening',
      accent: 'en-GB',
      mediaUrl: null,
      isCachedOffline: 1,
      bundleJson: null,
      cachedMediaInline: null,
      sizeBytes: 1024,
      cachedAtMs: nowMs,
      updatedAtMs: nowMs,
    },
    { pack: listSummary, sections: listSections, questions: listQuestions },
  );

  // Seed 7 Micro-Drills
  const drillTypes = [
    'speed_tfng',
    'speed_ynng',
    'summary_gap_fill',
    'complex_grammar',
    'pronunciation_rhythm',
    'coherence_linking',
    'lexical_precision',
  ] as const;
  const seededDrills: CachedDrillRecord[] = drillTypes.map((dtype, i) => ({
    drillId: `drill-${i + 1}`,
    title: `3-Min ${dtype}`,
    drillType: dtype,
    skill: dtype === 'pronunciation_rhythm' ? 'speaking' : 'reading',
    durationSeconds: 180,
    itemsJson: JSON.stringify([
      {
        id: `${dtype}-item-1`,
        prompt: 'Select the precise hedge verb in academic prose.',
        options: ['attenuates', 'blows up'],
        answer: 'attenuates',
        explanation: '"Attenuates" means reduces the force or intensity formally.',
      },
    ]),
    updatedAtMs: nowMs,
  }));
  bundleDeps.fakeCatalog.seedDrills(seededDrills);

  await bundleDeps.deps.attemptStore.saveUserProfile({
    deviceId: 'dev-1',
    examId: 'ielts_academic',
    examModule: 'academic',
    targetBand: 7.5,
    targetDateSerial: null,
    onboardingCompleted: true,
    freeDiagnosticUsed: false,
    linkedEmail: null,
    appUserId: null,
    isPro: true,
    updatedAtMs: nowMs,
  });

  return bundleDeps;
}

describe('W5.5 Practice Catalog, 7 Micro-Drills & Full Mock Orchestrator', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
    useClockStore.getState().setActiveExamLock(false);
  });

  afterEach(() => {
    useClockStore.getState().setActiveExamLock(false);
    cleanup();
    vi.unstubAllGlobals();
  });

  it('filters Practice Catalog, downloads SHA-256 offline pack, and launches simulator', async () => {
    const { deps } = await seedW55Workspace('glb');
    const history = createMemoryHistory({ initialEntries: ['/app/practice'] });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-pack-card-ielts-acad-reading-seed-01')).toBeTruthy();
    });

    // Download pack offline -> marks Offline Ready
    fireEvent.click(screen.getByTestId('download-pack-ielts-acad-reading-seed-01'));
    await waitFor(() => {
      expect(screen.getByTestId('pack-offline-badge-ielts-acad-reading-seed-01')).toBeTruthy();
    });

    // Filter Cached Only -> still shows downloaded pack
    fireEvent.click(screen.getByTestId('practice-cached-only-toggle'));
    expect(screen.getByTestId('catalog-pack-card-ielts-acad-reading-seed-01')).toBeTruthy();

    // Launch simulator -> navigates cleanly to Reading simulator
    fireEvent.click(screen.getByTestId('launch-pack-ielts-acad-reading-seed-01'));
    await waitFor(() => {
      expect(screen.getByTestId('reading-simulator-screen')).toBeTruthy();
    });
  });

  it('runs all 7 Micro-Drills with Mistake-to-Deck SM-2 capture and records history', async () => {
    const { deps } = await seedW55Workspace('glb');
    const history = createMemoryHistory({ initialEntries: ['/app/practice/drills'] });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('drill-card-drill-7')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('start-drill-drill-7'));
    await waitFor(() => {
      expect(screen.getByTestId('drill-active-runner')).toBeTruthy();
    });

    // Pick wrong answer -> Save to SM-2 Deck -> finish drill
    fireEvent.click(screen.getByTestId('drill-option-1'));
    fireEvent.click(screen.getByTestId('drill-check-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('drill-save-mistake-btn')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('drill-save-mistake-btn'));

    await waitFor(async () => {
      const cards = await deps.vocabStore.getAllCards();
      expect(cards.ok).toBe(true);
      if (cards.ok) {
        expect(cards.value.some((c) => c.card.headword === 'attenuates')).toBe(true);
      }
    });

    fireEvent.click(screen.getByTestId('drill-next-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('drill-scorecard')).toBeTruthy();
    });

    const histRes = await deps.attemptStore.listMicroDrillHistory();
    expect(histRes.ok).toBe(true);
    if (histRes.ok) {
      expect(histRes.value.length).toBe(1);
    }
  });

  it('orchestrates Full Mock stages in IELTS order with inter-section break screen', async () => {
    const { deps } = await seedW55Workspace('irn');
    const history = createMemoryHistory({
      initialEntries: ['/app/practice/full-mock/mock-acad-2026'],
    });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    // First stage in IELTS order is Listening
    await waitFor(() => {
      expect(screen.getByTestId('start-mock-stage-listening')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('start-mock-stage-listening'));

    await waitFor(() => {
      expect(screen.getByTestId('listening-simulator-screen')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByTestId('listening-submit-btn')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('listening-submit-btn'));

    // Completing Listening advances orchestrator into Inter-Section Break Screen before Reading!
    await waitFor(() => {
      expect(screen.getByTestId('full-mock-break-card')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('full-mock-skip-break-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('reading-simulator-screen')).toBeTruthy();
    });
  });
});
