import type {
  CompleteDailyMissionRequestSchema,
  DailyMissionResponseSchema,
  DropHistoryResponseSchema,
  DropIngestRequestSchema,
  DropPresignMediaRequestSchema,
  DropPresignMediaResponseSchema,
  DroppedContentResponseSchema,
  LinguisticGraphResponseSchema,
  RefreshDailyMissionRequestSchema,
  RegisterShifterRequestSchema,
  RegisterShifterResultSchema,
  UpdateGraphInterestsRequestSchema,
  VerifyRepeatAloudRequestSchema,
  VerifyRepeatAloudResponseSchema,
} from '@mockza/contracts';
import type { RecordedClip } from './audio.gateway';
import type {
  EntitlementRequiredError,
  NetworkError,
  QuotaExceededError,
  Result,
  UnauthorizedError,
  UnexpectedError,
  ValidationError,
} from './result';

export type LinguisticGraphSnapshot = (typeof LinguisticGraphResponseSchema)['_output'];
export type UpdateGraphInterestsInput = (typeof UpdateGraphInterestsRequestSchema)['_output'];
export type DailyMissionSnapshot = (typeof DailyMissionResponseSchema)['_output'];
export type CompleteDailyMissionInput = (typeof CompleteDailyMissionRequestSchema)['_output'];
export type RefreshDailyMissionInput = (typeof RefreshDailyMissionRequestSchema)['_output'];
export type RegisterShifterInput = (typeof RegisterShifterRequestSchema)['_output'];
export type RegisterShifterResult = (typeof RegisterShifterResultSchema)['_output'];
export type VerifyRepeatAloudInput = (typeof VerifyRepeatAloudRequestSchema)['_output'];
export type VerifyRepeatAloudResponse = (typeof VerifyRepeatAloudResponseSchema)['_output'];
export type DropPresignMediaInput = (typeof DropPresignMediaRequestSchema)['_output'];
export type DropPresignMediaResponse = (typeof DropPresignMediaResponseSchema)['_output'];
export type DropIngestInput = (typeof DropIngestRequestSchema)['_output'];
export type DroppedContentItem = (typeof DroppedContentResponseSchema)['_output'];
export type DropHistoryPage = (typeof DropHistoryResponseSchema)['_output'];

export type DropMediaContentType =
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'audio/mp4'
  | 'audio/mpeg'
  | 'audio/wav'
  | 'audio/ogg';

export type LinguisticGatewayError =
  | NetworkError
  | UnauthorizedError
  | EntitlementRequiredError
  | QuotaExceededError
  | ValidationError
  | UnexpectedError;

export interface ILinguisticGateway {
  getMyGraph(): Promise<Result<LinguisticGraphSnapshot, LinguisticGatewayError>>;
  updateInterests(
    input: UpdateGraphInterestsInput,
  ): Promise<Result<LinguisticGraphSnapshot, LinguisticGatewayError>>;
  getTodayMission(params?: {
    readonly examTrack?: string;
    readonly dueWords?: readonly string[];
  }): Promise<Result<DailyMissionSnapshot, LinguisticGatewayError>>;
  refreshTodayMission(
    input: RefreshDailyMissionInput,
  ): Promise<Result<DailyMissionSnapshot, LinguisticGatewayError>>;
  completeMission(
    missionId: string,
    input: CompleteDailyMissionInput,
  ): Promise<Result<DailyMissionSnapshot, LinguisticGatewayError>>;
  completeMissionWithClip(
    missionId: string,
    params: {
      readonly clip: RecordedClip;
      readonly usedTargetKeys?: readonly string[];
    },
  ): Promise<Result<DailyMissionSnapshot, LinguisticGatewayError>>;

  shiftRegisterFromClip(params: {
    readonly clip: RecordedClip;
    readonly examTrack: string;
    readonly topicHint?: string;
  }): Promise<Result<{ readonly jobId: string }, LinguisticGatewayError>>;
  shiftRegisterFromText(params: {
    readonly text: string;
    readonly examTrack: string;
    readonly topicHint?: string;
  }): Promise<Result<{ readonly jobId: string }, LinguisticGatewayError>>;
  verifyRepeatAloud(
    runId: string,
    params: {
      readonly gearLevel: 1 | 2;
      readonly expectedSentence: string;
      readonly targetPhrases: readonly string[];
      readonly clip: RecordedClip;
    },
  ): Promise<Result<VerifyRepeatAloudResponse, LinguisticGatewayError>>;

  uploadDropMediaFile(params: {
    readonly dropId: string;
    readonly mediaKind: 'image' | 'audio';
    readonly index: number;
    readonly bytes: Uint8Array;
    readonly contentType: DropMediaContentType;
  }): Promise<Result<{ readonly objectKey: string }, LinguisticGatewayError>>;
  uploadDropMediaBatch(params: {
    readonly dropId: string;
    readonly mediaKind: 'image' | 'audio';
    readonly files: ReadonlyArray<{
      readonly bytes: Uint8Array;
      readonly contentType: DropMediaContentType;
    }>;
  }): Promise<Result<{ readonly objectKeys: readonly string[] }, LinguisticGatewayError>>;
  ingestDrop(input: DropIngestInput): Promise<Result<{ readonly jobId: string }, LinguisticGatewayError>>;
  getDropHistory(cursor?: string): Promise<Result<DropHistoryPage, LinguisticGatewayError>>;
  getDropById(dropId: string): Promise<Result<DroppedContentItem, LinguisticGatewayError>>;
  deleteDrop(dropId: string): Promise<Result<void, LinguisticGatewayError>>;
  pollAdvancedJob<T = unknown>(
    jobId: string,
  ): Promise<
    Result<
      { readonly status: string; readonly stage?: string; readonly result?: T },
      LinguisticGatewayError
    >
  >;
}
