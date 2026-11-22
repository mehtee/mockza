import type { RecordedClip } from '@/gateways/audio.gateway';
import { err, ok, type Result } from '@/gateways/result';
import type {
  ISpeechPracticeGateway,
  PronunciationHistoryDto,
  PronunciationPracticeItemDto,
  SpeechPracticeGatewayError,
  TtsSynthesizeInput,
  TtsSynthesizeResult,
} from '@/gateways/speech-practice.gateway';
import type { ApiClient, ApiClientError } from './api-client';

function mapApiError(error: ApiClientError): SpeechPracticeGatewayError {
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

const MAX_BLOB_URL_CACHE_ENTRIES = 40;

export class HttpSpeechPracticeAdapter implements ISpeechPracticeGateway {
  private readonly apiClient: ApiClient;
  private readonly fetchFn: typeof fetch;
  private readonly blobUrlCache = new Map<string, string>();

  constructor(options: { readonly apiClient: ApiClient; readonly fetchFn?: typeof fetch }) {
    this.apiClient = options.apiClient;
    this.fetchFn =
      options.fetchFn ?? ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init));
  }

  private setBlobCacheEntry(key: string, url: string): void {
    if (this.blobUrlCache.has(key)) {
      this.blobUrlCache.delete(key);
    }
    while (this.blobUrlCache.size >= MAX_BLOB_URL_CACHE_ENTRIES) {
      const oldestKey = this.blobUrlCache.keys().next().value;
      if (!oldestKey) break;
      const oldestUrl = this.blobUrlCache.get(oldestKey);
      this.blobUrlCache.delete(oldestKey);
      if (oldestUrl && typeof URL.revokeObjectURL === 'function') {
        const stillReferenced = Array.from(this.blobUrlCache.values()).includes(oldestUrl);
        if (!stillReferenced) URL.revokeObjectURL(oldestUrl);
      }
    }
    this.blobUrlCache.set(key, url);
  }

  clearCache(): void {
    const uniqueUrls = new Set(this.blobUrlCache.values());
    this.blobUrlCache.clear();
    if (typeof URL.revokeObjectURL === 'function') {
      for (const u of uniqueUrls) URL.revokeObjectURL(u);
    }
  }

  async synthesizeTts(
    input: TtsSynthesizeInput,
  ): Promise<Result<{ readonly audioUrl: string; readonly meta: TtsSynthesizeResult }, SpeechPracticeGatewayError>> {
    const cacheSig = `${input.voice ?? 'default'}|${input.speed ?? 1}|${input.text.trim()}`;
    const res = await this.apiClient.post<TtsSynthesizeResult>('/v1/tts/synthesize', input, {
      timeoutMs: 25_000,
    });
    if (!res.ok) {
      return err(mapApiError(res.error));
    }

    const existingUrl = this.blobUrlCache.get(res.value.audioUrl) ?? this.blobUrlCache.get(cacheSig);
    if (existingUrl) {
      return ok({ audioUrl: existingUrl, meta: res.value });
    }

    const bin = await this.apiClient.fetchBinary(res.value.audioUrl);
    if (!bin.ok) {
      return err(mapApiError(bin.error));
    }
    const objUrl = URL.createObjectURL(bin.value.blob);
    this.setBlobCacheEntry(res.value.audioUrl, objUrl);
    this.setBlobCacheEntry(cacheSig, objUrl);
    return ok({ audioUrl: objUrl, meta: res.value });
  }

  async submitPronunciationPractice(params: {
    readonly targetText: string;
    readonly practiceKind: 'word' | 'sentence' | 'reading_excerpt' | 'feedback_shadow';
    readonly sourceRefType?:
      | 'vocab_card'
      | 'reading_passage'
      | 'listening_feedback'
      | 'writing_feedback'
      | 'speaking_feedback'
      | 'coach'
      | 'custom';
    readonly sourceRefId?: string;
    readonly examTrack: string;
    readonly clip: RecordedClip;
  }): Promise<Result<PronunciationPracticeItemDto, SpeechPracticeGatewayError>> {
    const practiceId = crypto.randomUUID();
    const presignRes = await this.apiClient.post<{
      readonly uploadUrl: string;
      readonly objectKey: string;
    }>('/v1/pronunciation/presign', {
      practiceId,
      byteLength: params.clip.byteLength,
      contentType: params.clip.strippedContentType,
    });
    if (!presignRes.ok) {
      return err(mapApiError(presignRes.error));
    }

    try {
      const putRes = await this.fetchFn(presignRes.value.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': params.clip.strippedContentType },
        body: params.clip.blob,
      });
      if (!putRes.ok) {
        return err({
          kind: 'network',
          message: `Pronunciation audio upload failed (HTTP ${putRes.status})`,
          retryable: true,
          status: putRes.status,
        });
      }
    } catch (cause) {
      return err({
        kind: 'network',
        message: cause instanceof Error ? cause.message : 'Upload error',
        retryable: true,
      });
    }

    const analyzeRes = await this.apiClient.post<{
      readonly jobId: string;
      readonly status: string;
    }>(
      '/v1/pronunciation/analyze',
      {
        practiceId,
        targetText: params.targetText,
        practiceKind: params.practiceKind,
        ...(params.sourceRefType ? { sourceRefType: params.sourceRefType } : {}),
        ...(params.sourceRefId ? { sourceRefId: params.sourceRefId } : {}),
        examTrack: params.examTrack,
        objectKey: presignRes.value.objectKey,
        durationMs: params.clip.durationMs,
      },
      { timeoutMs: 30_000 },
    );
    if (!analyzeRes.ok) {
      return err(mapApiError(analyzeRes.error));
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < 45_000) {
      const single = await this.apiClient.get<PronunciationPracticeItemDto>(
        `/v1/pronunciation/${encodeURIComponent(practiceId)}`,
      );
      if (single.ok) {
        if (single.value.status === 'completed') {
          return ok(single.value);
        }
        if (single.value.status === 'failed') {
          return err({
            kind: 'unexpected',
            message: single.value.errorMessage ?? 'Pronunciation analysis failed on server.',
          });
        }
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    return err({
      kind: 'network',
      message: 'Pronunciation analysis timed out; check history shortly.',
      retryable: true,
    });
  }

  async listPronunciationHistory(params?: {
    readonly sourceRefId?: string;
    readonly limit?: number;
    readonly cursor?: string;
  }): Promise<Result<PronunciationHistoryDto, SpeechPracticeGatewayError>> {
    const qs = new URLSearchParams();
    if (params?.sourceRefId) qs.set('sourceRefId', params.sourceRefId);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.cursor) qs.set('cursor', params.cursor);
    const path = qs.toString()
      ? `/v1/pronunciation/history?${qs.toString()}`
      : '/v1/pronunciation/history';
    const res = await this.apiClient.get<PronunciationHistoryDto>(path);
    return res.ok ? ok(res.value) : err(mapApiError(res.error));
  }

  async resolveAuthenticatedAudioUrl(
    relativeAudioPath: string,
  ): Promise<Result<string, SpeechPracticeGatewayError>> {
    const cached = this.blobUrlCache.get(relativeAudioPath);
    if (cached) return ok(cached);
    const bin = await this.apiClient.fetchBinary(relativeAudioPath);
    if (!bin.ok) return err(mapApiError(bin.error));
    const url = URL.createObjectURL(bin.value.blob);
    this.setBlobCacheEntry(relativeAudioPath, url);
    return ok(url);
  }
}
