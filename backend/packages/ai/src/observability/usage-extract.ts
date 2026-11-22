import {
  buildAiUsageRecord,
  type AiUsageRecord,
  type AiUsageTelemetryCallback,
  type OpenRouterChatResponse,
} from '../models/openrouter.js';

export interface TelemetryOptions {
  onUsage?: AiUsageTelemetryCallback;
}

export async function emitChatUsage(
  featureKind: string,
  modelId: string,
  response: Partial<OpenRouterChatResponse> | null | undefined,
  latencyMs: number,
  onUsage?: AiUsageTelemetryCallback,
): Promise<AiUsageRecord> {
  const record = buildAiUsageRecord({
    featureKind,
    modelId,
    response,
    latencyMs,
  });
  if (onUsage) {
    await onUsage(record);
  }
  return record;
}
