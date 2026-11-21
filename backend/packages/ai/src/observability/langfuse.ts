import { Langfuse } from 'langfuse';

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const UUID_REGEX = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const PHONE_REGEX = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const BASE64_AUDIO_REGEX = /data:audio\/[a-z0-9]+;base64,[A-Za-z0-9+/=]+/gi;

/**
 * Pre-export PII masking filter for Langfuse traces (B5.5 / ADR-011).
 * Scrubs emails, device UUIDs, phone numbers, and raw audio bytes.
 */
export function maskPiiText(input: string): string {
  if (!input) return input;
  return input
    .replace(BASE64_AUDIO_REGEX, '[BASE64_AUDIO_REDACTED]')
    .replace(EMAIL_REGEX, '[REDACTED_EMAIL]')
    .replace(UUID_REGEX, '[REDACTED_UUID]')
    .replace(PHONE_REGEX, '[REDACTED_PHONE]');
}

const SENSITIVE_CONTENT_KEYS = new Set([
  'droppedtext',
  'sourceurl',
  'sourcetext',
  'rawtext',
  'imagebase64',
  'imagedata',
  'image_url',
  'imageurls',
  'mediaurl',
  'transcript',
  'audio',
  'audiodata',
]);

/** Recursively scrubs PII and private dropped/audio content from input/output telemetry payloads. */
export function maskPiiObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    if (obj.startsWith('data:image/') || obj.startsWith('data:audio/')) {
      return '[MEDIA_DATA_URI_REDACTED]' as unknown as T;
    }
    // If large base64 string
    if (obj.length > 200 && /^[A-Za-z0-9+/=\r\n]+$/.test(obj.slice(0, 100))) {
      return '[BASE64_DATA_REDACTED]' as unknown as T;
    }
    return maskPiiText(obj) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => maskPiiObject(item)) as unknown as T;
  }
  if (obj && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      const normalizedKey = key.toLowerCase();
      if (normalizedKey.includes('audio') && typeof val === 'string' && val.length > 50) {
        sanitized[key] = '[AUDIO_BLOB_REDACTED]';
      } else if (
        SENSITIVE_CONTENT_KEYS.has(normalizedKey) &&
        typeof val === 'string' &&
        val.length > 80
      ) {
        sanitized[key] = '[PRIVATE_CONTENT_REDACTED]';
      } else {
        sanitized[key] = maskPiiObject(val);
      }
    }
    return sanitized as T;
  }
  return obj;
}

export interface TraceExecutionParams {
  name: string;
  modelId: string;
  rubricVersion: string;
  input: unknown;
  output?: unknown;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  repairCount?: number;
  estimatedCostUsdMicros?: number;
}

export function createTelemetryTracer(params: {
  secretKey: string;
  publicKey: string;
  baseUrl: string;
}): {
  langfuse: Langfuse | null;
  recordTrace: (data: TraceExecutionParams) => void;
} {
  const isConfigured = Boolean(params.secretKey && params.publicKey);
  const langfuse = isConfigured
    ? new Langfuse({
        secretKey: params.secretKey,
        publicKey: params.publicKey,
        baseUrl: params.baseUrl,
      })
    : null;

  const recordTrace = (data: TraceExecutionParams): void => {
    if (!langfuse) return;
    try {
      const trace = langfuse.trace({
        name: data.name,
        metadata: {
          modelId: data.modelId,
          rubricVersion: data.rubricVersion,
          repairCount: data.repairCount ?? 0,
        },
        input: maskPiiObject(data.input),
        output: data.output ? maskPiiObject(data.output) : undefined,
      });

      trace.generation({
        name: `${data.name}_generation`,
        model: data.modelId,
        usage: {
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          totalTokens: (data.promptTokens ?? 0) + (data.completionTokens ?? 0),
        },
      });
    } catch (_err) {
      // Non-fatal telemetry error
    }
  };

  return { langfuse, recordTrace };
}
