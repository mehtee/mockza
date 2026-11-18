import type { RecordedClip } from '@/gateways/audio.gateway';
import type {
  EvaluateSpeakingInput,
  EvaluateWritingInput,
  EvaluationGatewayError,
  ExplainQuestionInput,
  ExplainQuestionResponse,
  IEvaluationGateway,
  JobEnqueueResponse,
  JobStatusResponse,
  QuotaStatusSnapshot,
} from '@/gateways/evaluation.gateway';
import { err, ok, type Result } from '@/gateways/result';
import type { ApiClient, ApiClientError } from './api-client';
import { uploadPresignedAudioClip } from './presigned-audio-upload';

function mapApiErrorToEvaluationError(error: ApiClientError): EvaluationGatewayError {
  switch (error.kind) {
    case 'network':
    case 'unauthorized':
    case 'entitlement_required':
    case 'quota_exceeded':
    case 'validation':
      return error;
    default:
      return {
        kind: 'unexpected',
        message: error.message,
        cause: error,
      };
  }
}

export class HttpEvaluationAdapter implements IEvaluationGateway {
  private readonly apiClient: ApiClient;
  private readonly fetchFn: typeof fetch;

  constructor(options: { readonly apiClient: ApiClient; readonly fetchFn?: typeof fetch }) {
    this.apiClient = options.apiClient;
    this.fetchFn =
      options.fetchFn ??
      ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init));
  }

  async getQuotaStatus(): Promise<Result<QuotaStatusSnapshot, EvaluationGatewayError>> {
    const res = await this.apiClient.get<QuotaStatusSnapshot>('/v1/quota');
    return res.ok ? ok(res.value) : err(mapApiErrorToEvaluationError(res.error));
  }

  async submitWritingEvaluation(
    input: EvaluateWritingInput,
  ): Promise<Result<JobEnqueueResponse, EvaluationGatewayError>> {
    const res = await this.apiClient.post<JobEnqueueResponse>('/v1/evaluate/writing', input);
    return res.ok ? ok(res.value) : err(mapApiErrorToEvaluationError(res.error));
  }

  async uploadSpeakingTurnAudio(params: {
    readonly attemptId: string;
    readonly partIndex: number;
    readonly turnId?: string;
    readonly clip: RecordedClip;
  }): Promise<Result<{ readonly objectKey: string }, EvaluationGatewayError>> {
    const res = await uploadPresignedAudioClip({
      apiClient: this.apiClient,
      fetchFn: this.fetchFn,
      ...params,
    });
    return res.ok ? res : err(mapApiErrorToEvaluationError(res.error));
  }

  async submitSpeakingEvaluation(
    input: EvaluateSpeakingInput,
  ): Promise<Result<JobEnqueueResponse, EvaluationGatewayError>> {
    const res = await this.apiClient.post<JobEnqueueResponse>('/v1/evaluate/speaking', input);
    return res.ok ? ok(res.value) : err(mapApiErrorToEvaluationError(res.error));
  }

  async pollEvaluationJob(
    jobId: string,
  ): Promise<Result<JobStatusResponse, EvaluationGatewayError>> {
    const res = await this.apiClient.get<JobStatusResponse>(
      `/v1/jobs/${encodeURIComponent(jobId)}`,
    );
    return res.ok ? ok(res.value) : err(mapApiErrorToEvaluationError(res.error));
  }

  async explainObjectiveQuestion(
    input: ExplainQuestionInput,
  ): Promise<Result<ExplainQuestionResponse, EvaluationGatewayError>> {
    const res = await this.apiClient.post<ExplainQuestionResponse>(
      '/v1/evaluate/explain-question',
      input,
    );
    return res.ok ? ok(res.value) : err(mapApiErrorToEvaluationError(res.error));
  }
}
