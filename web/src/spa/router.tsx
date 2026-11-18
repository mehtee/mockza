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
import { getActiveEditionCode, getActiveEditionDir } from '@/edition/edition-config';
import { createTranslator } from '@/i18n';
import type { DiagnosticSkill } from '@mockza/domain';
import { AuthScreen } from '@/spa/features/auth/AuthScreen';
import { DiagnosticIntroScreen } from '@/spa/features/diagnostic/DiagnosticIntroScreen';
import { DiagnosticResultScreen } from '@/spa/features/diagnostic/DiagnosticResultScreen';
import { DiagnosticSessionScreen } from '@/spa/features/diagnostic/DiagnosticSessionScreen';
import { HomeScreen } from '@/spa/features/home/HomeScreen';
import { GoalSetupScreen } from '@/spa/features/onboarding/GoalSetupScreen';
import { WelcomeScreen } from '@/spa/features/onboarding/WelcomeScreen';
import { PaywallScreen } from '@/spa/features/paywall/PaywallScreen';
import { FullMockOrchestratorScreen } from '@/spa/features/practice/FullMockOrchestratorScreen';
import { ListeningSimulatorScreen } from '@/spa/features/practice/ListeningSimulatorScreen';
import { MicroDrillsScreen } from '@/spa/features/practice/MicroDrillsScreen';
import { PracticeCatalogScreen } from '@/spa/features/practice/PracticeCatalogScreen';
import { ReadingSimulatorScreen } from '@/spa/features/practice/ReadingSimulatorScreen';
import { SpeakingSimulatorScreen } from '@/spa/features/practice/SpeakingSimulatorScreen';
import { WritingSimulatorScreen } from '@/spa/features/practice/WritingSimulatorScreen';
import { ObjectiveResultScreen } from '@/spa/features/results/ObjectiveResultScreen';
import { SettingsScreen } from '@/spa/features/settings/SettingsScreen';
import { useClockStore } from '@/spa/stores/clock.store';
import { useLayoutStore } from '@/spa/stores/layout.store';

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

interface RouteSkeletonProps {
  readonly routeId: string;
  readonly title: string;
  readonly description: string;
  readonly params?: Readonly<Record<string, string>>;
}

function RouteSkeletonView({
  routeId,
  title,
  description,
  params,
}: RouteSkeletonProps) {
  const t = createTranslator();
  const paramEntries = params ? Object.entries(params) : [];
  return (
    <section
      data-testid={`route-skeleton-${routeId}`}
      className="rounded-[var(--mz-radius-card)] border border-border-subtle bg-surface p-6 text-start"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <p className="text-xs font-medium text-text-tertiary">{routeId}</p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">{title}</h1>
        </div>
        <span className="rounded-[var(--mz-radius-pill)] border border-border-subtle bg-surface-alt px-3 py-1 text-xs font-medium text-text-secondary">
          {t('scaffoldBadgeLabel')}
        </span>
      </div>
      <p className="mt-4 text-sm text-text-secondary">{description}</p>
      {paramEntries.length > 0 && (
        <dl className="mt-4 grid grid-cols-1 gap-2 rounded-[var(--mz-radius-control)] border border-border-subtle bg-surface-alt p-4 sm:grid-cols-2">
          {paramEntries.map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <dt className="font-semibold text-text-secondary">{key}:</dt>
              <dd className="font-mono-exam text-text-primary">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function AppRootLayout() {
  const edition = getActiveEditionCode();
  const dir = getActiveEditionDir();
  const t = createTranslator(edition);
  const activeSessionLabel = useClockStore((state) => state.activeSessionLabel);
  const setActiveExamLock = useClockStore((state) => state.setActiveExamLock);
  const sidebarCollapsed = useLayoutStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useLayoutStore((state) => state.toggleSidebar);

  const blocker = useBlocker({
    shouldBlockFn: () => useClockStore.getState().activeExamLock,
    enableBeforeUnload: () => useClockStore.getState().activeExamLock,
    withResolver: true,
  });

  return (
    <div dir={dir} className="flex min-h-dvh bg-canvas text-text-primary">
      <aside
        aria-label={t('navAriaLabel')}
        className={`flex shrink-0 flex-col border-e border-border-subtle bg-bg-raised p-4 transition-all ${
          sidebarCollapsed ? 'w-20' : 'w-60'
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border-subtle pb-3">
          <a href="/" className="text-sm font-bold text-text-primary">
            {sidebarCollapsed ? t('brandShort') : t('appTitle')}
          </a>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? t('navExpandLabel') : t('navCollapseLabel')}
            aria-expanded={!sidebarCollapsed}
            className="inline-flex items-center justify-center rounded-[var(--mz-radius-compact)] border border-border-subtle p-1.5 text-text-secondary hover:bg-surface-hover"
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
        </div>

        <nav className="mt-4 flex flex-col gap-1 text-sm text-start">
          <Link
            to="/home"
            aria-label={t('navHome')}
            className="rounded-[var(--mz-radius-compact)] px-3 py-2 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            {sidebarCollapsed ? t('navHome').slice(0, 1) : t('navHome')}
          </Link>
          <Link
            to="/practice"
            aria-label={t('navPractice')}
            className="rounded-[var(--mz-radius-compact)] px-3 py-2 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            {sidebarCollapsed ? t('navPractice').slice(0, 1) : t('navPractice')}
          </Link>
          <Link
            to="/vocabulary"
            aria-label={t('navVocabulary')}
            className="rounded-[var(--mz-radius-compact)] px-3 py-2 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            {sidebarCollapsed ? t('navVocabulary').slice(0, 1) : t('navVocabulary')}
          </Link>
          <Link
            to="/progress"
            aria-label={t('navProgress')}
            className="rounded-[var(--mz-radius-compact)] px-3 py-2 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            {sidebarCollapsed ? t('navProgress').slice(0, 1) : t('navProgress')}
          </Link>
          <Link
            to="/settings"
            aria-label={t('navSettings')}
            className="rounded-[var(--mz-radius-compact)] px-3 py-2 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            {sidebarCollapsed ? t('navSettings').slice(0, 1) : t('navSettings')}
          </Link>
          <Link
            to="/auth/login"
            aria-label={t('authSignInAction')}
            data-testid="nav-auth-link"
            className="mt-2 rounded-[var(--mz-radius-compact)] border border-border-subtle px-3 py-2 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            {sidebarCollapsed ? t('authSignInAction').slice(0, 1) : t('authSignInAction')}
          </Link>
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-6xl flex-1 p-6">
        <Outlet />
      </main>

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
  notFoundComponent: () => (
    <RouteSkeletonView
      routeId="not-found"
      title="Route Not Found"
      description="The requested simulator route does not exist."
    />
  ),
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
  component: () => <DiagnosticIntroScreen />,
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
  component: PracticeCatalogScreen,
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
    return (
      <RouteSkeletonView
        routeId="evaluation-pending"
        title="AI Evaluation Pending"
        description="Live 4-stage async grading stepper (Routes.evaluationPending)."
        params={{ jobId }}
      />
    );
  },
});

const evaluationResultRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/evaluation/result/$id',
  component: () => {
    const { id } = evaluationResultRoute.useParams();
    return (
      <RouteSkeletonView
        routeId="evaluation-result"
        title="Evaluation Review"
        description="Master-detail AI rubric review, spans, and model rewrite diff (Routes.evaluationResult)."
        params={{ id }}
      />
    );
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
  component: () => (
    <RouteSkeletonView
      routeId="vocabulary"
      title="SM-2 Vocabulary Hub"
      description="Due today queue and virtualized academic vocabulary browser (Routes.vocabulary)."
    />
  ),
});

const vocabReviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/vocabulary/review',
  component: () => (
    <RouteSkeletonView
      routeId="vocabulary-review"
      title="SM-2 Flashcard Studio"
      description="Keyboard-first spaced repetition review session (Routes.vocabReview)."
    />
  ),
});

const vocabWordDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/vocabulary/$wordId',
  component: () => {
    const { wordId } = vocabWordDetailRoute.useParams();
    return (
      <RouteSkeletonView
        routeId="vocabulary-word-detail"
        title="Vocabulary Word Detail"
        description="Lexical detail and SM-2 schedule card (Routes.vocabWordDetail)."
        params={{ wordId }}
      />
    );
  },
});

const progressRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/progress',
  component: () => (
    <RouteSkeletonView
      routeId="progress"
      title="Progress Analytics"
      description="Trajectory chart, skill radar, and weakness breakdown (Routes.progress)."
    />
  ),
});

const compareAttemptsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/progress/compare',
  component: () => (
    <RouteSkeletonView
      routeId="progress-compare"
      title="Compare Attempts"
      description="Side-by-side Attempt A vs Attempt B diff workspace (Routes.compareAttempts)."
    />
  ),
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
