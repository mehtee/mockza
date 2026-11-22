import { z } from 'zod';
import { EvaluationModelError } from '../errors.js';
import {
  type AiUsageRecord,
  type AiUsageTelemetryCallback,
  OpenRouterClient,
} from '../models/openrouter.js';
import { resolvePronunciationModelId } from '../models/registry.js';
import { emitChatUsage } from '../observability/usage-extract.js';
import { renderPromptFromYaml } from '../prompts/loader.js';

export const PronunciationWordFeedbackSchema = z.object({
  word: z.string(),
  status: z.enum(['accurate', 'needs_work', 'missing_or_extra']),
  ipaTarget: z.string().nullable().optional(),
  ipaObserved: z.string().nullable().optional(),
  issueType: z
    .enum(['stress', 'vowel', 'consonant', 'ending', 'omission', 'linking', 'none'])
    .default('none'),
  tipEn: z.string(),
  tipFa: z.string().nullable().optional(),
});

export const PronunciationAnalysisResultSchema = z.object({
  transcript: z.string(),
  accuracyScore: z.number().min(0).max(100),
  fluencyScore: z.number().min(0).max(100),
  intonationScore: z.number().min(0).max(100),
  stressScore: z.number().min(0).max(100),
  overallScore: z.number().min(0).max(100),
  bandImpactLabel: z.string(),
  summaryEn: z.string(),
  summaryFa: z.string().nullable().default(null),
  mouthTipEn: z.string(),
  mouthTipFa: z.string().nullable().default(null),
  actionableRetryEn: z.string(),
  actionableRetryFa: z.string().nullable().default(null),
  weaknessSignalKey: z.string().nullable().default(null),
  wordsFeedback: z.array(PronunciationWordFeedbackSchema).default([]),
  modelUsed: z.string(),
});

export type PronunciationAnalysisResult = z.infer<typeof PronunciationAnalysisResultSchema>;

export interface AnalyzePronunciationInput {
  edition: 'glb' | 'irn';
  examTrack: string;
  targetText: string;
  practiceKind: 'word' | 'sentence' | 'reading_excerpt' | 'feedback_shadow';
  base64AudioData: string;
  audioFormat?: 'm4a' | 'mp3' | 'wav';
}

export interface AnalyzePronunciationOptions {
  client?: Pick<OpenRouterClient, 'createChatCompletion'>;
  allowDemoEvaluator?: boolean;
  onUsage?: AiUsageTelemetryCallback;
  modelOverride?: string;
}

export interface AnalyzePronunciationOutput {
  result: PronunciationAnalysisResult;
  usage: AiUsageRecord | null;
}

function stripJsonCodeFences(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }
  return trimmed;
}

export function analyzePronunciationDemoOnly(
  input: AnalyzePronunciationInput,
): AnalyzePronunciationOutput {
  const isIrn = input.edition === 'irn';
  const words = input.targetText
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 14);
  const wordsFeedback = words.map((w, idx) => ({
    word: w.replace(/[.,!?;:"'()]/g, '') || w,
    status: (idx === Math.floor(words.length / 2) ? 'needs_work' : 'accurate') as
      | 'accurate'
      | 'needs_work',
    ipaTarget: null,
    ipaObserved: null,
    issueType: (idx === Math.floor(words.length / 2) ? 'stress' : 'none') as 'stress' | 'none',
    tipEn:
      idx === Math.floor(words.length / 2)
        ? 'Hit the primary stressed syllable slightly firmer and avoid clipping the final consonant.'
        : 'Clear articulation.',
    tipFa: isIrn
      ? idx === Math.floor(words.length / 2)
        ? 'روی هجای تکیه‌دار کمی واضح‌تر مکث کنید و حرف پایانی واژه را جا نیندازید.'
        : 'تلفظ واضح و طبیعی.'
      : null,
  }));

  const result = PronunciationAnalysisResultSchema.parse({
    transcript: input.targetText.trim(),
    accuracyScore: 84,
    fluencyScore: 82,
    intonationScore: 80,
    stressScore: 78,
    overallScore: 82,
    bandImpactLabel: 'Demo preview: Band 7.0–7.5 articulation profile',
    summaryEn:
      'Demo preview output (AI grading key not enabled): good overall intelligibility; sharpen primary syllable stress on multi-syllable words.',
    summaryFa: isIrn
      ? 'پیش‌نمایش دمو (کلید ارزیابی هوشمند فعال نیست): وضوح کلی گفتار خوب است؛ تکیه هجای اصلی واژگان چندبخشی را دقیق‌تر ادا کنید.'
      : null,
    mouthTipEn: 'Slow down by ~10% on stressed syllables and release final /t/ or /d/ lightly.',
    mouthTipFa: isIrn
      ? 'روی هجای دارای تکیه حدود ۱۰٪ آرام‌تر و پررنگ‌تر حرکت کنید و صامت‌های پایانی را کامل ببندید.'
      : null,
    actionableRetryEn: 'Listen once to the reference voice at 0.85x, then record one smooth take.',
    actionableRetryFa: isIrn
      ? 'یک‌بار صدای مرجع را با سرعت ۰.۸۵ گوش دهید و سپس یک ضبط پیوسته انجام دهید.'
      : null,
    weaknessSignalKey: 'phonetics:word_stress',
    wordsFeedback,
    modelUsed: 'demo-heuristic-uncalibrated',
  });

  return { result, usage: null };
}

/**
 * Evaluates learner pronunciation audio against target text using `google/gemini-3.1-flash-lite`
 * (or configured `OPENROUTER_PRONUNCIATION_MODEL`) with strict [input_audio, text] part ordering.
 */
export async function analyzePronunciationGraph(
  input: AnalyzePronunciationInput,
  options: AnalyzePronunciationOptions = {},
): Promise<AnalyzePronunciationOutput> {
  if (!input.base64AudioData || input.base64AudioData.trim().length === 0) {
    throw new EvaluationModelError(
      'audio_missing',
      'Pronunciation analysis requires recorded learner audio.',
      false,
    );
  }

  const apiKey = process.env['OPENROUTER_API_KEY'] ?? '';
  const isProd = process.env['NODE_ENV'] === 'production';
  const demoOptIn =
    !isProd && (options.allowDemoEvaluator ?? process.env['ALLOW_DEMO_EVALUATOR'] === 'true');

  if (!options.client && !apiKey) {
    if (demoOptIn) {
      return analyzePronunciationDemoOnly(input);
    }
    throw new EvaluationModelError(
      'model_unavailable',
      'Pronunciation analyzer unavailable: OPENROUTER_API_KEY is not configured.',
      false,
    );
  }

  const modelId = resolvePronunciationModelId(options.modelOverride);
  const client = options.client ?? new OpenRouterClient({ apiKey, timeoutMs: 25_000 });
  const isIrn = input.edition === 'irn';
  const editionGuidance = isIrn
    ? 'Keep transcript, ipaTarget, ipaObserved, wordsFeedback[].word, and bandImpactLabel in English/IPA. Write summaryFa, mouthTipFa, actionableRetryFa, and wordsFeedback[].tipFa in clear encouraging Persian (fa-IR) tailored to common Persian-speaker English transfer patterns (/θ/, /ð/, /w/ vs /v/, final consonant clusters, epenthetic vowels).'
    : 'Keep all prose crisp in natural English. Set summaryFa, mouthTipFa, actionableRetryFa, and wordsFeedback[].tipFa to null.';

  const promptText = renderPromptFromYaml('pronunciation_analysis', {
    practiceKind: input.practiceKind,
    targetText: input.targetText.trim(),
    examTrack: input.examTrack,
    editionGuidance,
  });

  const startedAt = Date.now();
  const response = await client.createChatCompletion({
    model: modelId,
    featureKind: 'pronunciation',
    messages: [
      {
        role: 'user',
        // STRICT PART ORDERING: input_audio BEFORE text prompt
        content: [
          {
            type: 'input_audio',
            input_audio: {
              data: input.base64AudioData,
              format: input.audioFormat ?? 'm4a',
            },
          },
          {
            type: 'text',
            text: promptText,
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 1400,
  });

  const usage = await emitChatUsage(
    'pronunciation',
    modelId,
    response,
    Date.now() - startedAt,
    options.onUsage,
  );

  let parsedRaw: Record<string, unknown>;
  try {
    parsedRaw = JSON.parse(stripJsonCodeFences(response.choices[0]?.message.content ?? '{}')) as Record<
      string,
      unknown
    >;
  } catch {
    throw new EvaluationModelError(
      'model_invalid_output',
      'Pronunciation analyzer returned non-JSON content.',
      true,
    );
  }

  const clampedScore = (val: unknown, fallback = 70): number =>
    typeof val === 'number' && Number.isFinite(val) ? Math.min(100, Math.max(0, Math.round(val))) : fallback;

  const accuracy = clampedScore(parsedRaw['accuracyScore'], 75);
  const fluency = clampedScore(parsedRaw['fluencyScore'], 75);
  const intonation = clampedScore(parsedRaw['intonationScore'], 75);
  const stress = clampedScore(parsedRaw['stressScore'], 75);
  const overall = clampedScore(
    parsedRaw['overallScore'],
    Math.round((accuracy * 0.4 + fluency * 0.25 + stress * 0.2 + intonation * 0.15)),
  );

  const rawWords = Array.isArray(parsedRaw['wordsFeedback']) ? parsedRaw['wordsFeedback'] : [];
  const normalizedWords = rawWords
    .filter((w): w is Record<string, unknown> => typeof w === 'object' && w !== null)
    .slice(0, 40)
    .map((w) => ({
      word: typeof w['word'] === 'string' ? w['word'] : '',
      status:
        w['status'] === 'accurate' || w['status'] === 'needs_work' || w['status'] === 'missing_or_extra'
          ? w['status']
          : 'accurate',
      ipaTarget: typeof w['ipaTarget'] === 'string' ? w['ipaTarget'] : null,
      ipaObserved: typeof w['ipaObserved'] === 'string' ? w['ipaObserved'] : null,
      issueType:
        w['issueType'] === 'stress' ||
        w['issueType'] === 'vowel' ||
        w['issueType'] === 'consonant' ||
        w['issueType'] === 'ending' ||
        w['issueType'] === 'omission' ||
        w['issueType'] === 'linking' ||
        w['issueType'] === 'none'
          ? w['issueType']
          : 'none',
      tipEn: typeof w['tipEn'] === 'string' && w['tipEn'].trim() ? w['tipEn'] : 'Pronounced clearly.',
      tipFa: isIrn && typeof w['tipFa'] === 'string' ? w['tipFa'] : null,
    }));

  const validated = PronunciationAnalysisResultSchema.safeParse({
    transcript:
      typeof parsedRaw['transcript'] === 'string' && parsedRaw['transcript'].trim()
        ? parsedRaw['transcript'].trim()
        : input.targetText.trim(),
    accuracyScore: accuracy,
    fluencyScore: fluency,
    intonationScore: intonation,
    stressScore: stress,
    overallScore: overall,
    bandImpactLabel:
      typeof parsedRaw['bandImpactLabel'] === 'string' && parsedRaw['bandImpactLabel'].trim()
        ? parsedRaw['bandImpactLabel']
        : overall >= 85
          ? 'Strong Band 8+ articulation clarity'
          : overall >= 72
            ? 'Clear Band 6.5–7.5 pronunciation'
            : 'Focus area for Band 6.0+ intelligibility',
    summaryEn:
      typeof parsedRaw['summaryEn'] === 'string' && parsedRaw['summaryEn'].trim()
        ? parsedRaw['summaryEn']
        : 'Recorded pronunciation evaluated against target phonetics and rhythm.',
    summaryFa: isIrn && typeof parsedRaw['summaryFa'] === 'string' ? parsedRaw['summaryFa'] : null,
    mouthTipEn:
      typeof parsedRaw['mouthTipEn'] === 'string' && parsedRaw['mouthTipEn'].trim()
        ? parsedRaw['mouthTipEn']
        : 'Keep stressed syllables steady and articulate final consonants cleanly.',
    mouthTipFa: isIrn && typeof parsedRaw['mouthTipFa'] === 'string' ? parsedRaw['mouthTipFa'] : null,
    actionableRetryEn:
      typeof parsedRaw['actionableRetryEn'] === 'string' && parsedRaw['actionableRetryEn'].trim()
        ? parsedRaw['actionableRetryEn']
        : 'Replay the target voice once, then record again matching stress and endings.',
    actionableRetryFa:
      isIrn && typeof parsedRaw['actionableRetryFa'] === 'string'
        ? parsedRaw['actionableRetryFa']
        : null,
    weaknessSignalKey:
      typeof parsedRaw['weaknessSignalKey'] === 'string' && parsedRaw['weaknessSignalKey'] !== 'null'
        ? parsedRaw['weaknessSignalKey']
        : null,
    wordsFeedback: normalizedWords,
    modelUsed: modelId,
  });

  if (!validated.success) {
    throw new EvaluationModelError(
      'model_invalid_output',
      'Pronunciation analyzer JSON failed schema validation.',
      true,
    );
  }

  return { result: validated.data, usage };
}
