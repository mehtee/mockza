import { RouterProvider } from '@tanstack/react-router';
import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from 'react';
import { type AppDependencies, AppDependenciesProvider } from '@/spa/deps';
import { type AppRouter, createAppRouter } from '@/spa/router';
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
    void dependencies.syncOutbox.purgeExpiredAudio().then(() => dependencies.syncOutbox.flushPending());
    const handleOnline = () => {
      void dependencies.syncOutbox.flushPending();
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
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

  return (
    <SimulatorErrorBoundary>
      <AppDependenciesProvider dependencies={dependencies}>
        <RouterProvider router={router} />
      </AppDependenciesProvider>
    </SimulatorErrorBoundary>
  );
}

export default DesktopSimulatorApp;
