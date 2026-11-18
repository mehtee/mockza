import { createMemoryHistory } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDependencies } from '@/composition/bootstrap-test';
import { DesktopSimulatorApp } from '@/spa/DesktopSimulatorApp';
import { MAPPED_ROUTE_CATALOG, createAppRouter } from '@/spa/router';
import { useAudioStore } from '@/spa/stores/audio.store';
import { useClockStore } from '@/spa/stores/clock.store';
import {
  DEFAULT_SPLIT_RATIO,
  MAX_SPLIT_RATIO,
  MIN_SPLIT_RATIO,
  clampSplitRatio,
  useLayoutStore,
} from '@/spa/stores/layout.store';
import {
  APPEARANCE_MODE_STORAGE_KEY,
  APPEARANCE_PRESET_STORAGE_KEY,
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_PRESET_ID,
  ZERO_FOUC_THEME_BOOT_SCRIPT,
  applyAndPersistAppearance,
  readStoredAppearance,
} from '@/theme/theme-controller';

describe('W1.1 theme-controller & zero-FOUC boot script', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset['theme'];
    delete document.documentElement.dataset['mode'];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns canonical defaults when localStorage is empty or invalid', () => {
    expect(readStoredAppearance()).toMatchObject({
      modePreference: DEFAULT_THEME_MODE,
      resolvedMode: 'dark',
      presetId: DEFAULT_THEME_PRESET_ID,
    });

    window.localStorage.setItem(APPEARANCE_PRESET_STORAGE_KEY, 'unknown_theme');
    window.localStorage.setItem(APPEARANCE_MODE_STORAGE_KEY, 'sepia');

    expect(readStoredAppearance()).toMatchObject({
      modePreference: DEFAULT_THEME_MODE,
      resolvedMode: 'dark',
      presetId: DEFAULT_THEME_PRESET_ID,
    });
  });

  it('persists valid presets and resolves system mode via matchMedia', () => {
    const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? false : true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.stubGlobal('matchMedia', matchMediaMock);

    const applied = applyAndPersistAppearance({
      presetId: 'nordic_emerald',
      modePreference: 'system',
    });

    expect(applied.presetId).toBe('nordic_emerald');
    expect(applied.modePreference).toBe('system');
    expect(applied.resolvedMode).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('nordic_emerald');
    expect(document.documentElement.dataset['mode']).toBe('light');
    expect(window.localStorage.getItem(APPEARANCE_PRESET_STORAGE_KEY)).toBe('nordic_emerald');
    expect(window.localStorage.getItem(APPEARANCE_MODE_STORAGE_KEY)).toBe('system');
  });

  it('executes ZERO_FOUC_THEME_BOOT_SCRIPT deterministically before paint', () => {
    window.localStorage.setItem(APPEARANCE_PRESET_STORAGE_KEY, 'editorial_amber');
    window.localStorage.setItem(APPEARANCE_MODE_STORAGE_KEY, 'light');

    // Execute the exact inline script string injected into BaseLayout <head>.
    const bootFn = new Function(ZERO_FOUC_THEME_BOOT_SCRIPT);
    bootFn();

    expect(document.documentElement.dataset['theme']).toBe('editorial_amber');
    expect(document.documentElement.dataset['mode']).toBe('light');
  });
});

describe('W1.1 Zustand stores', () => {
  beforeEach(() => {
    useClockStore.getState().resetClock();
    useAudioStore.getState().resetAudio();
    useLayoutStore.setState({
      sidebarCollapsed: false,
      splitPaneRatios: {},
      shortcutLegendOpen: false,
    });
  });

  it('manages exam countdown and activeExamLock in clock store', () => {
    useClockStore.getState().startSessionTimer(120, 'Reading Pack 01');
    expect(useClockStore.getState().activeExamLock).toBe(true);
    expect(useClockStore.getState().remainingSeconds).toBe(120);

    useClockStore.getState().tickSecond();
    expect(useClockStore.getState().remainingSeconds).toBe(119);

    useClockStore.getState().pauseTimer();
    useClockStore.getState().tickSecond();
    expect(useClockStore.getState().remainingSeconds).toBe(119);

    useClockStore.getState().resetClock();
    expect(useClockStore.getState().activeExamLock).toBe(false);
  });

  it('enforces 1.0x speed lock in exam_linear_locked audio mode', () => {
    useAudioStore.getState().setPlaybackState({ playbackRate: 1.5 });
    expect(useAudioStore.getState().playbackRate).toBe(1);

    useAudioStore.getState().setPlaybackMode('study_interactive');
    useAudioStore.getState().setPlaybackState({ playbackRate: 1.5 });
    expect(useAudioStore.getState().playbackRate).toBe(1.5);

    useAudioStore.getState().setRecordingState({ isRecording: true, micLevelRms: 1.8 });
    expect(useAudioStore.getState().micLevelRms).toBe(1);
  });

  it('clamps split pane ratios between 40 and 65', () => {
    expect(clampSplitRatio(10)).toBe(MIN_SPLIT_RATIO);
    expect(clampSplitRatio(90)).toBe(MAX_SPLIT_RATIO);
    expect(clampSplitRatio(Number.NaN)).toBe(DEFAULT_SPLIT_RATIO);

    useLayoutStore.getState().setSplitPaneRatio('reading', 72);
    expect(useLayoutStore.getState().getSplitPaneRatio('reading')).toBe(65);

    useLayoutStore.getState().toggleSidebar();
    expect(useLayoutStore.getState().sidebarCollapsed).toBe(true);
  });
});

describe('W1.1 TanStack Router 24-route skeleton & blocker', () => {
  beforeEach(() => {
    useClockStore.getState().resetClock();
    useLayoutStore.setState({
      sidebarCollapsed: false,
      splitPaneRatios: {},
      shortcutLegendOpen: false,
    });
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('catalogs all 24 mapped routes from DESKTOP_WEB_PLAN.md', () => {
    expect(MAPPED_ROUTE_CATALOG).toHaveLength(24);
    const spaRoutes = MAPPED_ROUTE_CATALOG.filter(
      (route) => route.renderingMode !== 'static_astro',
    );
    expect(spaRoutes).toHaveLength(23);
  });

  it.each([
    ['/app/welcome', 'welcome-screen'],
    ['/app/onboarding/goal', 'goal-setup-screen'],
    ['/app/diagnostic/intro', 'diagnostic-intro-screen'],
    ['/app/diagnostic/session', 'diagnostic-session-screen'],
    ['/app/diagnostic/result', 'diagnostic-result-screen'],
    ['/app/auth/login', 'auth-screen'],
    ['/app/home', 'home-screen'],
    ['/app/practice', 'route-skeleton-practice'],
    ['/app/practice/reading/ielts-acad-01', 'route-skeleton-practice-reading'],
    ['/app/practice/listening/ielts-list-01', 'route-skeleton-practice-listening'],
    ['/app/practice/writing/toefl-email-01', 'route-skeleton-practice-writing'],
    ['/app/practice/speaking/det-speak-01', 'route-skeleton-practice-speaking'],
    ['/app/practice/drills', 'route-skeleton-practice-drills'],
    ['/app/practice/full-mock', 'route-skeleton-practice-full-mock'],
    ['/app/evaluation/pending/job-42', 'route-skeleton-evaluation-pending'],
    ['/app/evaluation/result/eval-99', 'route-skeleton-evaluation-result'],
    ['/app/practice/objective-result/attempt-7', 'route-skeleton-objective-result'],
    ['/app/vocabulary', 'route-skeleton-vocabulary'],
    ['/app/vocabulary/review', 'route-skeleton-vocabulary-review'],
    ['/app/progress', 'route-skeleton-progress'],
    ['/app/progress/compare', 'route-skeleton-progress-compare'],
    ['/app/settings', 'settings-screen'],
    ['/app/paywall', 'paywall-screen'],
  ])('renders %s (%s)', async (initialPath, expectedTestId) => {
    const history = createMemoryHistory({ initialEntries: [initialPath] });
    const router = createAppRouter(history);

    render(
      <DesktopSimulatorApp
        router={router}
        dependencies={createTestDependencies({ edition: 'glb' })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(expectedTestId)).toBeTruthy();
    });
  });

  it('blocks navigation during active exam lock until confirmed', async () => {
    useClockStore.getState().setActiveExamLock(true, 'IELTS Academic Reading');
    const history = createMemoryHistory({
      initialEntries: ['/app/practice/reading/pack-123'],
    });
    const router = createAppRouter(history);

    render(
      <DesktopSimulatorApp
        router={router}
        dependencies={createTestDependencies({ edition: 'glb' })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('route-skeleton-practice-reading')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('link', { name: 'Home' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Leave Session' }));

    await waitFor(() => {
      expect(screen.getByTestId('home-screen')).toBeTruthy();
    });
    expect(useClockStore.getState().activeExamLock).toBe(false);
  });
});
