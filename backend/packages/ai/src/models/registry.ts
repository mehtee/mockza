/**
 * Pinned OpenRouter model roster (ADR-008 / B5.2 + ADR-ADV-002).
 * Exam scoring routes stay strictly locked to System 2 calibrated GA models with ZERO fallback.
 * System 1 alpha routes carry explicit GA fallback targets wrapped by a sliding-window circuit breaker.
 */
export const MODEL_REGISTRY = {
  writingPrimary: 'deepseek/deepseek-v4.1-flash-1017',
  speakingAudioPrimary: 'google/gemini-3.1-flash-lite',
  pronunciationAudioPrimary: 'google/gemini-3.1-flash-lite',
  ttsDefault: 'hexgrad/kokoro-82m',
  drillFast: 'deepseek/deepseek-v4.1-flash-1017',
  missionPlanner: 'deepseek/deepseek-v4.1-flash-1017',
  system1Decision: 'google/gemini-decision-1',
  system1Extractor: 'cloudflare/clairic',
  rubricVersion: 'ielts-v2026-01',
} as const;

export function resolveTtsModelId(override?: string): string {
  const configured = override?.trim() || process.env['OPENROUTER_TTS_MODEL']?.trim();
  return configured && configured.length > 0 ? configured : MODEL_REGISTRY.ttsDefault;
}

export const KOKORO_ALLOWED_VOICES = {
  us: 'af_bella',
  uk: 'bf_emma',
  af_bella: 'af_bella',
  af_sarah: 'af_sarah',
  am_adam: 'am_adam',
  bf_emma: 'bf_emma',
  bm_george: 'bm_george',
} as const;

export function resolveTtsDefaultVoice(override?: string): string {
  const configured = override?.trim() || process.env['OPENROUTER_TTS_DEFAULT_VOICE']?.trim();
  if (!configured) return 'af_bella';
  const mapped = KOKORO_ALLOWED_VOICES[configured as keyof typeof KOKORO_ALLOWED_VOICES];
  return mapped ?? 'af_bella';
}

export function resolvePronunciationModelId(override?: string): string {
  const configured = override?.trim() || process.env['OPENROUTER_PRONUNCIATION_MODEL']?.trim();
  return configured && configured.length > 0
    ? configured
    : MODEL_REGISTRY.pronunciationAudioPrimary;
}

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
  'hexgrad/kokoro-82m': {
    id: 'hexgrad/kokoro-82m',
    supportsAudioInput: false,
    supportsImageInput: false,
    acceptedAudioFormats: ['mp3', 'wav'],
    supportsStructuredJsonSchema: false,
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    calibrated: true,
  },
};
