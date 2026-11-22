import { EvaluationModelError } from '../errors.js';
import { MODEL_METADATA, resolveTtsDefaultVoice, resolveTtsModelId } from './registry.js';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | {
            type: 'image_url';
            image_url: {
              url: string;
            };
          }
        | {
            type: 'input_audio';
            input_audio: {
              data: string; // base64
              format: 'm4a' | 'mp3' | 'wav';
            };
          }
      >;
}

export interface AiUsageRecord {
  featureKind: string;
  modelId: string;
  providerRequestId?: string | null;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  totalTokens: number;
  estimatedCostUsdMicros: number;
  costUsdSource: 'openrouter_usage' | 'registry_estimate' | 'unknown';
  latencyMs: number;
  ttsCharacters?: number;
  audioDurationMs?: number;
}

export type AiUsageTelemetryCallback = (usage: AiUsageRecord) => void | Promise<void>;

export interface OpenRouterChatRequest {
  model: string;
  messages: OpenRouterMessage[];
  response_format?: { type: 'json_object' };
  temperature?: number;
  max_tokens?: number;
  /** Strictly opt-in ':floor' modifier for background async pg-boss queues ONLY (ADR-ADV-002). */
  routingTier?: 'standard' | 'flex';
  /** Optional feature tag for client-level usage callback. */
  featureKind?: string;
}

export interface OpenRouterChatResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cached_tokens?: number;
    prompt_tokens_details?: {
      cached_tokens?: number;
    };
    cost?: number;
  };
}

export interface OpenRouterSpeechRequest {
  text: string;
  model?: string;
  voice?: string;
  speed?: number;
  responseFormat?: 'mp3' | 'wav';
}

export interface OpenRouterSpeechResponse {
  audioBytes: Uint8Array;
  contentType: string;
  modelUsed: string;
  voice: string;
  characters: number;
  latencyMs: number;
  providerRequestId: string | null;
  estimatedCostUsdMicros: number;
}

export interface OpenRouterClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  onUsage?: AiUsageTelemetryCallback;
}

function resolvePricingOverride(modelId: string): { inputCostPer1M: number; outputCostPer1M: number } | null {
  const raw = process.env['OPENROUTER_PRICING_OVERRIDES_JSON']?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, { inputCostPer1M?: number; outputCostPer1M?: number }>;
    const clean = modelId.replace(/:floor$/, '');
    const entry = parsed[clean] ?? parsed[modelId];
    if (
      entry &&
      typeof entry.inputCostPer1M === 'number' &&
      typeof entry.outputCostPer1M === 'number'
    ) {
      return { inputCostPer1M: entry.inputCostPer1M, outputCostPer1M: entry.outputCostPer1M };
    }
  } catch {
    // Ignore invalid JSON override string
  }
  return null;
}

export function computeEstimatedCostUsdMicros(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
  openrouterReportedUsd?: number,
): { estimatedCostUsdMicros: number; costUsdSource: 'openrouter_usage' | 'registry_estimate' | 'unknown' } {
  if (typeof openrouterReportedUsd === 'number' && Number.isFinite(openrouterReportedUsd) && openrouterReportedUsd >= 0) {
    return {
      estimatedCostUsdMicros: Math.round(openrouterReportedUsd * 1_000_000),
      costUsdSource: 'openrouter_usage',
    };
  }
  const cleanId = modelId.replace(/:floor$/, '');
  const override = resolvePricingOverride(cleanId);
  const meta = override ?? MODEL_METADATA[cleanId];
  if (!meta) {
    return { estimatedCostUsdMicros: 0, costUsdSource: 'unknown' };
  }
  // USD per 1M tokens * tokens == exact USD micros!
  const micros = Math.round(
    promptTokens * meta.inputCostPer1M + completionTokens * meta.outputCostPer1M,
  );
  return {
    estimatedCostUsdMicros: Math.max(0, micros),
    costUsdSource: 'registry_estimate',
  };
}

export function buildAiUsageRecord(params: {
  featureKind: string;
  modelId: string;
  response?: Partial<OpenRouterChatResponse> | null;
  latencyMs: number;
}): AiUsageRecord {
  const usage = params.response?.usage;
  const promptTokens = Math.max(0, Math.round(usage?.prompt_tokens ?? 0));
  const completionTokens = Math.max(0, Math.round(usage?.completion_tokens ?? 0));
  const cachedTokens = Math.max(
    0,
    Math.round(usage?.prompt_tokens_details?.cached_tokens ?? usage?.cached_tokens ?? 0),
  );
  const totalTokens = Math.max(
    promptTokens + completionTokens,
    Math.round(usage?.total_tokens ?? 0),
  );
  const { estimatedCostUsdMicros, costUsdSource } = computeEstimatedCostUsdMicros(
    params.modelId,
    promptTokens,
    completionTokens,
    usage?.cost,
  );
  return {
    featureKind: params.featureKind,
    modelId: params.modelId,
    providerRequestId: typeof params.response?.id === 'string' ? params.response.id : null,
    promptTokens,
    completionTokens,
    cachedTokens,
    totalTokens,
    estimatedCostUsdMicros,
    costUsdSource,
    latencyMs: Math.max(0, Math.round(params.latencyMs)),
  };
}

/**
 * OpenRouter client with enforced provider data_collection: 'deny' (B5.2 / ADR-008)
 * and `usage: { include: true }` token + exact USD cost capture.
 */
export class OpenRouterClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly onUsage?: AiUsageTelemetryCallback;

  constructor(options: OpenRouterClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env['OPENROUTER_API_KEY'] ?? '';
    this.baseUrl = (options.baseUrl ?? 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 25_000;
    this.onUsage = options.onUsage;
  }

  async createChatCompletion(request: OpenRouterChatRequest): Promise<OpenRouterChatResponse> {
    const startMs = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const { routingTier, featureKind, ...wireRequest } = request;
    const resolvedModel =
      routingTier === 'flex' && !wireRequest.model.endsWith(':floor')
        ? `${wireRequest.model}:floor`
        : wireRequest.model;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://mockza.app',
          'X-Title': 'Mockza IELTS Prep',
        },
        body: JSON.stringify({
          ...wireRequest,
          model: resolvedModel,
          usage: {
            include: true,
          },
          // STRICT NO-RETENTION ROUTING
          provider: {
            data_collection: 'deny',
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const truncated = errorText.slice(0, 300);
        if (response.status === 429 || response.status >= 500) {
          throw new EvaluationModelError(
            'upstream_rate_limited',
            `OpenRouter API transient error (${response.status}): ${truncated}`,
            true,
          );
        }
        throw new EvaluationModelError(
          'model_unavailable',
          `OpenRouter API error (${response.status}): ${truncated}`,
          false,
        );
      }

      const rawJson = (await response.json()) as Partial<OpenRouterChatResponse>;
      if (
        !Array.isArray(rawJson?.choices) ||
        typeof rawJson.choices[0]?.message?.content !== 'string'
      ) {
        throw new EvaluationModelError(
          'model_invalid_output',
          'OpenRouter response missing choices[0].message.content.',
          true,
        );
      }
      if (this.onUsage) {
        const record = buildAiUsageRecord({
          featureKind: featureKind ?? 'chat_completion',
          modelId: wireRequest.model,
          response: rawJson,
          latencyMs: Date.now() - startMs,
        });
        await this.onUsage(record);
      }
      return rawJson as OpenRouterChatResponse;
    } catch (err) {
      if (err instanceof EvaluationModelError) {
        throw err;
      }
      const isAbort = err instanceof Error && err.name === 'AbortError';
      throw new EvaluationModelError(
        isAbort ? 'upstream_timeout' : 'model_unavailable',
        `OpenRouter request failed: ${(err as Error).message}`,
        true,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Calls OpenRouter Text-to-Speech (`/audio/speech`) using configurable model
   * (default `hexgrad/kokoro-82m`). Zero local OS TTS; all generation goes through OpenRouter API.
   */
  async createSpeech(request: OpenRouterSpeechRequest): Promise<OpenRouterSpeechResponse> {
    const startMs = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const resolvedModel = resolveTtsModelId(request.model);
    const resolvedVoice = resolveTtsDefaultVoice(request.voice);
    const format = request.responseFormat ?? 'mp3';
    const input = request.text.trim();

    if (!input) {
      throw new EvaluationModelError('model_invalid_output', 'TTS input text cannot be empty.', false);
    }

    try {
      const response = await fetch(`${this.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://mockza.app',
          'X-Title': 'Mockza Speech Synthesizer',
        },
        body: JSON.stringify({
          model: resolvedModel,
          input,
          voice: resolvedVoice,
          response_format: format,
          ...(typeof request.speed === 'number' ? { speed: request.speed } : {}),
          provider: {
            data_collection: 'deny',
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const truncated = errorText.slice(0, 300);
        if (response.status === 429 || response.status >= 500) {
          throw new EvaluationModelError(
            'upstream_rate_limited',
            `OpenRouter TTS transient error (${response.status}): ${truncated}`,
            true,
          );
        }
        throw new EvaluationModelError(
          'model_unavailable',
          `OpenRouter TTS error (${response.status}): ${truncated}`,
          false,
        );
      }

      const arrayBuf = await response.arrayBuffer();
      const audioBytes = new Uint8Array(arrayBuf);
      if (audioBytes.byteLength === 0) {
        throw new EvaluationModelError(
          'model_invalid_output',
          'OpenRouter TTS returned empty audio stream.',
          true,
        );
      }

      const latencyMs = Math.max(0, Date.now() - startMs);
      const providerRequestId =
        response.headers.get('x-request-id') ?? response.headers.get('openrouter-generation-id');
      const headerCostRaw = Number(response.headers.get('x-openrouter-cost') ?? '');
      // Kokoro-82m pricing estimate (~$0.0007 per 1k chars if upstream header omitted)
      const estimatedCostUsdMicros =
        Number.isFinite(headerCostRaw) && headerCostRaw >= 0
          ? Math.round(headerCostRaw * 1_000_000)
          : Math.max(1, Math.round(input.length * 0.7));

      if (this.onUsage) {
        await this.onUsage({
          featureKind: 'tts',
          modelId: resolvedModel,
          providerRequestId,
          promptTokens: 0,
          completionTokens: 0,
          cachedTokens: 0,
          totalTokens: 0,
          estimatedCostUsdMicros,
          costUsdSource:
            Number.isFinite(headerCostRaw) && headerCostRaw >= 0
              ? 'openrouter_usage'
              : 'registry_estimate',
          latencyMs,
          ttsCharacters: input.length,
        });
      }

      return {
        audioBytes,
        contentType: format === 'wav' ? 'audio/wav' : 'audio/mpeg',
        modelUsed: resolvedModel,
        voice: resolvedVoice,
        characters: input.length,
        latencyMs,
        providerRequestId,
        estimatedCostUsdMicros,
      };
    } catch (err) {
      if (err instanceof EvaluationModelError) {
        throw err;
      }
      const isAbort = err instanceof Error && err.name === 'AbortError';
      throw new EvaluationModelError(
        isAbort ? 'upstream_timeout' : 'model_unavailable',
        `OpenRouter TTS request failed: ${(err as Error).message}`,
        true,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
