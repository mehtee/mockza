// @vitest-environment jsdom
import 'fake-indexeddb/auto';
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
      expect(screen.getByTestId('home-two-pillars')).toBeTruthy();
    });

    // Navigate to Smart Coach Hub (/coach) and verify clear customer tool explanations
    fireEvent.click(screen.getByTestId('home-coach-hub-cta'));
    await waitFor(() => {
      expect(screen.getByTestId('coach-hub-screen')).toBeTruthy();
      expect(screen.getByTestId('coach-start-daily-cta')).toBeTruthy();
    });
    await router.navigate({ to: '/home' });
    await waitFor(() => {
      expect(screen.getByTestId('home-daily-mission-cta')).toBeTruthy();
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

  it('queues mission.complete in Dexie outbox when offline and hydrates cached mission offline', async () => {
    const { FakeLinguisticAdapter } = await import('@/adapters/fakes/fake-linguistic.adapter');
    const { HttpLinguisticAdapter } = await import('@/adapters/http/http-linguistic.adapter');
    const { MockzaDexieDb } = await import('@/adapters/dexie/mockza-db');
    const { DexieLinguisticCache } = await import('@/adapters/dexie/dexie-linguistic.adapter');
    const { DexieOutboxAdapter } = await import('@/adapters/dexie/dexie-outbox.adapter');

    const mem = new MockzaDexieDb(`closed_loop_offline_${Date.now()}`);
    const cache = new DexieLinguisticCache(mem);
    const fakeLing = new FakeLinguisticAdapter({ edition: 'irn' });
    const seededMission = await fakeLing.getTodayMission();
    expect(seededMission.ok).toBe(true);
    if (!seededMission.ok) return;
    await cache.cacheDailyMission(seededMission.value);

    const noopRes = async () => ({ ok: true as const, value: undefined });
    const offlineErr = { ok: false as const, error: { kind: 'network' as const, retryable: true, message: 'offline' } };
    const outbox = new DexieOutboxAdapter({
      db: mem,
      autoAttachOnlineListener: false,
      catalogMedia: {
        readUserRecordingBytes: async () => ({
          ok: false as const,
          error: { kind: 'storage' as const, message: 'unused' },
        }),
        updateRecordingRemoteKey: noopRes,
        deleteMediaBinary: async () => {},
      },
      transport: {
        enqueueWritingEvaluation: async () => offlineErr,
        presignAudioUpload: async () => offlineErr,
        enqueueSpeakingEvaluation: async () => offlineErr,
        flagQuestion: noopRes,
      },
    });

    const offlineClient = {
      get: async () => offlineErr,
      post: async () => offlineErr,
      request: async () => offlineErr,
    };

    const httpAdapter = new HttpLinguisticAdapter({
      apiClient: offlineClient as unknown as ConstructorParameters<typeof HttpLinguisticAdapter>[0]['apiClient'],
      edition: 'irn',
      cache,
      outbox,
    });

    const missionFallback = await httpAdapter.getTodayMission({ examTrack: 'ielts_academic' });
    expect(missionFallback.ok).toBe(true);
    if (missionFallback.ok) {
      expect(missionFallback.value.missionId).toBe(seededMission.value.missionId);
    }

    const seededDrop = await fakeLing.ingestDrop({ inputKind: 'text', examTrack: 'ielts_academic', rawText: 'Modern engineering teams combine structured feedback loops with deliberate practice.' });
    expect(seededDrop.ok).toBe(true);
    if (seededDrop.ok) {
      const dropPoll = await fakeLing.pollAdvancedJob<{ readonly dropId: string }>(seededDrop.value.jobId);
      if (dropPoll.ok && dropPoll.value.result) {
        const dropId = dropPoll.value.result.dropId;
        const dropItem = await fakeLing.getDropById(dropId);
        if (dropItem.ok) {
          await cache.cacheDropItem(dropItem.value);
          const offlineDrop = await httpAdapter.getDropById(dropId);
          expect(offlineDrop.ok).toBe(true);
          const offlineHistory = await httpAdapter.getDropHistory();
          expect(offlineHistory.ok && offlineHistory.value.items.length > 0).toBe(true);
        }
      }
    }

    const completeRes = await httpAdapter.completeMission(seededMission.value.missionId, {
      responseText: 'Had I known earlier, albeit difficult, I would have written more fluently.',
    });
    expect(completeRes.ok).toBe(false);
    const pending = await mem.syncOutbox.toArray();
    expect(pending.some((entry) => entry.actionType === 'mission.complete')).toBe(true);
    await mem.delete();
  });

  it('asks Exams vs Smart Coach screening in Onboarding and prioritizes Coach Hero on Home when selected', async () => {
    const deps = createTestDependencies({ edition: 'glb' });
    const history = createMemoryHistory({ initialEntries: ['/app/onboarding/goal'] });
    const router = createAppRouter(history);
    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('goal-study-focus-card')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('goal-focus-coach'));
    fireEvent.click(screen.getByTestId('goal-skip-home-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('home-daily-mission-card')).toBeTruthy();
      expect(screen.getByTestId('home-recommended-card')).toBeTruthy();
    });

    const coachEl = screen.getByTestId('home-daily-mission-card');
    const examEl = screen.getByTestId('home-recommended-card');
    expect(
      Boolean(coachEl.compareDocumentPosition(examEl) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
  });

  it('supports text-mode Register Shifter without microphone, zero SM-2 jargon, and study streak logging', async () => {
    const deps = createTestDependencies({ edition: 'glb' });
    const history = createMemoryHistory({ initialEntries: ['/app/register-shifter'] });
    const router = createAppRouter(history);
    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('register-shifter-screen')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('shifter-mode-text'));
    fireEvent.change(screen.getByTestId('shifter-text-input'), {
      target: {
        value: 'Today I watched a really good tech film and it was super interesting.',
      },
    });
    fireEvent.click(screen.getByTestId('shifter-submit-text-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('register-gear-ladder')).toBeTruthy();
    });
    expect(screen.queryByText(/SM-2/)).toBeNull();

    const saveButtons = screen.getAllByRole('button', { name: 'Save to Vocab Deck' });
    expect(saveButtons.length).toBeGreaterThan(0);
    fireEvent.click(saveButtons[0]!);
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Saved to Vocab Deck' }).length).toBeGreaterThan(0);
    });

    const logRes = await deps.attemptStore.getDailyStudyLog(deps.clock.todaySerialDay());
    expect(logRes.ok && (logRes.value?.studySeconds ?? 0) >= 120).toBe(true);
  });
});
