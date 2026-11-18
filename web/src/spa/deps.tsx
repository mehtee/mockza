import { createContext, createElement, type ReactNode, useContext } from 'react';
import type { EditionCode } from '@/edition/edition-config';
import type { IAudioPlayerGateway, IAudioRecorderGateway } from '@/gateways/audio.gateway';
import type { IAuthGateway, IDeviceSlotGateway } from '@/gateways/auth.gateway';
import type { IBillingGateway } from '@/gateways/billing.gateway';
import type { ICatalogMediaGateway } from '@/gateways/catalog.gateway';
import type { IDiagnosticGateway } from '@/gateways/diagnostic.gateway';
import type { IEvaluationGateway } from '@/gateways/evaluation.gateway';
import type {
  IOfflineAttemptStore,
  ISyncOutboxGateway,
  IVocabSrsStore,
} from '@/gateways/storage.gateway';
import type { IClock, ITelemetryGateway } from '@/gateways/telemetry.gateway';

export interface AppDependencies {
  readonly edition: EditionCode;
  readonly auth: IAuthGateway;
  readonly deviceSlots: IDeviceSlotGateway;
  readonly billing: IBillingGateway;
  readonly audioRecorder: IAudioRecorderGateway;
  readonly audioPlayer: IAudioPlayerGateway;
  readonly attemptStore: IOfflineAttemptStore;
  readonly syncOutbox: ISyncOutboxGateway;
  readonly vocabStore: IVocabSrsStore;
  readonly catalog: ICatalogMediaGateway;
  readonly diagnostic: IDiagnosticGateway;
  readonly evaluation: IEvaluationGateway;
  readonly telemetry: ITelemetryGateway;
  readonly clock: IClock;
}

export const AppDependenciesContext = createContext<AppDependencies | null>(null);

export interface AppDependenciesProviderProps {
  readonly dependencies: AppDependencies;
  readonly children: ReactNode;
}

export function AppDependenciesProvider({
  dependencies,
  children,
}: AppDependenciesProviderProps) {
  return createElement(AppDependenciesContext.Provider, { value: dependencies }, children);
}

export function useOptionalDeps(): AppDependencies | null {
  return useContext(AppDependenciesContext);
}

export function useDeps(): AppDependencies {
  const ctx = useContext(AppDependenciesContext);
  if (ctx === null) {
    throw new Error('useDeps() must be used inside <AppDependenciesProvider>.');
  }
  return ctx;
}
