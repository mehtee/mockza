import {
  EXAM_TRACK_SPECS,
  SUPPORTED_EXAM_IDS,
  normalizeSupportedExamId,
  type DiagnosticSkill,
  type SupportedExamId,
} from '@mockza/domain';
import {
  Link,
  Navigate,
  Outlet,
  type RouterHistory,
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  useBlocker,
  useRouterState,
} from '@tanstack/react-router';
import {
  BookOpen,
  Calendar,
  Home,
  Layers,
  LogIn,
  Menu,
  Moon,
  RefreshCw,
  Settings,
  Sparkles,
  Sun,
  TrendingUp,
  WifiOff,
  X,
} from 'lucide-react';
import {
  type ComponentType,
  type ReactNode,
  Suspense,
  createElement,
  lazy,
  useEffect,
  useState,
} from 'react';
import {
  getActiveEditionCode,
  getEditionConfig,
} from '@/edition/edition-config';
import { formatChromeNumber } from '@/edition/bidi/numerals';
import { createTranslator } from '@/i18n';
import { useOptionalDeps } from '@/spa/deps';
import {
  notifyTrackChanged,
  readSwrTrack,
  subscribeTrackChanged,
  writeSwrTrack,
} from '@/spa/swr-cache';
import { useClockStore } from '@/spa/stores/clock.store';
import { useLayoutStore } from '@/spa/stores/layout.store';
import {
  applyAndPersistAppearance,
  readStoredAppearance,
  type ThemeMode,
} from '@/theme/theme-controller';

type AnyScreenFn = (props: never) => ReactNode;

type InferScreenProps<T extends AnyScreenFn> =
  Parameters<T> extends []
    ? Record<string, never>
    : NonNullable<Parameters<T>[0]> & object;

interface PreloadableScreenHandle<T extends AnyScreenFn> {
  readonly Component: (props: InferScreenProps<T>) => ReactNode;
  readonly preload: () => Promise<void>;
}

/**
 * Wraps a dynamically imported screen so that once preloaded (at boot or link hover),
 * it renders synchronously without suspending and avoids React 19's 300ms Suspense
 * fallback throttle.
 */
function createPreloadableScreen<T extends AnyScreenFn>(
  loader: () => Promise<{ readonly default: T }>,
): PreloadableScreenHandle<T> {
  let Resolved: ComponentType<InferScreenProps<T>> | null = null;
  let pending: Promise<{ readonly default: ComponentType<InferScreenProps<T>> }> | null = null;

  const load = (): Promise<{ readonly default: ComponentType<InferScreenProps<T>> }> => {
    if (!pending) {
      pending = loader()
        .then((mod) => {
          const comp = mod.default as unknown as ComponentType<InferScreenProps<T>>;
          Resolved = comp;
          return { default: comp };
        })
        .catch((err: unknown) => {
          pending = null;
          throw err;
        });
    }
    return pending;
  };

  const LazyScreen = lazy(load);

  function PreloadableScreen(props: InferScreenProps<T>): ReactNode {
    if (Resolved) {
      return createElement(Resolved, props);
    }
    return createElement(LazyScreen, props);
  }

  return {
    Component: PreloadableScreen,
    preload: () => load().then(() => undefined).catch(() => undefined),
  };
}

const authScreen = createPreloadableScreen(() =>
  import('@/spa/features/auth/AuthScreen').then((m) => ({ default: m.AuthScreen })),
);
const diagnosticIntroScreen = createPreloadableScreen(() =>
  import('@/spa/features/diagnostic/DiagnosticIntroScreen').then((m) => ({
    default: m.DiagnosticIntroScreen,
  })),
);
const diagnosticResultScreen = createPreloadableScreen(() =>
  import('@/spa/features/diagnostic/DiagnosticResultScreen').then((m) => ({
    default: m.DiagnosticResultScreen,
  })),
);
const diagnosticSessionScreen = createPreloadableScreen(() =>
  import('@/spa/features/diagnostic/DiagnosticSessionScreen').then((m) => ({
    default: m.DiagnosticSessionScreen,
  })),
);
const homeScreen = createPreloadableScreen(() =>
  import('@/spa/features/home/HomeScreen').then((m) => ({ default: m.HomeScreen })),
);
const goalSetupScreen = createPreloadableScreen(() =>
  import('@/spa/features/onboarding/GoalSetupScreen').then((m) => ({
    default: m.GoalSetupScreen,
  })),
);
const welcomeScreen = createPreloadableScreen(() =>
  import('@/spa/features/onboarding/WelcomeScreen').then((m) => ({ default: m.WelcomeScreen })),
);
const paywallScreen = createPreloadableScreen(() =>
  import('@/spa/features/paywall/PaywallScreen').then((m) => ({ default: m.PaywallScreen })),
);
const fullMockOrchestratorScreen = createPreloadableScreen(() =>
  import('@/spa/features/practice/FullMockOrchestratorScreen').then((m) => ({
    default: m.FullMockOrchestratorScreen,
  })),
);
const listeningSimulatorScreen = createPreloadableScreen(() =>
  import('@/spa/features/practice/ListeningSimulatorScreen').then((m) => ({
    default: m.ListeningSimulatorScreen,
  })),
);
const microDrillsScreen = createPreloadableScreen(() =>
  import('@/spa/features/practice/MicroDrillsScreen').then((m) => ({
    default: m.MicroDrillsScreen,
  })),
);
const practiceCatalogScreen = createPreloadableScreen(() =>
  import('@/spa/features/practice/PracticeCatalogScreen').then((m) => ({
    default: m.PracticeCatalogScreen,
  })),
);
const readingSimulatorScreen = createPreloadableScreen(() =>
  import('@/spa/features/practice/ReadingSimulatorScreen').then((m) => ({
    default: m.ReadingSimulatorScreen,
  })),
);
const speakingSimulatorScreen = createPreloadableScreen(() =>
  import('@/spa/features/practice/SpeakingSimulatorScreen').then((m) => ({
    default: m.SpeakingSimulatorScreen,
  })),
);
const writingSimulatorScreen = createPreloadableScreen(() =>
  import('@/spa/features/practice/WritingSimulatorScreen').then((m) => ({
    default: m.WritingSimulatorScreen,
  })),
);
const compareAttemptsScreen = createPreloadableScreen(() =>
  import('@/spa/features/progress/CompareAttemptsScreen').then((m) => ({
    default: m.CompareAttemptsScreen,
  })),
);
const progressScreen = createPreloadableScreen(() =>
  import('@/spa/features/progress/ProgressScreen').then((m) => ({ default: m.ProgressScreen })),
);
const evaluationPendingScreen = createPreloadableScreen(() =>
  import('@/spa/features/results/EvaluationPendingScreen').then((m) => ({
    default: m.EvaluationPendingScreen,
  })),
);
const evaluationResultScreen = createPreloadableScreen(() =>
  import('@/spa/features/results/EvaluationResultScreen').then((m) => ({
    default: m.EvaluationResultScreen,
  })),
);
const objectiveResultScreen = createPreloadableScreen(() =>
  import('@/spa/features/results/ObjectiveResultScreen').then((m) => ({
    default: m.ObjectiveResultScreen,
  })),
);
const settingsScreen = createPreloadableScreen(() =>
  import('@/spa/features/settings/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
);
const vocabHubScreen = createPreloadableScreen(() =>
  import('@/spa/features/vocabulary/VocabHubScreen').then((m) => ({ default: m.VocabHubScreen })),
);
const vocabReviewScreen = createPreloadableScreen(() =>
  import('@/spa/features/vocabulary/VocabReviewScreen').then((m) => ({
    default: m.VocabReviewScreen,
  })),
);
const vocabWordDetailScreen = createPreloadableScreen(() =>
  import('@/spa/features/vocabulary/VocabWordDetailScreen').then((m) => ({
    default: m.VocabWordDetailScreen,
  })),
);

const AuthScreen = authScreen.Component;
const DiagnosticIntroScreen = diagnosticIntroScreen.Component;
const DiagnosticResultScreen = diagnosticResultScreen.Component;
const DiagnosticSessionScreen = diagnosticSessionScreen.Component;
const HomeScreen = homeScreen.Component;
const GoalSetupScreen = goalSetupScreen.Component;
const WelcomeScreen = welcomeScreen.Component;
const PaywallScreen = paywallScreen.Component;
const FullMockOrchestratorScreen = fullMockOrchestratorScreen.Component;
const ListeningSimulatorScreen = listeningSimulatorScreen.Component;
const MicroDrillsScreen = microDrillsScreen.Component;
const PracticeCatalogScreen = practiceCatalogScreen.Component;
const ReadingSimulatorScreen = readingSimulatorScreen.Component;
const SpeakingSimulatorScreen = speakingSimulatorScreen.Component;
const WritingSimulatorScreen = writingSimulatorScreen.Component;
const CompareAttemptsScreen = compareAttemptsScreen.Component;
const ProgressScreen = progressScreen.Component;
const EvaluationPendingScreen = evaluationPendingScreen.Component;
const EvaluationResultScreen = evaluationResultScreen.Component;
const ObjectiveResultScreen = objectiveResultScreen.Component;
const SettingsScreen = settingsScreen.Component;
const VocabHubScreen = vocabHubScreen.Component;
const VocabReviewScreen = vocabReviewScreen.Component;
const VocabWordDetailScreen = vocabWordDetailScreen.Component;

export function preloadRouteForPathname(pathname: string): Promise<void> {
  const normalized = pathname.replace(/^\/app(?=\/|$)/, '').replace(/\/+$/, '') || '/home';
  if (normalized === '/' || normalized === '/home') return homeScreen.preload();
  if (normalized === '/practice') return practiceCatalogScreen.preload();
  if (normalized === '/practice/drills') return microDrillsScreen.preload();
  if (normalized.startsWith('/practice/full-mock')) return fullMockOrchestratorScreen.preload();
  if (normalized.startsWith('/practice/reading/')) return readingSimulatorScreen.preload();
  if (normalized.startsWith('/practice/listening/')) return listeningSimulatorScreen.preload();
  if (normalized.startsWith('/practice/writing/')) return writingSimulatorScreen.preload();
  if (normalized.startsWith('/practice/speaking/')) return speakingSimulatorScreen.preload();
  if (normalized.startsWith('/practice/objective-result/')) return objectiveResultScreen.preload();
  if (normalized.startsWith('/evaluation/pending/')) return evaluationPendingScreen.preload();
  if (normalized.startsWith('/evaluation/result/')) return evaluationResultScreen.preload();
  if (normalized === '/vocabulary') return vocabHubScreen.preload();
  if (normalized === '/vocabulary/review') return vocabReviewScreen.preload();
  if (normalized.startsWith('/vocabulary/word/')) return vocabWordDetailScreen.preload();
  if (normalized === '/progress') return progressScreen.preload();
  if (normalized === '/progress/compare') return compareAttemptsScreen.preload();
  if (normalized === '/settings') return settingsScreen.preload();
  if (normalized === '/paywall') return paywallScreen.preload();
  if (normalized === '/welcome') return welcomeScreen.preload();
  if (normalized === '/onboarding/goal') return goalSetupScreen.preload();
  if (normalized === '/auth/login') return authScreen.preload();
  if (normalized === '/diagnostic/intro') return diagnosticIntroScreen.preload();
  if (normalized === '/diagnostic/session') return diagnosticSessionScreen.preload();
  if (normalized === '/diagnostic/result') return diagnosticResultScreen.preload();
  return Promise.resolve();
}

export function prefetchOfflineSimulatorChunks(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return Promise.resolve();
  }
  return Promise.allSettled([
    homeScreen.preload(),
    practiceCatalogScreen.preload(),
    readingSimulatorScreen.preload(),
    listeningSimulatorScreen.preload(),
    writingSimulatorScreen.preload(),
    speakingSimulatorScreen.preload(),
    objectiveResultScreen.preload(),
    progressScreen.preload(),
  ]).then(() => undefined);
}

export interface MappedRouteDescriptor {
  readonly id: number;
  readonly flutterRoute: string;
  readonly webPath: string;
  readonly title: string;
  readonly renderingMode: 'static_astro_and_spa' | 'react_spa' | 'static_astro';
}

export const MAPPED_ROUTE_CATALOG: readonly MappedRouteDescriptor[] = [
  {
    id: 1,
    flutterRoute: 'Routes.welcome (/welcome)',
    webPath: '/app/welcome',
    title: 'Welcome',
    renderingMode: 'static_astro_and_spa',
  },
  {
    id: 2,
    flutterRoute: 'Routes.goalSetup (/onboarding/goal)',
    webPath: '/app/onboarding/goal',
    title: 'Goal Setup',
    renderingMode: 'react_spa',
  },
  {
    id: 3,
    flutterRoute: 'Routes.diagnosticIntro (/diagnostic/intro)',
    webPath: '/app/diagnostic/intro',
    title: 'Diagnostic Preflight',
    renderingMode: 'react_spa',
  },
  {
    id: 4,
    flutterRoute: 'Routes.diagnosticSession (/diagnostic/session)',
    webPath: '/app/diagnostic/session',
    title: 'Diagnostic Session',
    renderingMode: 'react_spa',
  },
  {
    id: 5,
    flutterRoute: 'Routes.diagnosticResult (/diagnostic/result)',
    webPath: '/app/diagnostic/result',
    title: 'Diagnostic Result',
    renderingMode: 'react_spa',
  },
  {
    id: 6,
    flutterRoute: 'Routes.login (/auth/login)',
    webPath: '/app/auth/login',
    title: 'Sign In',
    renderingMode: 'react_spa',
  },
  {
    id: 7,
    flutterRoute: 'Routes.home (/home)',
    webPath: '/app/home',
    title: 'Desktop Home',
    renderingMode: 'react_spa',
  },
  {
    id: 8,
    flutterRoute: 'Routes.practice (/practice)',
    webPath: '/app/practice',
    title: 'Practice Catalog',
    renderingMode: 'react_spa',
  },
  {
    id: 9,
    flutterRoute: 'Routes.readingSession (/practice/reading/:packId)',
    webPath: '/app/practice/reading/$packId',
    title: 'Reading Simulator',
    renderingMode: 'react_spa',
  },
  {
    id: 10,
    flutterRoute: 'Routes.listeningSession (/practice/listening/:packId)',
    webPath: '/app/practice/listening/$packId',
    title: 'Listening Simulator',
    renderingMode: 'react_spa',
  },
  {
    id: 11,
    flutterRoute: 'Routes.writingSession (/practice/writing/:packId)',
    webPath: '/app/practice/writing/$packId',
    title: 'Writing Simulator',
    renderingMode: 'react_spa',
  },
  {
    id: 12,
    flutterRoute: 'Routes.speakingSession (/practice/speaking/:packId)',
    webPath: '/app/practice/speaking/$packId',
    title: 'Speaking Simulator',
    renderingMode: 'react_spa',
  },
  {
    id: 13,
    flutterRoute: 'Routes.microDrills (/practice/drills)',
    webPath: '/app/practice/drills',
    title: 'Micro-Drills',
    renderingMode: 'react_spa',
  },
  {
    id: 14,
    flutterRoute: 'Routes.fullMock (/practice/full-mock)',
    webPath: '/app/practice/full-mock',
    title: 'Full Mock Orchestrator',
    renderingMode: 'react_spa',
  },
  {
    id: 15,
    flutterRoute: 'Routes.evaluationPending (/evaluation/pending/:jobId)',
    webPath: '/app/evaluation/pending/$jobId',
    title: 'Evaluation Pending',
    renderingMode: 'react_spa',
  },
  {
    id: 16,
    flutterRoute: 'Routes.evaluationResult (/evaluation/result/:id)',
    webPath: '/app/evaluation/result/$id',
    title: 'Evaluation Review',
    renderingMode: 'react_spa',
  },
  {
    id: 17,
    flutterRoute: 'Routes.objectiveResult (/practice/objective-result/:attemptId)',
    webPath: '/app/practice/objective-result/$attemptId',
    title: 'Objective Result Review',
    renderingMode: 'react_spa',
  },
  {
    id: 18,
    flutterRoute: 'Routes.vocabulary (/vocabulary)',
    webPath: '/app/vocabulary',
    title: 'Vocabulary Hub',
    renderingMode: 'react_spa',
  },
  {
    id: 19,
    flutterRoute: 'Routes.vocabReview (/vocabulary/review)',
    webPath: '/app/vocabulary/review',
    title: 'SM-2 Vocabulary Review',
    renderingMode: 'react_spa',
  },
  {
    id: 20,
    flutterRoute: 'Routes.progress (/progress)',
    webPath: '/app/progress',
    title: 'Progress Analytics',
    renderingMode: 'react_spa',
  },
  {
    id: 21,
    flutterRoute: 'Routes.compareAttempts (/progress/compare)',
    webPath: '/app/progress/compare',
    title: 'Compare Attempts',
    renderingMode: 'react_spa',
  },
  {
    id: 22,
    flutterRoute: 'Routes.settings (/settings)',
    webPath: '/app/settings',
    title: 'Settings',
    renderingMode: 'react_spa',
  },
  {
    id: 23,
    flutterRoute: 'Routes.paywall (/paywall)',
    webPath: '/app/paywall',
    title: 'Pro Plans & Paywall',
    renderingMode: 'react_spa',
  },
  {
    id: 24,
    flutterRoute: 'Public SEO/GEO Routes',
    webPath: '/',
    title: 'Public Landing & Guides',
    renderingMode: 'static_astro',
  },
] as const;

function NotFoundView() {
  const deps = useOptionalDeps();
  const edition = deps?.edition ?? getActiveEditionCode();
  const t = createTranslator(edition);
  return (
    <section
      data-testid="route-not-found"
      className="mx-auto my-8 max-w-xl rounded-[var(--mz-radius-card)] border border-border-subtle bg-surface p-6 text-start"
    >
      <h1 className="text-2xl font-bold text-text-primary">{t('notFoundTitle')}</h1>
      <p className="mt-2 text-sm text-text-secondary">{t('notFoundDescription')}</p>
      <Link
        to="/home"
        className="mt-5 inline-flex h-9 items-center rounded-[var(--mz-radius-control)] bg-primary px-4 text-xs font-semibold text-on-primary hover:bg-primary-pressed"
      >
        {t('notFoundBackHomeAction')}
      </Link>
    </section>
  );
}

const ACTIVE_SIMULATOR_RE =
  /^(\/app)?\/(diagnostic\/session|practice\/(reading|listening|writing|speaking)\/)/;

function parseTrackSearchParam(search: Record<string, unknown>): { track?: SupportedExamId } {
  const raw = search['track'];
  if (typeof raw !== 'string') return {};
  const trimmed = raw.trim();
  if ((SUPPORTED_EXAM_IDS as readonly string[]).includes(trimmed)) {
    return { track: normalizeSupportedExamId(trimmed) };
  }
  return {};
}

function AppRootLayout() {
  const deps = useOptionalDeps();
  const edition = deps?.edition ?? getActiveEditionCode();
  const dir = getEditionConfig(edition).dir;
  const t = createTranslator(edition);
  const activeSessionLabel = useClockStore((state) => state.activeSessionLabel);
  const setActiveExamLock = useClockStore((state) => state.setActiveExamLock);
  const sidebarCollapsed = useLayoutStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useLayoutStore((state) => state.toggleSidebar);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActiveSimulator = ACTIVE_SIMULATOR_RE.test(pathname);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTrack, setActiveTrack] = useState<SupportedExamId>(
    () => readSwrTrack(edition) ?? 'ielts_academic',
  );
  const [targetDateSerial, setTargetDateSerial] = useState<number | null>(null);
  const [pendingOutboxCount, setPendingOutboxCount] = useState(0);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [resolvedMode, setResolvedMode] = useState<ThemeMode>(
    () => readStoredAppearance().resolvedMode,
  );

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    return subscribeTrackChanged((nextTrack) => {
      setActiveTrack(nextTrack);
    });
  }, []);

  useEffect(() => {
    if (!deps) return;
    let mounted = true;
    void deps.attemptStore.getUserProfile().then((res) => {
      if (!mounted || !res.ok || !res.value) return;
      if (res.value.examId) {
        const normalized = normalizeSupportedExamId(res.value.examId);
        setActiveTrack(normalized);
        writeSwrTrack(edition, normalized);
      }
      setTargetDateSerial(res.value.targetDateSerial ?? null);
    });
    const unsubOutbox = deps.syncOutbox.observePendingCount((count) => {
      setPendingOutboxCount(count);
    });
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      mounted = false;
      unsubOutbox();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [deps, edition, pathname]);

  const handleTrackSwitch = async (nextTrack: SupportedExamId) => {
    setActiveTrack(nextTrack);
    notifyTrackChanged(edition, nextTrack);
    if (!deps) return;
    const [profileRes, idRes] = await Promise.all([
      deps.attemptStore.getUserProfile(),
      deps.auth.getDeviceIdentity(),
    ]);
    const existing = profileRes.ok ? profileRes.value : null;
    await deps.attemptStore.saveUserProfile({
      deviceId: existing?.deviceId ?? (idRes.ok ? idRes.value.deviceInstallId : 'web-device'),
      examId: nextTrack,
      examModule: nextTrack === 'ielts_general' ? 'general_training' : 'academic',
      targetBand: existing?.targetBand ?? EXAM_TRACK_SPECS[nextTrack].targetScoreDefault,
      targetDateSerial: existing?.targetDateSerial ?? null,
      onboardingCompleted: existing?.onboardingCompleted ?? true,
      freeDiagnosticUsed: existing?.freeDiagnosticUsed ?? false,
      linkedEmail: existing?.linkedEmail ?? null,
      appUserId: existing?.appUserId ?? null,
      isPro: existing?.isPro ?? false,
      updatedAtMs: deps.clock.nowMs(),
    });
  };

  const handleToggleTheme = () => {
    const nextMode: ThemeMode = resolvedMode === 'dark' ? 'light' : 'dark';
    const nextState = applyAndPersistAppearance({ modePreference: nextMode });
    setResolvedMode(nextState.resolvedMode);
  };

  const todaySerial = deps?.clock.todaySerialDay() ?? null;
  const daysUntilExam =
    todaySerial !== null && targetDateSerial !== null
      ? Math.max(0, targetDateSerial - todaySerial)
      : null;

  const blocker = useBlocker({
    shouldBlockFn: () => useClockStore.getState().activeExamLock,
    enableBeforeUnload: () => useClockStore.getState().activeExamLock,
    withResolver: true,
  });

  const navItems = [
    { to: '/home' as const, label: t('navHome'), Icon: Home, testId: 'nav-home-link' },
    { to: '/practice' as const, label: t('navPractice'), Icon: BookOpen, testId: 'nav-practice-link' },
    { to: '/vocabulary' as const, label: t('navVocabulary'), Icon: Layers, testId: 'nav-vocab-link' },
    { to: '/progress' as const, label: t('navProgress'), Icon: TrendingUp, testId: 'nav-progress-link' },
    { to: '/paywall' as const, label: t('navProPlans'), Icon: Sparkles, testId: 'nav-paywall-link' },
    { to: '/settings' as const, label: t('navSettings'), Icon: Settings, testId: 'nav-settings-link' },
  ];

  return (
    <div
      dir={dir}
      className={
        isActiveSimulator
          ? 'flex h-dvh w-screen overflow-hidden bg-canvas text-text-primary'
          : 'flex min-h-dvh bg-canvas text-text-primary'
      }
    >
      {isActiveSimulator ? (
        <nav aria-label={t('navAriaLabel')} className="sr-only">
          <Link to="/home" aria-label={t('navHome')}>
            {t('navHome')}
          </Link>
        </nav>
      ) : (
        <>
          {mobileMenuOpen ? (
            <button
              type="button"
              aria-label={t('navCloseMenuLabel')}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-30 bg-[var(--mz-scrim-barrier)] lg:hidden"
            />
          ) : null}

          <aside
            aria-label={t('navAriaLabel')}
            className={`fixed inset-y-0 start-0 z-40 flex shrink-0 flex-col border-e border-border-subtle bg-bg-raised p-4 transition-all lg:static ${
              mobileMenuOpen ? 'flex' : 'hidden lg:flex'
            } ${sidebarCollapsed ? 'w-16 items-center px-2' : 'w-60'}`}
          >
            <div className="flex w-full items-center justify-between gap-2 border-b border-border-subtle pb-3">
              {sidebarCollapsed ? (
                <a href="/" className="mx-auto text-sm font-bold text-primary" title={t('appTitle')}>
                  {t('brandShort')}
                </a>
              ) : (
                <a href="/" className="text-sm font-bold text-text-primary">
                  {t('appTitle')}
                </a>
              )}
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label={sidebarCollapsed ? t('navExpandLabel') : t('navCollapseLabel')}
                aria-expanded={!sidebarCollapsed}
                className="hidden lg:inline-flex items-center justify-center rounded-[var(--mz-radius-compact)] border border-border-subtle p-1.5 text-text-secondary hover:bg-surface-hover"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  className={`h-4 w-4 transition-transform ${
                    sidebarCollapsed ? 'rotate-0 rtl:rotate-180' : 'rotate-180 rtl:rotate-0'
                  }`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 4.5 13 10l-5.5 5.5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label={t('navCloseMenuLabel')}
                className="inline-flex items-center justify-center rounded-[var(--mz-radius-compact)] border border-border-subtle p-1.5 text-text-secondary hover:bg-surface-hover lg:hidden"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <nav className="mt-4 flex w-full flex-col gap-1 text-sm text-start">
              {navItems.map(({ to, label, Icon, testId }) => (
                <Link
                  key={to}
                  to={to}
                  aria-label={label}
                  data-testid={testId}
                  onMouseEnter={() => void preloadRouteForPathname(to)}
                  onFocus={() => void preloadRouteForPathname(to)}
                  className={`flex items-center gap-2.5 rounded-[var(--mz-radius-compact)] px-3 py-2 text-text-secondary hover:bg-surface-hover hover:text-text-primary ${
                    sidebarCollapsed ? 'justify-center px-2' : ''
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {!sidebarCollapsed ? <span>{label}</span> : null}
                </Link>
              ))}
              <Link
                to="/auth/login"
                aria-label={t('authSignInAction')}
                data-testid="nav-auth-link"
                onMouseEnter={() => void preloadRouteForPathname('/auth/login')}
                onFocus={() => void preloadRouteForPathname('/auth/login')}
                className={`mt-2 flex items-center gap-2.5 rounded-[var(--mz-radius-compact)] border border-border-subtle px-3 py-2 text-text-secondary hover:bg-surface-hover hover:text-text-primary ${
                  sidebarCollapsed ? 'justify-center px-2' : ''
                }`}
              >
                <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
                {!sidebarCollapsed ? <span>{t('authSignInAction')}</span> : null}
              </Link>
            </nav>
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {!isActiveSimulator ? (
          <header
            data-testid="top-command-bar"
            className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-bg-raised px-4 py-2.5 sm:px-6"
          >
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                data-testid="topbar-mobile-nav-btn"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                aria-label={t('navOpenMenuLabel')}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--mz-radius-compact)] border border-border-subtle text-text-secondary hover:bg-surface-hover lg:hidden"
              >
                <Menu className="h-4 w-4" aria-hidden="true" />
              </button>

              <select
                aria-label={t('settingsExamTrackSection')}
                data-testid="topbar-track-switcher"
                value={activeTrack}
                onChange={(e) => void handleTrackSwitch(normalizeSupportedExamId(e.target.value))}
                className="h-8 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-surface px-2.5 text-xs font-semibold text-text-primary"
              >
                {SUPPORTED_EXAM_IDS.map((trackId) => (
                  <option key={trackId} value={trackId}>
                    {EXAM_TRACK_SPECS[trackId].displayName}
                  </option>
                ))}
              </select>

              {daysUntilExam !== null ? (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-[var(--mz-radius-pill)] border border-border-subtle bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary">
                  <Calendar className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  <span>
                    {t('topBarDaysLeftLabel', {
                      days: formatChromeNumber(daysUntilExam, edition),
                    })}
                  </span>
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <span
                data-testid="topbar-sync-status"
                className={`inline-flex items-center gap-1.5 rounded-[var(--mz-radius-pill)] border px-2.5 py-1 text-xs font-medium ${
                  !isOnline
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                    : pendingOutboxCount > 0
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border-subtle bg-surface text-text-secondary'
                }`}
              >
                {!isOnline ? (
                  <>
                    <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t('topBarOfflineBadge')}</span>
                  </>
                ) : pendingOutboxCount > 0 ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {t('topBarPendingOutboxBadge', {
                        count: formatChromeNumber(pendingOutboxCount, edition),
                      })}
                    </span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                    <span>{t('topBarOnlineBadge')}</span>
                  </>
                )}
              </span>

              <button
                type="button"
                data-testid="topbar-theme-toggle"
                onClick={handleToggleTheme}
                aria-label={t('topBarThemeToggleLabel')}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--mz-radius-compact)] border border-border-subtle bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              >
                {resolvedMode === 'dark' ? (
                  <Sun className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Moon className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </header>
        ) : null}

        <main
          className={
            isActiveSimulator
              ? 'h-full w-full flex-1 overflow-hidden'
              : 'mx-auto w-full max-w-[1440px] flex-1 p-6'
          }
        >
          <Suspense
            fallback={
              <div
                aria-busy="true"
                className="mx-auto flex max-w-6xl animate-pulse flex-col gap-5 pb-10"
              >
                <span className="sr-only">{t('workspaceLoadingLabel')}</span>
                <div className="h-16 rounded-[var(--mz-radius-card)] border border-border-subtle bg-surface" />
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="h-40 rounded-[var(--mz-radius-card)] border border-border-subtle bg-surface" />
                  <div className="h-40 rounded-[var(--mz-radius-card)] border border-border-subtle bg-surface" />
                  <div className="h-40 rounded-[var(--mz-radius-card)] border border-border-subtle bg-surface" />
                </div>
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>

      {blocker.status === 'blocked' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="exam-leave-blocker-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--mz-scrim-barrier)] p-4"
        >
          <div className="w-full max-w-md rounded-[var(--mz-radius-card)] border border-border-strong bg-surface p-6 text-start">
            <h2
              id="exam-leave-blocker-title"
              className="text-lg font-semibold text-text-primary"
            >
              {t('examBlockerTitle')}
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              {activeSessionLabel
                ? t('examBlockerMessageWithLabel', { sessionLabel: activeSessionLabel })
                : t('examBlockerMessageGeneric')}
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => blocker.reset()}
                className="rounded-[var(--mz-radius-control)] border border-border-strong bg-surface-alt px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-hover"
              >
                {t('examBlockerStayAction')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveExamLock(false);
                  blocker.proceed();
                }}
                className="rounded-[var(--mz-radius-control)] bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-pressed"
              >
                {t('examBlockerLeaveAction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const rootRoute = createRootRoute({
  component: AppRootLayout,
  notFoundComponent: NotFoundView,
});

const appIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <Navigate to="/home" replace />,
});

const welcomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/welcome',
  component: () => <WelcomeScreen />,
});

const goalSetupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding/goal',
  component: () => <GoalSetupScreen />,
});

const diagnosticIntroRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/diagnostic/intro',
  validateSearch: parseTrackSearchParam,
  component: () => {
    const search = diagnosticIntroRoute.useSearch();
    return <DiagnosticIntroScreen initialTrack={search.track} />;
  },
});

const parseRetakeSkill = (search: Record<string, unknown>): { retakeSkill?: DiagnosticSkill } => {
  const val = search['retakeSkill'];
  if (val === 'reading' || val === 'listening' || val === 'writing' || val === 'speaking') {
    return { retakeSkill: val };
  }
  return {};
};

const diagnosticSessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/diagnostic/session',
  validateSearch: parseRetakeSkill,
  component: () => {
    const search = diagnosticSessionRoute.useSearch();
    return <DiagnosticSessionScreen retakeSkill={search.retakeSkill} />;
  },
});

const diagnosticSessionByIdRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/diagnostic/session/$diagId',
  validateSearch: parseRetakeSkill,
  component: () => {
    const { diagId } = diagnosticSessionByIdRoute.useParams();
    const search = diagnosticSessionByIdRoute.useSearch();
    return <DiagnosticSessionScreen diagId={diagId} retakeSkill={search.retakeSkill} />;
  },
});

const diagnosticResultRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/diagnostic/result',
  component: () => <DiagnosticResultScreen />,
});

const diagnosticResultByIdRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/diagnostic/result/$diagId',
  component: () => {
    const { diagId } = diagnosticResultByIdRoute.useParams();
    return <DiagnosticResultScreen diagId={diagId} />;
  },
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/login',
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    returnTo?: string;
    reason?: string;
    mode?: 'sign_up' | 'sign_in';
  } => ({
    returnTo: typeof search['returnTo'] === 'string' ? search['returnTo'] : undefined,
    reason: typeof search['reason'] === 'string' ? search['reason'] : undefined,
    mode:
      search['mode'] === 'sign_up' || search['mode'] === 'sign_in'
        ? (search['mode'] as 'sign_up' | 'sign_in')
        : undefined,
  }),
  component: () => {
    const search = loginRoute.useSearch();
    return (
      <AuthScreen
        returnTo={search.returnTo}
        reason={search.reason}
        initialMode={search.mode}
      />
    );
  },
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/home',
  component: () => <HomeScreen />,
});

const practiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/practice',
  validateSearch: parseTrackSearchParam,
  component: () => {
    const search = practiceRoute.useSearch();
    return <PracticeCatalogScreen initialTrack={search.track} />;
  },
});

const readingSessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/practice/reading/$packId',
  component: () => {
    const { packId } = readingSessionRoute.useParams();
    return <ReadingSimulatorScreen packId={packId} />;
  },
});

const listeningSessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/practice/listening/$packId',
  component: () => {
    const { packId } = listeningSessionRoute.useParams();
    return <ListeningSimulatorScreen packId={packId} />;
  },
});

const writingSessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/practice/writing/$packId',
  component: () => {
    const { packId } = writingSessionRoute.useParams();
    return <WritingSimulatorScreen packId={packId} />;
  },
});

const speakingSessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/practice/speaking/$packId',
  component: () => {
    const { packId } = speakingSessionRoute.useParams();
    return <SpeakingSimulatorScreen packId={packId} />;
  },
});

const microDrillsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/practice/drills',
  component: () => <MicroDrillsScreen />,
});

const microDrillByIdRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/practice/drills/$drillId',
  component: () => {
    const { drillId } = microDrillByIdRoute.useParams();
    return <MicroDrillsScreen initialDrillId={drillId} />;
  },
});

const fullMockRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/practice/full-mock',
  component: () => <FullMockOrchestratorScreen />,
});

const fullMockByIdRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/practice/full-mock/$mockId',
  component: () => {
    const { mockId } = fullMockByIdRoute.useParams();
    return <FullMockOrchestratorScreen mockId={mockId} />;
  },
});

const evaluationPendingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/evaluation/pending/$jobId',
  component: () => {
    const { jobId } = evaluationPendingRoute.useParams();
    return <EvaluationPendingScreen jobId={jobId} />;
  },
});

const evaluationResultRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/evaluation/result/$id',
  component: () => {
    const { id } = evaluationResultRoute.useParams();
    return <EvaluationResultScreen id={id} />;
  },
});

const objectiveResultRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/practice/objective-result/$attemptId',
  component: () => {
    const { attemptId } = objectiveResultRoute.useParams();
    return <ObjectiveResultScreen attemptId={attemptId} />;
  },
});

const vocabularyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/vocabulary',
  component: VocabHubScreen,
});

const vocabReviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/vocabulary/review',
  component: VocabReviewScreen,
});

const vocabWordDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/vocabulary/$wordId',
  component: () => {
    const { wordId } = vocabWordDetailRoute.useParams();
    return <VocabWordDetailScreen wordId={wordId} />;
  },
});

const progressRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/progress',
  component: ProgressScreen,
});

const compareAttemptsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/progress/compare',
  component: CompareAttemptsScreen,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: () => <SettingsScreen />,
});

const paywallRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/paywall',
  component: () => {
    const searchStr = useRouterState({ select: (s) => s.location.searchStr });
    return <PaywallScreen callbackSearch={searchStr} />;
  },
});

const routeTree = rootRoute.addChildren([
  appIndexRoute,
  welcomeRoute,
  goalSetupRoute,
  diagnosticIntroRoute,
  diagnosticSessionRoute,
  diagnosticSessionByIdRoute,
  diagnosticResultRoute,
  diagnosticResultByIdRoute,
  loginRoute,
  homeRoute,
  practiceRoute,
  readingSessionRoute,
  listeningSessionRoute,
  writingSessionRoute,
  speakingSessionRoute,
  microDrillsRoute,
  microDrillByIdRoute,
  fullMockRoute,
  fullMockByIdRoute,
  evaluationPendingRoute,
  evaluationResultRoute,
  objectiveResultRoute,
  vocabularyRoute,
  vocabReviewRoute,
  vocabWordDetailRoute,
  progressRoute,
  compareAttemptsRoute,
  settingsRoute,
  paywallRoute,
]);

export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    basepath: '/app',
    history: history ?? (typeof window !== 'undefined' ? createBrowserHistory() : undefined),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter;
  }
}
