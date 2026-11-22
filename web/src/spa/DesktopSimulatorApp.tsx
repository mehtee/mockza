import { RouterProvider } from '@tanstack/react-router';
import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from 'react';
import { createTranslator } from '@/i18n';
import {
  clearBackgroundDropReady,
  type ReadyBackgroundDrop,
  subscribeBackgroundDropReady,
} from '@/spa/advanced-job-watcher';
import {
  bindGlobalSpeechGateway,
  setGlobalDefaultTtsAccent,
} from '@/components/speech-tts';
import { type AppDependencies, AppDependenciesProvider } from '@/spa/deps';
import {
  clearBackgroundEvaluationReady,
  type ReadyBackgroundEvaluation,
  subscribeBackgroundEvaluationReady,
} from '@/spa/eval-job-watcher';
import {
  type AppRouter,
  createAppRouter,
  prefetchOfflineSimulatorChunks,
} from '@/spa/router';
import { useClockStore } from '@/spa/stores/clock.store';
import {
  subscribeSystemThemeChange,
  syncAppearanceFromStorage,
} from '@/theme/theme-controller';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

class SimulatorErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = { error: null };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  public override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Error captured in boundary state for clean UI recovery.
  }

  private readonly handleReset = (): void => {
    this.setState({ error: null });
  };

  public override render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <div
          role="alert"
          className="mx-auto my-12 max-w-lg rounded-[var(--mz-radius-card)] border border-error bg-danger-bg p-6 text-start"
        >
          <h1 className="text-lg font-bold text-text-primary">
            Something went wrong in the simulator
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-4 rounded-[var(--mz-radius-control)] bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-pressed"
          >
            Reload Workspace
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export interface DesktopSimulatorAppProps {
  readonly router?: AppRouter;
  readonly dependencies?: AppDependencies;
}

export function DesktopSimulatorApp({
  router: providedRouter,
  dependencies: providedDependencies,
}: DesktopSimulatorAppProps) {
  const [dependencies, setDependencies] = useState<AppDependencies | null>(
    () => providedDependencies ?? null,
  );
  const [router] = useState(() => providedRouter ?? createAppRouter());
  const [bgReadyEval, setBgReadyEval] = useState<ReadyBackgroundEvaluation | null>(null);
  const [bgReadyDrop, setBgReadyDrop] = useState<ReadyBackgroundDrop | null>(null);

  useEffect(() => {
    if (dependencies?.speechPractice) {
      bindGlobalSpeechGateway(dependencies.speechPractice);
    }
    if (dependencies?.personalization) {
      void dependencies.personalization
        .getState()
        .then((res) => {
          if (res.ok) {
            setGlobalDefaultTtsAccent(
              res.value.profile.preferredTtsAccent === 'uk' ? 'uk' : 'us',
            );
          }
        })
        .catch(() => {});
    }
  }, [dependencies]);

  useEffect(() => subscribeBackgroundEvaluationReady(setBgReadyEval), []);
  useEffect(() => subscribeBackgroundDropReady(setBgReadyDrop), []);

  useEffect(() => {
    syncAppearanceFromStorage();
    return subscribeSystemThemeChange(() => {});
  }, []);

  useEffect(() => {
    if (dependencies) return;
    let mounted = true;
    void import('@/composition/bootstrap').then(({ createAppDependencies }) => {
      if (!mounted) return;
      setDependencies(createAppDependencies());
    });
    return () => {
      mounted = false;
    };
  }, [dependencies]);

  useEffect(() => {
    if (!dependencies) return;
    // Ensure first-time guests hold a signed device JWT before clicking Smart Coach tools.
    void dependencies.auth.ensureAuthenticated(false);
    void dependencies.syncOutbox.purgeExpiredAudio().then(() => dependencies.syncOutbox.flushPending());
    const runPrefetch = () => {
      void prefetchOfflineSimulatorChunks().then(() => {
        document.documentElement.dataset['offlineReady'] = 'true';
      });
    };
    const handleOnline = () => {
      void dependencies.syncOutbox.flushPending();
    };
    const handlePrefetchRequest = () => {
      runPrefetch();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('mockza:prefetch-offline-chunks', handlePrefetchRequest);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('mockza:prefetch-offline-chunks', handlePrefetchRequest);
    };
  }, [dependencies]);

  useEffect(() => {
    if (!dependencies) return;
    const unsubRevoked = dependencies.auth.onSessionRevoked?.(() => {
      useClockStore.getState().resetClock();
      void router.navigate({
        to: '/auth/login',
        search: { reason: 'session_revoked' },
      });
    });
    return () => {
      unsubRevoked?.();
    };
  }, [dependencies, router]);

  if (!dependencies) {
    return (
      <div className="p-6 text-sm text-text-secondary">
        Initializing simulator...
      </div>
    );
  }

  const t = createTranslator(dependencies.edition);

  return (
    <SimulatorErrorBoundary>
      <AppDependenciesProvider dependencies={dependencies}>
        {bgReadyEval ? (
          <div
            data-testid="bg-eval-ready-banner"
            role="status"
            className="fixed bottom-4 end-4 z-50 flex items-center gap-3 rounded-[var(--mz-radius-card)] border border-primary bg-surface-alt px-4 py-3 text-xs shadow-lg"
          >
            <span className="font-semibold text-text-primary">{t('evalPendingBgReadyToast')}</span>
            <button
              type="button"
              onClick={() => {
                const targetAttempt = bgReadyEval.attemptId;
                clearBackgroundEvaluationReady();
                void router.navigate({
                  to: '/evaluation/result/$id',
                  params: { id: targetAttempt },
                });
              }}
              className="rounded-[var(--mz-radius-compact)] bg-primary px-2.5 py-1 font-semibold text-on-primary hover:bg-primary-pressed"
            >
              {t('evalResultTitle')}
            </button>
            <button
              type="button"
              aria-label={t('workspaceShortcutsCloseAction')}
              onClick={() => clearBackgroundEvaluationReady()}
              className="text-text-secondary hover:text-text-primary"
            >
              ×
            </button>
          </div>
        ) : null}
        {bgReadyDrop ? (
          <div
            data-testid="bg-drop-ready-banner"
            role="status"
            className="fixed bottom-16 end-4 z-50 flex items-center gap-3 rounded-[var(--mz-radius-card)] border border-primary bg-surface-alt px-4 py-3 text-xs shadow-lg"
          >
            <span className="font-semibold text-text-primary">
              {dependencies.edition === 'irn'
                ? `مطالعه آماده شد: ${bgReadyDrop.title}`
                : `Study set ready: ${bgReadyDrop.title}`}
            </span>
            <button
              type="button"
              onClick={() => {
                const targetDropId = bgReadyDrop.dropId;
                clearBackgroundDropReady();
                void router.navigate({
                  to: '/drop/drill/$dropId',
                  params: { dropId: targetDropId },
                });
              }}
              className="rounded-[var(--mz-radius-compact)] bg-primary px-2.5 py-1 font-semibold text-on-primary hover:bg-primary-pressed"
            >
              {dependencies.edition === 'irn' ? 'شروع تمرین' : 'Open Quiz'}
            </button>
            <button
              type="button"
              aria-label={t('workspaceShortcutsCloseAction')}
              onClick={() => clearBackgroundDropReady()}
              className="text-text-secondary hover:text-text-primary"
            >
              ×
            </button>
          </div>
        ) : null}
        <RouterProvider router={router} />
      </AppDependenciesProvider>
    </SimulatorErrorBoundary>
  );
}

export default DesktopSimulatorApp;
