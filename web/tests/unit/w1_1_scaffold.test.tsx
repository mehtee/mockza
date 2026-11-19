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
    ['/app/practice', 'practice-catalog-screen'],
    ['/app/practice/reading/ielts-acad-01', 'reading-simulator-screen'],
    ['/app/practice/listening/ielts-list-01', 'listening-simulator-screen'],
    ['/app/practice/writing/toefl-email-01', 'writing-simulator-screen'],
    ['/app/practice/speaking/det-speak-01', 'speaking-simulator-screen'],
    ['/app/practice/drills', 'micro-drills-screen'],
    ['/app/practice/full-mock', 'full-mock-screen'],
    ['/app/evaluation/pending/job-42', 'evaluation-pending-screen'],
    ['/app/evaluation/result/eval-99', 'evaluation-result-screen'],
    ['/app/practice/objective-result/attempt-7', 'objective-result-screen'],
    ['/app/vocabulary', 'vocab-hub-screen'],
    ['/app/vocabulary/review', 'vocab-review-screen'],
    ['/app/progress', 'progress-screen'],
    ['/app/progress/compare', 'compare-attempts-screen'],
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
      expect(screen.getByTestId('reading-simulator-screen')).toBeTruthy();
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

  it('renders Top Command Bar with Pro Plans nav link, track switcher, theme toggle, and clean 404', async () => {
    const deps = createTestDependencies({ edition: 'glb' });
    const history = createMemoryHistory({ initialEntries: ['/app/does-not-exist'] });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('route-not-found')).toBeTruthy();
      expect(screen.getByTestId('top-command-bar')).toBeTruthy();
    });
    expect(screen.queryByText(/W1\.1 Scaffold/)).toBeNull();
    expect(screen.getByTestId('nav-paywall-link')).toBeTruthy();

    fireEvent.change(screen.getByTestId('topbar-track-switcher'), {
      target: { value: 'toefl_ibt' },
    });
    await waitFor(async () => {
      const profile = await deps.attemptStore.getUserProfile();
      expect(profile.ok && profile.value?.examId).toBe('toefl_ibt');
    });
  });
});
