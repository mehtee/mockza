/**
 * Pinned OpenRouter model roster (ADR-008 / B5.2 + ADR-ADV-002).
 * Exam scoring routes stay strictly locked to System 2 calibrated GA models with ZERO fallback.
 * System 1 alpha routes carry explicit GA fallback targets wrapped by a sliding-window circuit breaker.
 */
export const MODEL_REGISTRY = {
  writingPrimary: 'deepseek/deepseek-v4.1-flash-1017',
  speakingAudioPrimary: 'google/gemini-3.1-flash-lite',
  drillFast: 'deepseek/deepseek-v4.1-flash-1017',
  missionPlanner: 'deepseek/deepseek-v4.1-flash-1017',
  system1Decision: 'google/gemini-decision-1',
  system1Extractor: 'cloudflare/clairic',
  rubricVersion: 'ielts-v2026-01',
} as const;

export const ALPHA_FALLBACK_REGISTRY = {
  'google/gemini-decision-1': {
    text: 'deepseek/deepseek-v4.1-flash-1017',
    multimodal: 'google/gemini-3.1-flash-lite',
  },
  'cloudflare/clairic': {
    text: 'deepseek/deepseek-v4.1-flash-1017',
    image: 'google/gemini-3.1-flash-lite',
  },
} as const;

export interface ModelCapabilityMetadata {
  id: string;
  supportsAudioInput: boolean;
  supportsImageInput?: boolean;
  acceptedAudioFormats: readonly string[];
  supportsStructuredJsonSchema: boolean;
  inputCostPer1M: number;
  outputCostPer1M: number;
  calibrated: boolean;
  isAlpha?: boolean;
}

export const MODEL_METADATA: Record<string, ModelCapabilityMetadata> = {
  'google/gemini-3.1-flash-lite': {
    id: 'google/gemini-3.1-flash-lite',
    supportsAudioInput: true,
    supportsImageInput: true,
    acceptedAudioFormats: ['m4a', 'aac', 'mp3', 'wav'],
    supportsStructuredJsonSchema: true,
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.3,
    calibrated: true,
  },
  'deepseek/deepseek-v4.1-flash-1017': {
    id: 'deepseek/deepseek-v4.1-flash-1017',
    supportsAudioInput: false,
    supportsImageInput: false,
    acceptedAudioFormats: [],
    supportsStructuredJsonSchema: true,
    inputCostPer1M: 0.14,
    outputCostPer1M: 0.28,
    calibrated: true,
  },
  'google/gemini-decision-1': {
    id: 'google/gemini-decision-1',
    supportsAudioInput: true,
    supportsImageInput: true,
    acceptedAudioFormats: ['m4a', 'aac', 'mp3', 'wav'],
    supportsStructuredJsonSchema: true,
    inputCostPer1M: 0.1,
    outputCostPer1M: 0,
    calibrated: false,
    isAlpha: true,
  },
  'cloudflare/clairic': {
    id: 'cloudflare/clairic',
    supportsAudioInput: false,
    supportsImageInput: true,
    acceptedAudioFormats: [],
    supportsStructuredJsonSchema: true,
    inputCostPer1M: 0.1,
    outputCostPer1M: 0,
    calibrated: false,
    isAlpha: true,
  },
};
