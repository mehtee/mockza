import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  DevicePolicySummarySchema,
  DeviceSlotKindSchema,
  SocialProviderDescriptorSchema,
} from '@mockza/contracts';
import type { ThemePresetId } from '@mockza/design-tokens';
import type { SkillKind } from '@mockza/domain';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  type ActiveDeviceSlot,
  type AppearancePresetId,
  type AttemptStatus,
  type AudioError,
  type AuthGatewayError,
  type AuthSession,
  type BillingError,
  type CachedDrillRecord,
  type CatalogError,
  type CatalogPackFilter,
  type CatalogPackRecord,
  type DailyStudyLogRecord,
  type DeviceIdentity,
  type DevicePolicySummary,
  type DeviceSlotOccupiedError,
  type DiagnosticSessionRecord,
  type EntitlementRequiredError,
  type EvaluationResultRecord,
  type GatewayError,
  type IAuthGateway,
  type IAudioPlayerGateway,
  type IAudioRecorderGateway,
  type IBillingGateway,
  type ICatalogMediaGateway,
  type IClock,
  type IDeviceSlotGateway,
  type IOfflineAttemptStore,
  type ISyncOutboxGateway,
  type ITelemetryGateway,
  type IVocabSrsStore,
  MEDIA_CACHE_QUOTA_BYTES,
  type MediaCacheIndexRecord,
  type MicroDrillHistoryRecord,
  type NetworkError,
  type OccupyingDeviceInfo,
  type QuotaExceededError,
  type RecordVocabReviewInput,
  type Result,
  type SocialProviderDescriptor,
  type StartCheckoutInput,
  type StorageError,
  type SyncOutboxError,
  type UnauthorizedError,
  type UnexpectedError,
  type ValidationError,
  type VocabReviewLogRecord,
  type VocabReviewRating,
  err,
  isErr,
  isOk,
  mapResult,
  ok,
  unwrapOr,
} from '@/gateways';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GATEWAYS_DIR = path.resolve(__dirname, '../../src/gateways');

function describeGatewayError(error: GatewayError): string {
  switch (error.kind) {
    case 'network':
      return `network:${error.retryable}:${error.status ?? 'none'}:${error.message}`;
    case 'unauthorized':
      return `unauthorized:${error.reasonCode ?? 'none'}:${error.message}`;
    case 'device_slot_occupied':
      return `slot:${error.conflictCode}:${error.occupyingDevice.sessionId}:${error.occupyingDevice.slotKind}`;
    case 'validation':
      return `validation:${error.field ?? 'none'}:${error.code ?? 'none'}:${error.message}`;
    case 'entitlement_required':
      return `entitlement:${error.feature}:${error.message}`;
    case 'quota_exceeded':
      return `quota:${error.retryAfterSec ?? 'none'}:${error.message}`;
    case 'storage':
      return `storage:${error.code ?? 'none'}:${error.message}`;
    case 'audio':
      return `audio:${error.code}:${error.message}`;
    case 'billing':
      return `billing:${error.code}:${error.message}`;
    case 'unexpected':
      return `unexpected:${error.message}`;
  }
}

describe('W1.2 Result<T, E> combinators & type narrowing', () => {
  it('constructs ok/err values and narrows with isOk / isErr', () => {
    const success: Result<number, GatewayError> = ok(42);
    const failure: Result<number, GatewayError> = err({
      kind: 'validation',
      message: 'Invalid target band',
      field: 'targetBand',
      code: 'OUT_OF_RANGE',
    });

    expect(isOk(success)).toBe(true);
    expect(isErr(success)).toBe(false);
    if (isOk(success)) {
      expect(success.value).toBe(42);
    }

    expect(isOk(failure)).toBe(false);
    expect(isErr(failure)).toBe(true);
    if (isErr(failure)) {
      expect(failure.error.kind).toBe('validation');
      expect(describeGatewayError(failure.error)).toBe(
        'validation:targetBand:OUT_OF_RANGE:Invalid target band',
      );
    }
  });

  it('transforms ok values via mapResult and short-circuits on err', () => {
    const baseOk: Result<number, StorageError> = ok(7);
    const mappedOk = mapResult(baseOk, (n) => n * 2);
    expect(mappedOk).toEqual({ ok: true, value: 14 });

    let called = false;
    const baseErr: Result<number, StorageError> = err({
      kind: 'storage',
      message: 'Quota exceeded',
      code: 'QUOTA_FULL',
    }) as Result<number, StorageError>;
    const mappedErr = mapResult(baseErr, (n) => {
      called = true;
      return n * 2;
    });
    expect(called).toBe(false);
    expect(mappedErr).toEqual(baseErr);
  });

  it('returns value or fallback via unwrapOr', () => {
    expect(unwrapOr(ok('ready'), 'idle')).toBe('ready');
    const failed: Result<string, NetworkError> = err({
      kind: 'network',
      message: 'Offline',
      retryable: true,
    });
    expect(unwrapOr(failed, 'idle')).toBe('idle');
  });
});

describe('W1.2 GatewayError discriminated union exhaustiveness', () => {
  it('handles every GatewayError variant cleanly', () => {
    const networkErr: NetworkError = {
      kind: 'network',
      message: 'Gateway timeout',
      retryable: true,
      status: 504,
    };
    const unauthorizedErr: UnauthorizedError = {
      kind: 'unauthorized',
      message: 'Session revoked remotely',
      reasonCode: 'SESSION_REVOKED',
    };
    const slotErr: DeviceSlotOccupiedError = {
      kind: 'device_slot_occupied',
      message: 'Desktop slot already active',
      conflictCode: 'DEVICE_SLOT_OCCUPIED',
      occupyingDevice: {
        sessionId: 'sess-123',
        deviceId: 'dev-456',
        deviceName: 'Chrome on Ubuntu',
        slotKind: 'desktop_web',
        locationLabel: 'Tehran, IR',
        ipCountry: 'IR',
        city: 'Tehran',
        lastSeenAt: '2026-11-18T05:00:00Z',
      },
    };
    const validationErr: ValidationError = {
      kind: 'validation',
      message: 'Bad phone format',
      field: 'phoneE164',
      code: 'INVALID_E164',
    };
    const entitlementErr: EntitlementRequiredError = {
      kind: 'entitlement_required',
      message: 'Pro required',
      feature: 'full_mock',
    };
    const quotaErr: QuotaExceededError = {
      kind: 'quota_exceeded',
      message: 'Daily speaking quota reached',
      retryAfterSec: 3600,
    };
    const storageErr: StorageError = {
      kind: 'storage',
      message: 'Digest mismatch',
      code: 'SHA256_MISMATCH',
    };
    const audioErr: AudioError = {
      kind: 'audio',
      message: 'Seek locked during exam playback',
      code: 'LOCKED_EXAM_PLAYBACK',
    };
    const billingErr: BillingError = {
      kind: 'billing',
      message: 'ToS checkbox required',
      code: 'TOS_REQUIRED',
    };
    const unexpectedErr: UnexpectedError = {
      kind: 'unexpected',
      message: 'Unhandled state',
      cause: new Error('boom'),
    };

    const allErrors: readonly GatewayError[] = [
      networkErr,
      unauthorizedErr,
      slotErr,
      validationErr,
      entitlementErr,
      quotaErr,
      storageErr,
      audioErr,
      billingErr,
      unexpectedErr,
    ];

    const descriptions = allErrors.map(describeGatewayError);
    expect(descriptions).toEqual([
      'network:true:504:Gateway timeout',
      'unauthorized:SESSION_REVOKED:Session revoked remotely',
      'slot:DEVICE_SLOT_OCCUPIED:sess-123:desktop_web',
      'validation:phoneE164:INVALID_E164:Bad phone format',
      'entitlement:full_mock:Pro required',
      'quota:3600:Daily speaking quota reached',
      'storage:SHA256_MISMATCH:Digest mismatch',
      'audio:LOCKED_EXAM_PLAYBACK:Seek locked during exam playback',
      'billing:TOS_REQUIRED:ToS checkbox required',
      'unexpected:Unhandled state',
    ]);
  });
});

describe('W1.2 Gateway contract invariants & compile-time type contracts', () => {
  it('fixes OPFS media cache quota at 250 MiB (262_144_000 bytes)', () => {
    expect(MEDIA_CACHE_QUOTA_BYTES).toBe(250 * 1024 * 1024);
    expect(MEDIA_CACHE_QUOTA_BYTES).toBe(262_144_000);
  });

  it('verifies strict gateway contract signatures at type level', () => {
    expectTypeOf<DeviceIdentity['slotKind']>().toEqualTypeOf<'desktop_web'>();
    expectTypeOf<DeviceIdentity['platform']>().toEqualTypeOf<'web_desktop'>();
    expectTypeOf<DeviceIdentity['appSurface']>().toEqualTypeOf<'web_app'>();
    expectTypeOf<StartCheckoutInput['acceptedSingleDevicePerSlotTos']>().toEqualTypeOf<true>();
    expectTypeOf<AuthGatewayError>().toMatchTypeOf<GatewayError>();
    expectTypeOf<IBillingGateway['currencyKind']>().toEqualTypeOf<'USD' | 'IRR'>();
    expectTypeOf<ActiveDeviceSlot['slotKind']>().toEqualTypeOf<'mobile' | 'desktop_web'>();

    expectTypeOf<IAuthGateway['signInWithEmail']>().returns.resolves.toMatchTypeOf<
      Result<unknown, GatewayError>
    >();
    expectTypeOf<IDeviceSlotGateway['listActiveDevices']>().returns.resolves.toMatchTypeOf<
      Result<readonly ActiveDeviceSlot[], GatewayError>
    >();
    expectTypeOf<IAudioRecorderGateway['activeContentType']>().toEqualTypeOf<string>();
    expectTypeOf<IAudioPlayerGateway['setPlaybackMode']>().parameter(0).toEqualTypeOf<
      'exam_linear_locked' | 'study_interactive'
    >();
    expectTypeOf<IOfflineAttemptStore['flushUrgentDraftSync']>().returns.toBeVoid();
    expectTypeOf<ISyncOutboxGateway['observePendingCount']>().returns.toEqualTypeOf<() => void>();
    expectTypeOf<IVocabSrsStore['getDueCards']>().returns.resolves.toMatchTypeOf<
      Result<readonly unknown[], StorageError>
    >();
    expectTypeOf<ICatalogMediaGateway['getCacheUsageSummary']>().returns.resolves.toMatchTypeOf<
      Result<{ readonly quotaBytes: 262_144_000 }, StorageError>
    >();
    expectTypeOf<IClock['todaySerialDay']>().returns.toEqualTypeOf<number>();
    expectTypeOf<ITelemetryGateway['flush']>().returns.resolves.toMatchTypeOf<
      Result<{ readonly acceptedCount: number }, GatewayError>
    >();

    // W1.2 Iteration 2 contract parity & schema derivation assertions
    expectTypeOf<IAuthGateway['getSession']>().returns.toEqualTypeOf<
      Promise<Result<AuthSession | null, StorageError | UnexpectedError>>
    >();
    expectTypeOf<SocialProviderDescriptor>().toEqualTypeOf<
      Readonly<(typeof SocialProviderDescriptorSchema)['_output']>
    >();
    expectTypeOf<DevicePolicySummary>().toEqualTypeOf<
      Readonly<(typeof DevicePolicySummarySchema)['_output']>
    >();
    expectTypeOf<OccupyingDeviceInfo['slotKind']>().toEqualTypeOf<
      (typeof DeviceSlotKindSchema)['_output']
    >();

    expectTypeOf<'uploading_audio'>().toMatchTypeOf<AttemptStatus>();
    expectTypeOf<AttemptStatus>().toEqualTypeOf<
      | 'in_progress'
      | 'submitted_local'
      | 'uploading_audio'
      | 'queued_remote'
      | 'completed'
      | 'failed_retryable'
    >();

    expectTypeOf<'fullMock'>().toMatchTypeOf<CatalogPackFilter['skill']>();
    expectTypeOf<CatalogPackFilter['skill']>().toEqualTypeOf<
      SkillKind | 'fullMock' | undefined
    >();
    expectTypeOf<CatalogPackRecord['skill']>().toEqualTypeOf<SkillKind | 'fullMock'>();

    expectTypeOf<CachedDrillRecord>().toEqualTypeOf<{
      readonly drillId: string;
      readonly title: string;
      readonly drillType: string;
      readonly skill: SkillKind;
      readonly durationSeconds: number;
      readonly itemsJson: string;
      readonly updatedAtMs: number;
    }>();

    expectTypeOf<IOfflineAttemptStore['saveEvaluationResult']>().toEqualTypeOf<
      (record: EvaluationResultRecord) => Promise<Result<void, StorageError>>
    >();
    expectTypeOf<IOfflineAttemptStore['getEvaluationResultById']>().toEqualTypeOf<
      (id: string) => Promise<Result<EvaluationResultRecord | null, StorageError>>
    >();
    expectTypeOf<IOfflineAttemptStore['getEvaluationResultByAttemptId']>().toEqualTypeOf<
      (attemptId: string) => Promise<Result<EvaluationResultRecord | null, StorageError>>
    >();
    expectTypeOf<IOfflineAttemptStore['recordMicroDrillHistory']>().toEqualTypeOf<
      (record: MicroDrillHistoryRecord) => Promise<Result<MicroDrillHistoryRecord, StorageError>>
    >();
    expectTypeOf<IOfflineAttemptStore['listMicroDrillHistory']>().returns.toEqualTypeOf<
      Promise<Result<readonly MicroDrillHistoryRecord[], StorageError>>
    >();
    expectTypeOf<IOfflineAttemptStore['listRecentDailyStudyLogs']>().toEqualTypeOf<
      (limit?: number) => Promise<Result<readonly DailyStudyLogRecord[], StorageError>>
    >();
    expectTypeOf<IOfflineAttemptStore['getLatestDiagnosticSession']>().returns.toEqualTypeOf<
      Promise<Result<DiagnosticSessionRecord | null, StorageError>>
    >();

    expectTypeOf<ICatalogMediaGateway['syncDrills']>().toEqualTypeOf<
      () => Promise<Result<readonly CachedDrillRecord[], CatalogError>>
    >();
    expectTypeOf<ICatalogMediaGateway['listCachedDrills']>().returns.toEqualTypeOf<
      Promise<Result<readonly CachedDrillRecord[], StorageError>>
    >();
    expectTypeOf<ICatalogMediaGateway['getCachedDrillById']>().toEqualTypeOf<
      (drillId: string) => Promise<Result<CachedDrillRecord | null, StorageError>>
    >();
    expectTypeOf<ICatalogMediaGateway['listRecordingsForAttempt']>().toEqualTypeOf<
      (attemptId: string) => Promise<Result<readonly MediaCacheIndexRecord[], StorageError>>
    >();
    expectTypeOf<ICatalogMediaGateway['updateRecordingRemoteKey']>().toEqualTypeOf<
      (mediaKey: string, remoteObjectKey: string) => Promise<Result<void, StorageError>>
    >();

    expectTypeOf<IVocabSrsStore['listVocabReviewLogs']>().returns.toEqualTypeOf<
      Promise<Result<readonly VocabReviewLogRecord[], StorageError>>
    >();
    expectTypeOf<RecordVocabReviewInput['rating']>().toEqualTypeOf<VocabReviewRating>();
    expectTypeOf<'quality'>().not.toMatchTypeOf<keyof RecordVocabReviewInput>();
    expectTypeOf<ValidationError>().toMatchTypeOf<SyncOutboxError>();
    expectTypeOf<AppearancePresetId>().toEqualTypeOf<ThemePresetId>();
  });
});

describe('W1.2 Static dependency boundary hygiene for web/src/gateways/*', () => {
  const expectedFiles = [
    'audio.gateway.ts',
    'auth.gateway.ts',
    'billing.gateway.ts',
    'catalog.gateway.ts',
    'diagnostic.gateway.ts',
    'evaluation.gateway.ts',
    'index.ts',
    'linguistic.gateway.ts',
    'personalization.gateway.ts',
    'result.ts',
    'speech-practice.gateway.ts',
    'storage.gateway.ts',
    'telemetry.gateway.ts',
  ].sort();

  it('contains exact gateway module files and zero forbidden imports or browser globals', () => {
    const actualFiles = fs
      .readdirSync(GATEWAYS_DIR)
      .filter((name) => name.endsWith('.ts'))
      .sort();

    expect(actualFiles).toEqual(expectedFiles);

    const allowedExternalPackages = new Set([
      '@mockza/domain',
      '@mockza/contracts',
      '@mockza/design-tokens',
    ]);
    const importExportFromRegex =
      /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
    const bareImportRegex = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    const forbiddenGlobalsRegex = /\b(?:window|document|navigator|localStorage|sessionStorage|indexedDB)\b/;

    for (const fileName of actualFiles) {
      const fullPath = path.join(GATEWAYS_DIR, fileName);
      const source = fs.readFileSync(fullPath, 'utf8');

      const specifiers: string[] = [];
      for (const regex of [importExportFromRegex, bareImportRegex, dynamicImportRegex]) {
        regex.lastIndex = 0;
        let match: RegExpExecArray | null = regex.exec(source);
        while (match !== null) {
          if (match[1]) {
            specifiers.push(match[1]);
          }
          match = regex.exec(source);
        }
      }

      for (const specifier of specifiers) {
        if (specifier.startsWith('./')) {
          const targetTs = path.join(GATEWAYS_DIR, `${specifier.slice(2)}.ts`);
          const targetRaw = path.join(GATEWAYS_DIR, specifier.slice(2));
          expect(
            fs.existsSync(targetTs) || fs.existsSync(targetRaw),
            `${fileName} imports missing sibling ${specifier}`,
          ).toBe(true);
        } else {
          expect(
            allowedExternalPackages.has(specifier),
            `${fileName} has forbidden import "${specifier}"`,
          ).toBe(true);
        }
      }

      // External package imports are strictly type-only.
      const externalImportRegex =
        /(?:^|\n)\s*import\s+(?!type\b)[\s\S]*?\s+from\s+['"]([^.'"][^'"]*)['"]/g;
      const runtimeExternalMatch = externalImportRegex.exec(source);
      expect(
        runtimeExternalMatch,
        `${fileName} must use "import type" only for external packages (found ${runtimeExternalMatch?.[1] ?? ''})`,
      ).toBeNull();

      expect(
        forbiddenGlobalsRegex.test(source),
        `${fileName} must not reference browser DOM/storage globals`,
      ).toBe(false);
    }
  });
});
