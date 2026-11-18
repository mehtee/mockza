import type {
  CreateDiagnosticSessionInput,
  DiagnosticBankDto,
  DiagnosticGatewayError,
  DiagnosticSessionDto,
  IDiagnosticGateway,
  RetakeDiagnosticSkillInput,
  SubmitDiagnosticSessionInput,
} from '@/gateways/diagnostic.gateway';
import { err, ok, type Result } from '@/gateways/result';
import type { ApiClient, ApiClientError } from './api-client';
import { uploadPresignedAudioClip } from './presigned-audio-upload';

function mapApiErrorToDiagnosticError(error: ApiClientError): DiagnosticGatewayError {
  switch (error.kind) {
    case 'network':
    case 'unauthorized':
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

export class HttpDiagnosticAdapter implements IDiagnosticGateway {
  private readonly apiClient: ApiClient;
  private readonly fetchFn: typeof fetch;

  constructor(options: { readonly apiClient: ApiClient; readonly fetchFn?: typeof fetch }) {
    this.apiClient = options.apiClient;
    this.fetchFn =
      options.fetchFn ??
      ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init));
  }

  async fetchDiagnosticBank(): Promise<Result<DiagnosticBankDto, DiagnosticGatewayError>> {
    const res = await this.apiClient.get<DiagnosticBankDto>('/v1/diagnostic/packs');
    return res.ok ? ok(res.value) : err(mapApiErrorToDiagnosticError(res.error));
  }

  async createSession(
    input: CreateDiagnosticSessionInput,
  ): Promise<Result<DiagnosticSessionDto, DiagnosticGatewayError>> {
    const res = await this.apiClient.post<DiagnosticSessionDto>('/v1/diagnostic/sessions', input);
    return res.ok ? ok(res.value) : err(mapApiErrorToDiagnosticError(res.error));
  }

  async submitSession(
    diagId: string,
    input: SubmitDiagnosticSessionInput,
  ): Promise<Result<DiagnosticSessionDto, DiagnosticGatewayError>> {
    const res = await this.apiClient.post<DiagnosticSessionDto>(
      `/v1/diagnostic/sessions/${encodeURIComponent(diagId)}/submit`,
      input,
    );
    return res.ok ? ok(res.value) : err(mapApiErrorToDiagnosticError(res.error));
  }

  async getSession(diagId: string): Promise<Result<DiagnosticSessionDto, DiagnosticGatewayError>> {
    const res = await this.apiClient.get<DiagnosticSessionDto>(
      `/v1/diagnostic/sessions/${encodeURIComponent(diagId)}`,
    );
    return res.ok ? ok(res.value) : err(mapApiErrorToDiagnosticError(res.error));
  }

  async retakeSkill(
    diagId: string,
    input: RetakeDiagnosticSkillInput,
  ): Promise<Result<DiagnosticSessionDto, DiagnosticGatewayError>> {
    const res = await this.apiClient.post<DiagnosticSessionDto>(
      `/v1/diagnostic/sessions/${encodeURIComponent(diagId)}/retake-skill`,
      input,
    );
    return res.ok ? ok(res.value) : err(mapApiErrorToDiagnosticError(res.error));
  }

  async uploadSpeakingTurnAudio(params: {
    readonly attemptId: string;
    readonly partIndex: number;
    readonly clip: import('@/gateways/audio.gateway').RecordedClip;
  }): Promise<Result<{ readonly objectKey: string }, DiagnosticGatewayError>> {
    const res = await uploadPresignedAudioClip({
      apiClient: this.apiClient,
      fetchFn: this.fetchFn,
      ...params,
    });
    return res.ok ? res : err(mapApiErrorToDiagnosticError(res.error));
  }
}
