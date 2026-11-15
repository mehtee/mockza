/**
 * Pinned OpenRouter model roster (ADR-008 / B5.2).
 * STRICTLY LOCKED with ZERO fallback models.
 */
export const MODEL_REGISTRY = {
  writingPrimary: 'deepseek/deepseek-v4.1-flash-1017',
  speakingAudioPrimary: 'google/gemini-3.1-flash-lite',
  drillFast: 'deepseek/deepseek-v4.1-flash-1017',
  rubricVersion: 'ielts-v2026-01',
} as const;

export interface ModelCapabilityMetadata {
  id: string;
  supportsAudioInput: boolean;
  acceptedAudioFormats: readonly string[];
  supportsStructuredJsonSchema: boolean;
  inputCostPer1M: number;
  outputCostPer1M: number;
  calibrated: boolean;
}

export const MODEL_METADATA: Record<string, ModelCapabilityMetadata> = {
  'google/gemini-3.1-flash-lite': {
    id: 'google/gemini-3.1-flash-lite',
    supportsAudioInput: true,
    acceptedAudioFormats: ['m4a', 'aac', 'mp3', 'wav'],
    supportsStructuredJsonSchema: true,
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.3,
    calibrated: true,
  },
  'deepseek/deepseek-v4.1-flash-1017': {
    id: 'deepseek/deepseek-v4.1-flash-1017',
    supportsAudioInput: false,
    acceptedAudioFormats: [],
    supportsStructuredJsonSchema: true,
    inputCostPer1M: 0.14,
    outputCostPer1M: 0.28,
    calibrated: true,
  },
};
