import type {
  EvaluateSpeakingRequestSchema,
  EvaluateWritingRequestSchema,
  ExplainQuestionRequestSchema,
  ExplainQuestionResponseSchema,
  JobEnqueueResponseSchema,
  JobStatusResponseSchema,
  QuotaStatusResponseSchema,
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

export type EvaluateWritingInput = (typeof EvaluateWritingRequestSchema)['_output'];
export type EvaluateSpeakingInput = (typeof EvaluateSpeakingRequestSchema)['_output'];
export type JobEnqueueResponse = (typeof JobEnqueueResponseSchema)['_output'];
export type JobStatusResponse = (typeof JobStatusResponseSchema)['_output'];
export type QuotaStatusSnapshot = (typeof QuotaStatusResponseSchema)['_output'];
export type ExplainQuestionInput = (typeof ExplainQuestionRequestSchema)['_output'];
export type ExplainQuestionResponse = (typeof ExplainQuestionResponseSchema)['_output'];

export type EvaluationGatewayError =
  | NetworkError
  | UnauthorizedError
  | EntitlementRequiredError
  | QuotaExceededError
  | ValidationError
  | UnexpectedError;

export interface IEvaluationGateway {
  getQuotaStatus(): Promise<Result<QuotaStatusSnapshot, EvaluationGatewayError>>;
  submitWritingEvaluation(
    input: EvaluateWritingInput,
  ): Promise<Result<JobEnqueueResponse, EvaluationGatewayError>>;
  uploadSpeakingTurnAudio(params: {
    readonly attemptId: string;
    readonly partIndex: number;
    readonly turnId?: string;
    readonly clip: RecordedClip;
  }): Promise<Result<{ readonly objectKey: string }, EvaluationGatewayError>>;
  submitSpeakingEvaluation(
    input: EvaluateSpeakingInput,
  ): Promise<Result<JobEnqueueResponse, EvaluationGatewayError>>;
  pollEvaluationJob(jobId: string): Promise<Result<JobStatusResponse, EvaluationGatewayError>>;
  explainObjectiveQuestion(
    input: ExplainQuestionInput,
  ): Promise<Result<ExplainQuestionResponse, EvaluationGatewayError>>;
}
