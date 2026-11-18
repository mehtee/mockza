import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from 'react';
import { createAppDependencies } from '@/composition/bootstrap';
import { type AppDependencies, AppDependenciesProvider } from '@/spa/deps';
import { type AppRouter, createAppRouter } from '@/spa/router';
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
  readonly queryClient?: QueryClient;
  readonly dependencies?: AppDependencies;
}

export function createDefaultQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function DesktopSimulatorApp({
  router: providedRouter,
  queryClient: providedQueryClient,
  dependencies: providedDependencies,
}: DesktopSimulatorAppProps) {
  const [dependencies] = useState(
    () => providedDependencies ?? createAppDependencies(),
  );
  const [queryClient] = useState(
    () => providedQueryClient ?? createDefaultQueryClient(),
  );
  const [router] = useState(() => providedRouter ?? createAppRouter());

  useEffect(() => {
    syncAppearanceFromStorage();
    return subscribeSystemThemeChange(() => {});
  }, []);

  return (
    <SimulatorErrorBoundary>
      <AppDependenciesProvider dependencies={dependencies}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AppDependenciesProvider>
    </SimulatorErrorBoundary>
  );
}

export default DesktopSimulatorApp;
