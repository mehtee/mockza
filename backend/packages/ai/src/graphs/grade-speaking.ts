import { type EvaluateSpeakingRequestSchema, EvaluationOutputSchema } from '@mockza/contracts';
import { computeOverallBandFromCriteria } from '@mockza/domain';
import type { z } from 'zod';
import { EvaluationModelError } from '../errors.js';
import { OpenRouterClient } from '../models/openrouter.js';
import { MODEL_REGISTRY } from '../models/registry.js';
import { renderPromptFromYaml } from '../prompts/loader.js';
import { validateAndExtractCriterionBands } from './rubric-validation.js';

export type SpeakingGraphInput = z.infer<typeof EvaluateSpeakingRequestSchema> & {
  base64AudioData?: string;
  turnAudios?: Array<{
    partIndex: number;
    promptText: string;
    base64AudioData: string;
    format?: 'm4a' | 'mp3' | 'wav';
  }>;
  inputText?: string;
};
export type SpeakingGraphOutput = z.infer<typeof EvaluationOutputSchema>;

export interface SpeakingInvokeOptions {
  client?: Pick<OpenRouterClient, 'createChatCompletion'>;
  allowDemoEvaluator?: boolean;
}

/**
 * Explicit non-production demo analyzer used only when `ALLOW_DEMO_EVALUATOR=true`
 * outside production. Never used as a fallback on missing audio or model failures.
 */
export function evaluateSpeakingDemoOnly(input: SpeakingGraphInput): SpeakingGraphOutput {
  const partIndex = input.turns?.[0]?.partIndex ?? 1;
  const baseBand = 6.0;
  const overallBand = computeOverallBandFromCriteria([baseBand, baseBand, baseBand, baseBand]);

  return EvaluationOutputSchema.parse({
    attemptId: input.attemptId,
    overallBand,
    isEstimated: true,
    criteria: [
      {
        code: 'FC',
        label: 'Fluency and Coherence',
        band: baseBand,
        evidenceExcerpt: 'Demo response segment.',
        feedbackNote: 'Demo preview output (AI grading key not enabled).',
      },
      {
        code: 'LR',
        label: 'Lexical Resource',
        band: baseBand,
        evidenceExcerpt: 'Demo response segment.',
        feedbackNote: 'Demo preview output (AI grading key not enabled).',
      },
      {
        code: 'GRA',
        label: 'Grammatical Range and Accuracy',
        band: baseBand,
        evidenceExcerpt: 'Demo response segment.',
        feedbackNote: 'Demo preview output (AI grading key not enabled).',
      },
      {
        code: 'PR',
        label: 'Pronunciation',
        band: baseBand,
        evidenceExcerpt: 'Demo response segment.',
        feedbackNote: 'Demo preview output (AI grading key not enabled).',
      },
    ],
    transcriptSegments: [
      {
        segmentId: 'demo-seg-1',
        partIndex,
        startMs: 0,
        endMs: 3000,
        text: 'Demo placeholder transcript (live transcription disabled).',
        annotations: [],
      },
    ],
    modelId: 'demo-heuristic-uncalibrated',
    rubricVersion: 'demo-non-production',
  });
}

/**
 * Multimodal audio grading workflow for IELTS Speaking.
 * Enforces real audio presence ([input_audio, text] part ordering) and fails closed
 * on missing API key, missing audio, or upstream errors.
 */
export const gradeSpeakingGraph = {
  name: 'grade_speaking',
  model: MODEL_REGISTRY.speakingAudioPrimary,
  async invoke(
    input: SpeakingGraphInput,
    options: SpeakingInvokeOptions = {},
  ): Promise<SpeakingGraphOutput> {
    const apiKey = process.env['OPENROUTER_API_KEY'];
    const isProd = process.env['NODE_ENV'] === 'production';
    const demoOptIn =
      !isProd && (options.allowDemoEvaluator ?? process.env['ALLOW_DEMO_EVALUATOR'] === 'true');

    if (!options.client && !apiKey) {
      if (demoOptIn) {
        return evaluateSpeakingDemoOnly(input);
      }
      throw new EvaluationModelError(
        'model_unavailable',
        'Speaking evaluator unavailable: OPENROUTER_API_KEY is not configured.',
        false,
      );
    }

    const audioEntries =
      input.turnAudios && input.turnAudios.length > 0
        ? input.turnAudios
        : input.base64AudioData
          ? [
              {
                partIndex: input.turns?.[0]?.partIndex ?? 1,
                promptText: input.turns?.[0]?.promptText ?? '',
                base64AudioData: input.base64AudioData,
                format: 'm4a' as const,
              },
            ]
          : [];

    if (audioEntries.length === 0 || audioEntries.some((entry) => !entry.base64AudioData)) {
      throw new EvaluationModelError(
        'audio_missing',
        'Speaking evaluation requires verified recorded audio for every turn.',
        false,
      );
    }

    const client = options.client ?? new OpenRouterClient({ apiKey });
    const promptDescriptions = audioEntries
      .map((entry, idx) => `Audio #${idx + 1} (Part ${entry.partIndex}): ${entry.promptText}`)
      .join('\n');

    const promptText = renderPromptFromYaml('speaking', {
      examId: input.examId,
      partSequence: input.partSequence,
      turnPrompts: promptDescriptions,
    });

    // STRICT PART ORDERING: input_audio placed BEFORE text prompt per B5.2
    const contentParts: Array<
      | { type: 'text'; text: string }
      | { type: 'input_audio'; input_audio: { data: string; format: 'm4a' | 'mp3' | 'wav' } }
    > = [
      ...audioEntries.map((entry) => ({
        type: 'input_audio' as const,
        input_audio: {
          data: entry.base64AudioData,
          format: entry.format ?? ('m4a' as const),
        },
      })),
      {
        type: 'text' as const,
        text: promptText,
      },
    ];

    const response = await client.createChatCompletion({
      model: MODEL_REGISTRY.speakingAudioPrimary,
      messages: [
        {
          role: 'user',
          content: contentParts,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const rawContent = response.choices[0]?.message.content ?? '';
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawContent) as Record<string, unknown>;
    } catch {
      throw new EvaluationModelError(
        'model_invalid_output',
        'Speaking model returned non-JSON content.',
        true,
      );
    }

    const assessment = isRecord(parsed['assessment']) ? parsed['assessment'] : null;
    if (assessment?.['status'] === 'unscorable') {
      const reason =
        typeof assessment['summary'] === 'string' && assessment['summary'].trim().length > 0
          ? assessment['summary'].trim()
          : 'Speaking recording could not be reliably scored.';
      throw new EvaluationModelError('audio_missing', reason, false);
    }

    const normalized = normalizeSpeakingModelOutput(parsed, input.turns?.[0]?.partIndex ?? 1);

    const bands = validateAndExtractCriterionBands({
      skill: 'speaking',
      rawCriteria: normalized['criteria'],
    });

    const overallBand = computeOverallBandFromCriteria(bands);

    const validated = EvaluationOutputSchema.safeParse({
      ...normalized,
      attemptId: input.attemptId,
      overallBand,
      isEstimated: true,
      modelId: MODEL_REGISTRY.speakingAudioPrimary,
      rubricVersion: MODEL_REGISTRY.rubricVersion,
    });

    if (!validated.success) {
      throw new EvaluationModelError(
        'model_invalid_output',
        'Speaking model JSON failed EvaluationOutputSchema validation.',
        true,
      );
    }

    return validated.data;
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mapIssueCategoryToAnnotationType(
  category: unknown,
): 'pause' | 'filler' | 'grammar' | 'phrasing' {
  if (category === 'fluency') return 'pause';
  if (category === 'grammar') return 'grammar';
  return 'phrasing';
}

/**
 * Normalizes rich v2 Speaking prompt JSON (`null` timestamps/IPA, structured issue annotations,
 * evidence arrays) into the wire `EvaluationOutputSchema` contract without losing compatibility.
 */
function normalizeSpeakingModelOutput(
  parsed: Record<string, unknown>,
  fallbackPartIndex: number,
): Record<string, unknown> {
  const rawIssues = Array.isArray(parsed['issues']) ? parsed['issues'].filter(isRecord) : [];
  const issuesById = new Map<string, Record<string, unknown>>();
  for (const issue of rawIssues) {
    if (typeof issue['id'] === 'string') {
      issuesById.set(issue['id'], issue);
    }
  }

  const rawCriteria = Array.isArray(parsed['criteria'])
    ? parsed['criteria'].map((item) => {
        if (!isRecord(item)) return item;
        const evidenceArr = Array.isArray(item['evidence'])
          ? item['evidence'].filter(isRecord)
          : [];
        const firstQuote =
          typeof evidenceArr[0]?.['quote'] === 'string' ? evidenceArr[0]['quote'].trim() : '';
        const evidenceExcerpt =
          typeof item['evidenceExcerpt'] === 'string' && item['evidenceExcerpt'].trim().length > 0
            ? item['evidenceExcerpt']
            : firstQuote;
        const strengths = Array.isArray(item['strengths'])
          ? item['strengths'].filter((s): s is string => typeof s === 'string')
          : [];
        const limitations = Array.isArray(item['limitations'])
          ? item['limitations'].filter((s): s is string => typeof s === 'string')
          : [];
        const fallbackNote = [...strengths, ...limitations].filter(Boolean).join(' ');
        const feedbackNote =
          typeof item['feedbackNote'] === 'string' && item['feedbackNote'].trim().length > 0
            ? item['feedbackNote']
            : fallbackNote;
        return {
          ...item,
          evidenceExcerpt,
          feedbackNote,
        };
      })
    : parsed['criteria'];

  const rawSegments = Array.isArray(parsed['transcriptSegments'])
    ? parsed['transcriptSegments'].filter(isRecord).map((seg) => {
        const rawAnnotations = Array.isArray(seg['annotations'])
          ? seg['annotations'].filter(isRecord)
          : [];
        const annotations = rawAnnotations.map((ann) => {
          if (typeof ann['type'] === 'string' && typeof ann['rationale'] === 'string') {
            return ann;
          }
          const linked =
            typeof ann['issueId'] === 'string' ? issuesById.get(ann['issueId']) : undefined;
          const suggestion =
            typeof linked?.['suggestedCorrection'] === 'string' &&
            linked['suggestedCorrection'].trim().length > 0
              ? linked['suggestedCorrection'].trim()
              : undefined;
          const note =
            typeof ann['note'] === 'string' && ann['note'].trim().length > 0
              ? ann['note'].trim()
              : typeof linked?.['explanation'] === 'string' &&
                  linked['explanation'].trim().length > 0
                ? linked['explanation'].trim()
                : 'Observed speaking issue';
          return {
            type: mapIssueCategoryToAnnotationType(ann['category'] ?? linked?.['category']),
            ...(suggestion ? { suggestion } : {}),
            rationale: note,
          };
        });
        return {
          segmentId: typeof seg['segmentId'] === 'string' ? seg['segmentId'] : 's1',
          partIndex:
            typeof seg['partIndex'] === 'number' && Number.isInteger(seg['partIndex'])
              ? seg['partIndex']
              : fallbackPartIndex,
          startMs: typeof seg['startMs'] === 'number' && seg['startMs'] >= 0 ? seg['startMs'] : 0,
          endMs: typeof seg['endMs'] === 'number' && seg['endMs'] >= 0 ? seg['endMs'] : 0,
          text: typeof seg['text'] === 'string' ? seg['text'] : '',
          annotations,
        };
      })
    : undefined;

  const rawVocab = Array.isArray(parsed['vocabUpgrades'])
    ? parsed['vocabUpgrades'].filter(isRecord).map((vocab) => ({
        id: typeof vocab['id'] === 'string' ? vocab['id'] : 'u1',
        term: typeof vocab['term'] === 'string' ? vocab['term'] : '',
        ...(typeof vocab['ipa'] === 'string' && vocab['ipa'].trim().length > 0
          ? { ipa: vocab['ipa'] }
          : {}),
        definition: typeof vocab['definition'] === 'string' ? vocab['definition'] : '',
        contextSentence:
          typeof vocab['contextSentence'] === 'string' ? vocab['contextSentence'] : '',
        paraphrases: Array.isArray(vocab['paraphrases'])
          ? vocab['paraphrases'].filter((p): p is string => typeof p === 'string')
          : [],
        bandRationale: typeof vocab['bandRationale'] === 'string' ? vocab['bandRationale'] : '',
      }))
    : [];

  let modelRewrite: Record<string, unknown> | undefined;
  if (isRecord(parsed['modelRewrite'])) {
    const rw = parsed['modelRewrite'];
    const targetBandDelta =
      typeof rw['targetBandDelta'] === 'number' && Number.isFinite(rw['targetBandDelta'])
        ? rw['targetBandDelta']
        : 1.5;
    modelRewrite = {
      targetBandDelta,
      title:
        typeof rw['title'] === 'string' && rw['title'].trim().length > 0
          ? rw['title']
          : 'Model Answer Rewrite',
      rewrittenText: typeof rw['rewrittenText'] === 'string' ? rw['rewrittenText'] : '',
      preservedIdeasNote:
        typeof rw['preservedIdeasNote'] === 'string' ? rw['preservedIdeasNote'] : '',
    };
  }

  let recommendedDrill: Record<string, unknown> | undefined;
  if (isRecord(parsed['recommendedDrill'])) {
    const drill = parsed['recommendedDrill'];
    const validCodes = new Set(['FC', 'LR', 'GRA', 'PR', 'TA', 'TR', 'CC']);
    const weakestFromCriteria = Array.isArray(rawCriteria)
      ? rawCriteria
          .filter(isRecord)
          .filter((c) => typeof c['band'] === 'number' && typeof c['code'] === 'string')
          .sort((a, b) => Number(a['band']) - Number(b['band']))[0]?.['code']
      : undefined;
    const rawWeakest = drill['weakestCriterionCode'];
    const weakestCriterionCode =
      typeof rawWeakest === 'string' && validCodes.has(rawWeakest)
        ? rawWeakest
        : typeof weakestFromCriteria === 'string' && validCodes.has(weakestFromCriteria)
          ? weakestFromCriteria
          : 'FC';
    recommendedDrill = {
      drillType:
        typeof drill['drillType'] === 'string' && drill['drillType'].trim().length > 0
          ? drill['drillType']
          : 'fluency_extended_response',
      weakestCriterionCode,
      title:
        typeof drill['title'] === 'string' && drill['title'].trim().length > 0
          ? drill['title']
          : 'Focused Speaking Drill',
      durationMinutes:
        typeof drill['durationMinutes'] === 'number' && Number.isFinite(drill['durationMinutes'])
          ? drill['durationMinutes']
          : 3,
    };
  }

  return {
    ...parsed,
    criteria: rawCriteria,
    ...(rawSegments ? { transcriptSegments: rawSegments } : {}),
    ...(modelRewrite ? { modelRewrite } : {}),
    vocabUpgrades: rawVocab,
    ...(recommendedDrill ? { recommendedDrill } : {}),
    ...(typeof parsed['actionableNextStep'] === 'string'
      ? { actionableNextStep: parsed['actionableNextStep'] }
      : {}),
  };
}
