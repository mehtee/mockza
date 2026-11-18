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
    const presignRes = await this.apiClient.post<{
      readonly uploadUrl: string;
      readonly objectKey: string;
    }>('/v1/uploads/presign', {
      attemptId: params.attemptId,
      partIndex: params.partIndex,
      byteLength: params.clip.byteLength,
      contentType: params.clip.strippedContentType,
    });
    if (!presignRes.ok) {
      return err(mapApiErrorToDiagnosticError(presignRes.error));
    }

    try {
      const putResponse = await this.fetchFn(presignRes.value.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': params.clip.strippedContentType },
        body: params.clip.blob,
      });
      if (!putResponse.ok) {
        return err({
          kind: 'network',
          status: putResponse.status,
          retryable: true,
          message: `Diagnostic audio upload failed with HTTP ${putResponse.status}`,
        });
      }
      return ok({ objectKey: presignRes.value.objectKey });
    } catch (cause) {
      return err({
        kind: 'network',
        retryable: true,
        message: cause instanceof Error ? cause.message : 'Diagnostic audio upload network error',
      });
    }
  }
}
