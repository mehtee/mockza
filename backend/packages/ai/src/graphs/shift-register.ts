import {
  RegisterShifterResultSchema,
  VerifyRepeatAloudResponseSchema,
} from '@mockza/contracts';
import { getExamRubricSpec, normalizeSupportedExamId } from '@mockza/domain';
import type { z } from 'zod';
import { EvaluationModelError } from '../errors.js';
import { OpenRouterAlphaClient, type DecisionQuestion } from '../models/openrouter-alpha.js';
import { OpenRouterClient, type OpenRouterMessage } from '../models/openrouter.js';
import { MODEL_REGISTRY } from '../models/registry.js';

export type RegisterShifterResult = z.infer<typeof RegisterShifterResultSchema>;
export type VerifyRepeatAloudResult = z.infer<typeof VerifyRepeatAloudResponseSchema>;

export interface ShiftRegisterInput {
  runId: string;
  edition: 'glb' | 'irn';
  examTrack: string;
  topicHint?: string;
  base64AudioData?: string;
  audioFormat?: 'm4a' | 'mp3' | 'wav';
  sourceTextFallback?: string;
}

export interface ShiftRegisterOptions {
  client?: Pick<OpenRouterClient, 'createChatCompletion'>;
  allowDemoEvaluator?: boolean;
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

/** Keeps repeatAloudTarget concise (<= 35 words) so learners can repeat it cleanly in one breath (ADR-ADV-005). */
function clampRepeatSentence(sentence: string): string {
  const words = sentence.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 35) return words.join(' ');
  return `${words.slice(0, 35).join(' ').replace(/[,;:]$/, '')}.`;
}

export function shiftRegisterDemoOnly(input: ShiftRegisterInput): RegisterShifterResult {
  const transcript =
    input.sourceTextFallback?.trim() ||
    'Today I watched a really good tech movie and it made me think a lot about AI at work.';
  const isIrn = input.edition === 'irn';

  return RegisterShifterResultSchema.parse({
    runId: input.runId,
    examTrack: input.examTrack,
    sourceTranscript: transcript,
    gears: {
      casual: transcript,
      workplace:
        'I watched a compelling technology film today, and it got me reflecting on how AI is reshaping our workflow.',
      academic:
        'A thought-provoking technology film I viewed today underscored how rapidly artificial intelligence is transforming modern workplaces.',
    },
    shiftHighlights: [
      {
        casualPhrase: 'really good',
        upgradedPhrase: 'compelling / thought-provoking',
        targetGear: 'academic',
        whyEn: 'Replaces vague evaluative modifiers ("really good") with precise Lexical Resource collocations.',
        whyFa: isIrn
          ? 'صفت کلی "really good" به کالوکیشن آکادمیک "thought-provoking" ارتقا یافت تا نمره Lexical Resource بالاتر برود.'
          : null,
      },
      {
        casualPhrase: 'think a lot about',
        upgradedPhrase: 'underscored how rapidly',
        targetGear: 'academic',
        whyEn: 'Uses an analytical reporting verb plus an adverbial intensifier for C1 academic tone.',
        whyFa: isIrn
          ? 'فعل تحلیلی "underscored" جایگزین عبارت محاوره‌ای "think a lot about" شد.'
          : null,
      },
    ],
    repeatAloudTarget: {
      gearLevel: 2,
      targetSentence:
        'A thought-provoking technology film I viewed today underscored how rapidly artificial intelligence is transforming modern workplaces.',
      targetPhrases: ['thought-provoking', 'underscored how rapidly'],
    },
  });
}

/**
 * Interactive 3-Gear Register Shifter (`Casual -> Workplace -> Academic`).
 * Runs STRICTLY on standard routing tier (never `:floor`) on `google/gemini-3.1-flash-lite` (`ADR-ADV-002`, `ADR-ADV-005`).
 */
export async function shiftRegisterGraph(
  input: ShiftRegisterInput,
  options: ShiftRegisterOptions = {},
): Promise<RegisterShifterResult> {
  const apiKey = process.env['OPENROUTER_API_KEY'] ?? '';
  if (!apiKey && options.allowDemoEvaluator) {
    return shiftRegisterDemoOnly(input);
  }
  if (!apiKey && !options.client) {
    throw new EvaluationModelError(
      'model_unavailable',
      'OPENROUTER_API_KEY missing for Register Shifter.',
      false,
    );
  }
  if (!input.base64AudioData && !input.sourceTextFallback) {
    throw new EvaluationModelError('audio_missing', 'Speaking audio clip is required.', false);
  }

  const examId = normalizeSupportedExamId(input.examTrack);
  const spec = getExamRubricSpec(examId, 'speaking');
  const client = options.client ?? new OpenRouterClient({ apiKey, timeoutMs: 25_000 });

  const editionNote =
    input.edition === 'irn'
      ? 'Keep sourceTranscript, all 3 gears, upgradedPhrase, targetSentence, whyEn, and targetPhrases in exact natural English. Write whyFa in encouraging Persian (fa-IR) explaining how the shift improves speaking/writing band score.'
      : 'Keep all fields in natural English; set whyFa to null.';

  const systemPrompt = [
    `You are an expert speaking coach anchoring Gear 2 to ${spec.promptLabel} (${spec.scale.label}: target Band 8.5 / C1+ speaking fluency).`,
    'Produce 3 authentic register variants preserving meaning AND speaking naturalness:',
    '1. casual: natural clean transcription of what the learner meant in everyday speech.',
    '2. workplace: crisp, polished colleague/standup English.',
    '3. academic: Band 8.5+ C1 spoken/academic register (precise collocations + cohesive framing, <= 35 words so it can be spoken aloud in one breath!).',
    editionNote,
    'Return ONLY JSON matching:',
    `{"runId":"${input.runId}","examTrack":"${input.examTrack}","sourceTranscript":"...","gears":{"casual":"...","workplace":"...","academic":"..."},"shiftHighlights":[{"casualPhrase":"...","upgradedPhrase":"...","targetGear":"workplace"|"academic","whyEn":"...","whyFa":null}],"repeatAloudTarget":{"gearLevel":2,"targetSentence":"...","targetPhrases":["..."]}}`,
  ].join('\n');

  const userContent: OpenRouterMessage['content'] = input.base64AudioData
    ? [
        {
          type: 'text',
          text: `Transcribe this casual learner audio and transform it into Casual, Workplace, and Academic (${spec.promptLabel}) registers.${input.topicHint ? ` Topic context: ${input.topicHint}` : ''}`,
        },
        {
          type: 'input_audio',
          input_audio: {
            data: input.base64AudioData,
            format: input.audioFormat ?? 'm4a',
          },
        },
      ]
    : `Learner statement:\n"${input.sourceTextFallback}"`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await client.createChatCompletion({
        model: MODEL_REGISTRY.speakingAudioPrimary,
        routingTier: 'standard',
        response_format: { type: 'json_object' },
        temperature: 0.25,
        max_tokens: 1200,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
          ...(attempt > 0
            ? [
                {
                  role: 'user' as const,
                  content: `Previous JSON failed validation (${String(lastError)}). Return valid JSON matching schema exactly.`,
                },
              ]
            : []),
        ],
      });

      const raw = stripJsonCodeFences(res.choices[0]?.message?.content ?? '{}');
      const jsonObj = JSON.parse(raw) as Record<string, unknown>;
      jsonObj['runId'] = input.runId;
      jsonObj['examTrack'] = input.examTrack;
      if (
        jsonObj['repeatAloudTarget'] &&
        typeof jsonObj['repeatAloudTarget'] === 'object' &&
        typeof (jsonObj['repeatAloudTarget'] as Record<string, unknown>)['targetSentence'] === 'string'
      ) {
        const rep = jsonObj['repeatAloudTarget'] as Record<string, unknown>;
        rep['targetSentence'] = clampRepeatSentence(String(rep['targetSentence']));
      }
      if (Array.isArray(jsonObj['shiftHighlights']) && jsonObj['shiftHighlights'].length > 4) {
        jsonObj['shiftHighlights'] = jsonObj['shiftHighlights'].slice(0, 4);
      }

      return RegisterShifterResultSchema.parse(jsonObj);
    } catch (err) {
      lastError = err;
    }
  }

  throw new EvaluationModelError(
    'model_invalid_output',
    `Register Shifter output failed schema validation: ${(lastError as Error)?.message ?? 'invalid json'}`,
    true,
  );
}

export interface VerifyRepeatAloudInput {
  runId: string;
  gearLevel: 1 | 2;
  expectedSentence: string;
  targetPhrases: string[];
  base64AudioData?: string;
  audioFormat?: 'm4a' | 'mp3' | 'wav';
  spokenTextFallback?: string;
}

export async function verifyRepeatAloud(
  input: VerifyRepeatAloudInput,
  options: { alphaClient?: OpenRouterAlphaClient; allowDemoEvaluator?: boolean } = {},
): Promise<VerifyRepeatAloudResult> {
  const apiKey = process.env['OPENROUTER_API_KEY'] ?? '';
  if (!apiKey && options.allowDemoEvaluator) {
    const sample = (input.spokenTextFallback ?? input.expectedSentence).toLowerCase();
    const matched = input.targetPhrases.filter((p) => sample.includes(p.toLowerCase()));
    return VerifyRepeatAloudResponseSchema.parse({
      runId: input.runId,
      matchedTargets: matched.length > 0 ? matched : input.targetPhrases.slice(0, 1),
      meaningPreserved: true,
      fluencyScore1To5: matched.length === input.targetPhrases.length ? 5 : 4,
      graphUpdated: true,
    });
  }

  if (!apiKey && !options.alphaClient) {
    throw new EvaluationModelError(
      'model_unavailable',
      'OPENROUTER_API_KEY missing for Repeat-Aloud verification.',
      false,
    );
  }

  const alphaClient = options.alphaClient ?? new OpenRouterAlphaClient({ apiKey });
  const boundedPhrases = input.targetPhrases.slice(0, 4);

  const questions: DecisionQuestion[] = [
    {
      id: 'meaning_preserved',
      kind: 'noul',
      prompt: `Does the learner clip convey the core meaning of "${input.expectedSentence}"?`,
    },
    ...boundedPhrases.map((phrase, idx) => ({
      id: `phrase_${idx}`,
      kind: 'noul' as const,
      prompt: `Did the speaker pronounce/use the target phrase "${phrase}" accurately?`,
    })),
    {
      id: 'fluency_1_to_5',
      kind: 'score',
      prompt: 'Rate clarity, pacing, and intelligibility from 1 (unclear) to 5 (fluent).',
      minScore: 1,
      maxScore: 5,
    },
  ];

  const userContent: OpenRouterMessage['content'] = input.base64AudioData
    ? [
        {
          type: 'text',
          text: `Target register sentence (Gear ${input.gearLevel}): "${input.expectedSentence}". Verify spoken audio transfer.`,
        },
        {
          type: 'input_audio',
          input_audio: {
            data: input.base64AudioData,
            format: input.audioFormat ?? 'm4a',
          },
        },
      ]
    : `Target sentence: "${input.expectedSentence}". Learner spoken transcript fallback: "${input.spokenTextFallback ?? ''}"`;

  const res = await alphaClient.callDecisionsApi({
    routingTier: 'standard',
    messages: [
      {
        role: 'system',
        content: 'Verify learner repeat-aloud muscle-memory transfer objectively.',
      },
      { role: 'user', content: userContent },
    ],
    questions,
  });

  const matchedTargets = boundedPhrases.filter(
    (_p, idx) => res.outcomes[`phrase_${idx}`]?.boolValue === true,
  );

  return VerifyRepeatAloudResponseSchema.parse({
    runId: input.runId,
    matchedTargets,
    meaningPreserved: res.outcomes['meaning_preserved']?.boolValue ?? true,
    fluencyScore1To5: res.outcomes['fluency_1_to_5']?.scoreValue ?? 4,
    graphUpdated: true,
  });
}
