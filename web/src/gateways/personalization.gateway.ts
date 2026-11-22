import type {
  PersonalizationStateResponseSchema,
  RecordBandEventRequestSchema,
  SyncPullResponseSchema,
  UpdatePersonalizationProfileRequestSchema,
  VocabBatchSyncRequestSchema,
  VocabWaveSummarySchema,
} from '@mockza/contracts';
import type {
  NetworkError,
  Result,
  UnauthorizedError,
  UnexpectedError,
  ValidationError,
} from './result';

export type PersonalizationStateDto = (typeof PersonalizationStateResponseSchema)['_output'];
export type RoadmapStepDto = PersonalizationStateDto['roadmap']['steps'][number];
export type UpdatePersonalizationProfileInput =
  (typeof UpdatePersonalizationProfileRequestSchema)['_output'];
export type RecordBandEventInput = (typeof RecordBandEventRequestSchema)['_output'];
export type SyncPullDto = (typeof SyncPullResponseSchema)['_output'];
export type VocabBatchSyncInput = (typeof VocabBatchSyncRequestSchema)['_output'];
export type VocabWaveSummaryDto = (typeof VocabWaveSummarySchema)['_output'];

export type PersonalizationGatewayError =
  | NetworkError
  | UnauthorizedError
  | ValidationError
  | UnexpectedError;

import type {
  CompletedAttemptRecord,
  VocabCardRecord,
  VocabSrsStateRecord,
} from './storage.gateway';

export interface CrossDeviceLocalSyncStore {
  readonly vocabCards?: {
    get(key: string): Promise<VocabCardRecord | undefined>;
    bulkPut(rows: readonly VocabCardRecord[]): Promise<unknown>;
  };
  readonly vocabSrsStates: {
    get(key: string): Promise<VocabSrsStateRecord | undefined>;
    bulkPut(rows: readonly VocabSrsStateRecord[]): Promise<unknown>;
  };
  readonly pronunciationHistory: {
    bulkPut(
      rows: ReadonlyArray<{
        readonly practiceId: string;
        readonly targetText: string;
        readonly overallScore: number | null;
        readonly payloadJson: string;
        readonly createdAtMs: number;
      }>,
    ): Promise<unknown>;
  };
  readonly completedAttempts: {
    get(key: string): Promise<CompletedAttemptRecord | undefined>;
    bulkPut(rows: readonly CompletedAttemptRecord[]): Promise<unknown>;
  };
}

export interface IPersonalizationGateway {
  getState(): Promise<Result<PersonalizationStateDto, PersonalizationGatewayError>>;
  updateProfile(
    input: UpdatePersonalizationProfileInput,
  ): Promise<Result<PersonalizationStateDto, PersonalizationGatewayError>>;
  recordBandEvent(
    input: RecordBandEventInput,
  ): Promise<Result<PersonalizationStateDto, PersonalizationGatewayError>>;
  advanceRoadmapStep(
    stepId: string,
    status: 'completed' | 'skipped' | 'active',
  ): Promise<Result<PersonalizationStateDto, PersonalizationGatewayError>>;
  ackBandShift?(): Promise<Result<{ readonly ok: boolean; readonly bandShift: number }, PersonalizationGatewayError>>;
  pullSync(sinceIso?: string): Promise<Result<SyncPullDto, PersonalizationGatewayError>>;
  pushVocabBatch(
    input: VocabBatchSyncInput,
  ): Promise<Result<VocabWaveSummaryDto, PersonalizationGatewayError>>;
}
