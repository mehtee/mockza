import {
  FakeAudioPlayerAdapter,
  FakeAudioRecorderAdapter,
  FakeAuthAdapter,
  FakeBillingAdapter,
  FakeCatalogAdapter,
  FakeClock,
  FakeDiagnosticAdapter,
  FakeEvaluationAdapter,
  FakeLinguisticAdapter,
  FakeStorageAdapter,
  FakeTelemetryAdapter,
} from '@/adapters/fakes';
import type { EditionCode } from '@/edition/edition-config';
import type { AppDependencies } from './container';

export interface TestDependenciesOptions {
  readonly edition?: EditionCode;
  readonly initialClockMs?: number;
  readonly allowDevAuth?: boolean;
  readonly overrides?: Partial<AppDependencies>;
}

export interface TestDependenciesBundle {
  readonly deps: AppDependencies;
  readonly fakeClock: FakeClock;
  readonly fakeAuth: FakeAuthAdapter;
  readonly fakeBilling: FakeBillingAdapter;
  readonly fakeAudioRecorder: FakeAudioRecorderAdapter;
  readonly fakeAudioPlayer: FakeAudioPlayerAdapter;
  readonly fakeCatalog: FakeCatalogAdapter;
  readonly fakeDiagnostic: FakeDiagnosticAdapter;
  readonly fakeEvaluation: FakeEvaluationAdapter;
  readonly fakeLinguistic: FakeLinguisticAdapter;
  readonly fakeStorage: FakeStorageAdapter;
  readonly fakeTelemetry: FakeTelemetryAdapter;
}

export function createTestDependenciesBundle(
  options: TestDependenciesOptions = {},
): TestDependenciesBundle {
  const edition = options.edition ?? 'glb';
  const fakeClock = new FakeClock(options.initialClockMs);
  const fakeAuth = new FakeAuthAdapter({
    clock: fakeClock,
    edition,
    allowDevAuth: options.allowDevAuth,
  });
  const fakeBilling = new FakeBillingAdapter({
    currencyKind: edition === 'irn' ? 'IRR' : 'USD',
  });
  const fakeAudioRecorder = new FakeAudioRecorderAdapter();
  const fakeAudioPlayer = new FakeAudioPlayerAdapter();
  const fakeCatalog = new FakeCatalogAdapter({ clock: fakeClock });
  const fakeDiagnostic = new FakeDiagnosticAdapter({ clock: fakeClock });
  const fakeEvaluation = new FakeEvaluationAdapter({ clock: fakeClock, edition });
  const fakeLinguistic = new FakeLinguisticAdapter({ edition });
  const fakeStorage = new FakeStorageAdapter({
    clock: fakeClock,
    catalog: fakeCatalog,
  });
  const fakeTelemetry = new FakeTelemetryAdapter({ clock: fakeClock });

  const deps: AppDependencies = {
    edition,
    auth: fakeAuth,
    deviceSlots: fakeAuth,
    billing: fakeBilling,
    audioRecorder: fakeAudioRecorder,
    audioPlayer: fakeAudioPlayer,
    attemptStore: fakeStorage,
    syncOutbox: fakeStorage,
    vocabStore: fakeStorage,
    catalog: fakeCatalog,
    diagnostic: fakeDiagnostic,
    evaluation: fakeEvaluation,
    linguistic: fakeLinguistic,
    telemetry: fakeTelemetry,
    clock: fakeClock,
    ...options.overrides,
  };

  return {
    deps,
    fakeClock,
    fakeAuth,
    fakeBilling,
    fakeAudioRecorder,
    fakeAudioPlayer,
    fakeCatalog,
    fakeDiagnostic,
    fakeEvaluation,
    fakeLinguistic,
    fakeStorage,
    fakeTelemetry,
  };
}

export function createTestDependencies(options: TestDependenciesOptions = {}): AppDependencies {
  return createTestDependenciesBundle(options).deps;
}
