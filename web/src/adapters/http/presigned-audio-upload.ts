import type { RecordedClip } from '@/gateways/audio.gateway';
import { err, ok, type NetworkError, type Result } from '@/gateways/result';
import type { ApiClient, ApiClientError } from './api-client';

export async function uploadPresignedAudioClip(params: {
  readonly apiClient: ApiClient;
  readonly fetchFn: typeof fetch;
  readonly attemptId: string;
  readonly partIndex: number;
  readonly turnId?: string;
  readonly clip: RecordedClip;
}): Promise<Result<{ readonly objectKey: string }, ApiClientError | NetworkError>> {
  const presignRes = await params.apiClient.post<{
    readonly uploadUrl: string;
    readonly objectKey: string;
  }>('/v1/uploads/presign', {
    attemptId: params.attemptId,
    partIndex: params.partIndex,
    ...(params.turnId ? { turnId: params.turnId } : {}),
    byteLength: params.clip.byteLength,
    contentType: params.clip.strippedContentType,
  });

  if (!presignRes.ok) {
    return err(presignRes.error);
  }

  try {
    const putResponse = await params.fetchFn(presignRes.value.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': params.clip.strippedContentType },
      body: params.clip.blob,
    });
    if (!putResponse.ok) {
      return err({
        kind: 'network',
        status: putResponse.status,
        retryable: true,
        message: `Audio upload failed with HTTP ${putResponse.status}`,
      });
    }
    return ok({ objectKey: presignRes.value.objectKey });
  } catch (cause) {
    return err({
      kind: 'network',
      retryable: true,
      message: cause instanceof Error ? cause.message : 'Audio upload network error',
    });
  }
}
