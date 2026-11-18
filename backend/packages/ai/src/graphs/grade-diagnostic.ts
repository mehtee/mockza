import { z } from 'zod';
import { EvaluationModelError } from '../errors.js';
import { OpenRouterClient } from '../models/openrouter.js';
import { MODEL_REGISTRY } from '../models/registry.js';
import { renderPromptFromYaml } from '../prompts/loader.js';
import { buildEditionOverlayAppendix } from '../prompts/rubrics.js';

export const DiagnosticTierHintSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

export const DiagnosticWritingResultSchema = z.object({
  skill: z.literal('writing'),
  status: z.enum(['provisional', 'insufficient_evidence', 'unscorable']),
  suggestedPracticeLevel: z.string().nullable(),
  tierHint: DiagnosticTierHintSchema.nullable(),
  observations: z.array(z.string()).max(3),
  weaknessFocus: z.string().nullable().default(null),
  recommendedDrillType: z.string().nullable().default(null),
  evidenceExcerpts: z.array(z.string()).default([]),
  modelId: z.string(),
  rubricVersion: z.string(),
});

export const DiagnosticSpeakingResultSchema = z.object({
  skill: z.literal('speaking'),
  status: z.enum(['provisional', 'insufficient_evidence', 'unscorable']),
  suggestedPracticeLevel: z.string().nullable(),
  tierHint: DiagnosticTierHintSchema.nullable(),
  transcriptSummary: z.string().nullable().default(null),
  observations: z.array(z.string()).max(3),
  weaknessFocus: z.string().nullable().default(null),
  recommendedDrillType: z.string().nullable().default(null),
  audioIssueNote: z.string().nullable().default(null),
  modelId: z.string(),
  rubricVersion: z.string(),
});

export type DiagnosticWritingResult = z.infer<typeof DiagnosticWritingResultSchema>;
export type DiagnosticSpeakingResult = z.infer<typeof DiagnosticSpeakingResultSchema>;

export interface DiagnosticWritingInput {
  attemptId: string;
  edition?: 'glb' | 'irn';
  promptTitle: string;
  basePrompt: string;
  followUpPrompt?: string;
  baseResponse: string;
  followUpResponse?: string;
}

export interface DiagnosticSpeakingInput {
  attemptId: string;
  edition?: 'glb' | 'irn';
  basePrompt: string;
  followUpPrompt?: string;
  turnAudios?: Array<{
    partIndex: number;
    promptText: string;
    base64AudioData: string;
    format?: 'm4a' | 'mp3' | 'wav';
  }>;
}

const RawModelOutputSchema = z.object({
  status: z.enum(['provisional', 'insufficient_evidence', 'unscorable']),
  suggestedPracticeLevel: z.string().nullable().optional(),
  tierHint: DiagnosticTierHintSchema.nullable().optional(),
  transcriptSummary: z.string().nullable().optional(),
  observations: z.array(z.string()).default([]),
  weaknessFocus: z.string().nullable().optional(),
  recommendedDrillType: z.string().nullable().optional(),
  evidenceExcerpts: z.array(z.string()).default([]),
  audioIssueNote: z.string().nullable().optional(),
});

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

export const gradeWritingDiagnosticGraph = {
  name: 'grade_writing_diagnostic',
  model: MODEL_REGISTRY.writingPrimary,
  async invoke(
    input: DiagnosticWritingInput,
    options: {
      client?: Pick<OpenRouterClient, 'createChatCompletion'>;
      allowDemoEvaluator?: boolean;
    } = {},
  ): Promise<DiagnosticWritingResult> {
    const combinedText = `${input.baseResponse}\n${input.followUpResponse ?? ''}`.trim();
    if (countWords(combinedText) < 6) {
      return {
        skill: 'writing',
        status: 'insufficient_evidence',
        suggestedPracticeLevel: null,
        tierHint: null,
        observations: ['Response was too brief to recommend a reliable Writing practice level.'],
        weaknessFocus: null,
        recommendedDrillType: null,
        evidenceExcerpts: [],
        modelId: 'sufficiency-gate',
        rubricVersion: 'diagnostic-writing-v1',
      };
    }

    const apiKey = process.env['OPENROUTER_API_KEY'];
    const isProd = process.env['NODE_ENV'] === 'production';
    const demoOptIn =
      !isProd && (options.allowDemoEvaluator ?? process.env['ALLOW_DEMO_EVALUATOR'] === 'true');

    if (!options.client && !apiKey) {
      if (demoOptIn) {
        return {
          skill: 'writing',
          status: 'provisional',
          suggestedPracticeLevel: 'Suggested practice: Intermediate (B1–B2 focus) — provisional',
          tierHint: 'B1',
          observations: ['Demo preview output (AI grading key not enabled).'],
          weaknessFocus: null,
          recommendedDrillType: null,
          evidenceExcerpts: [combinedText.slice(0, Math.min(40, combinedText.length))],
          modelId: 'demo-heuristic-uncalibrated',
          rubricVersion: 'demo-non-production',
        };
      }
      throw new EvaluationModelError(
        'model_unavailable',
        'Writing diagnostic evaluator unavailable: OPENROUTER_API_KEY is not configured.',
        false,
      );
    }

    const client = options.client ?? new OpenRouterClient({ apiKey });
    const prompt = `${renderPromptFromYaml('writing_diagnostic', {
      promptTitle: input.promptTitle,
      basePrompt: input.basePrompt,
      followUpPrompt: input.followUpPrompt?.trim() || 'None supplied',
      baseResponse: input.baseResponse.trim(),
      followUpResponse: input.followUpResponse?.trim() || 'None supplied',
    })}${buildEditionOverlayAppendix(input.edition)}`;

    const response = await client.createChatCompletion({
      model: MODEL_REGISTRY.writingPrimary,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const rawContent = response.choices[0]?.message.content ?? '';
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawContent);
    } catch {
      throw new EvaluationModelError(
        'model_invalid_output',
        'Writing diagnostic model returned non-JSON content.',
        true,
      );
    }

    const parsed = RawModelOutputSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new EvaluationModelError(
        'model_invalid_output',
        'Writing diagnostic model JSON failed schema validation.',
        true,
      );
    }

    const normalizedCombined = combinedText.toLowerCase();
    const groundedExcerpts = parsed.data.evidenceExcerpts
      .map((q) => q.trim())
      .filter((q) => q.length > 0 && normalizedCombined.includes(q.toLowerCase()));

    const isUnplaced = parsed.data.status !== 'provisional';
    return DiagnosticWritingResultSchema.parse({
      skill: 'writing',
      status: parsed.data.status,
      suggestedPracticeLevel: isUnplaced ? null : (parsed.data.suggestedPracticeLevel ?? null),
      tierHint: isUnplaced ? null : (parsed.data.tierHint ?? null),
      observations:
        parsed.data.observations.length > 0
          ? parsed.data.observations.slice(0, 2)
          : ['Short writing sample reviewed.'],
      weaknessFocus: parsed.data.weaknessFocus ?? null,
      recommendedDrillType: parsed.data.recommendedDrillType ?? null,
      evidenceExcerpts: groundedExcerpts,
      modelId: MODEL_REGISTRY.writingPrimary,
      rubricVersion: 'diagnostic-writing-v1',
    });
  },
};

export const gradeSpeakingDiagnosticGraph = {
  name: 'grade_speaking_diagnostic',
  model: MODEL_REGISTRY.speakingAudioPrimary,
  async invoke(
    input: DiagnosticSpeakingInput,
    options: {
      client?: Pick<OpenRouterClient, 'createChatCompletion'>;
      allowDemoEvaluator?: boolean;
    } = {},
  ): Promise<DiagnosticSpeakingResult> {
    const audioEntries = (input.turnAudios ?? []).filter((e) => e.base64AudioData.length > 0);
    if (audioEntries.length === 0) {
      throw new EvaluationModelError(
        'audio_missing',
        'Speaking diagnostic requires recorded audio.',
        false,
      );
    }

    const apiKey = process.env['OPENROUTER_API_KEY'];
    const isProd = process.env['NODE_ENV'] === 'production';
    const demoOptIn =
      !isProd && (options.allowDemoEvaluator ?? process.env['ALLOW_DEMO_EVALUATOR'] === 'true');

    if (!options.client && !apiKey) {
      if (demoOptIn) {
        return {
          skill: 'speaking',
          status: 'provisional',
          suggestedPracticeLevel: 'Suggested practice: Intermediate (B1–B2 focus) — provisional',
          tierHint: 'B1',
          transcriptSummary: 'Demo preview transcript.',
          observations: ['Demo preview output (AI grading key not enabled).'],
          weaknessFocus: null,
          recommendedDrillType: null,
          audioIssueNote: null,
          modelId: 'demo-heuristic-uncalibrated',
          rubricVersion: 'demo-non-production',
        };
      }
      throw new EvaluationModelError(
        'model_unavailable',
        'Speaking diagnostic evaluator unavailable: OPENROUTER_API_KEY is not configured.',
        false,
      );
    }

    const client = options.client ?? new OpenRouterClient({ apiKey });
    const audioDescriptions = audioEntries
      .map((entry, idx) => `Audio #${idx + 1} (Prompt): ${entry.promptText}`)
      .join('\n');

    const promptText = `${renderPromptFromYaml('speaking_diagnostic', {
      basePrompt: input.basePrompt,
      followUpPrompt: input.followUpPrompt?.trim() || 'None recorded',
      audioDescriptions,
    })}${buildEditionOverlayAppendix(input.edition)}`;

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
      { type: 'text' as const, text: promptText },
    ];

    const response = await client.createChatCompletion({
      model: MODEL_REGISTRY.speakingAudioPrimary,
      messages: [{ role: 'user', content: contentParts }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const rawContent = response.choices[0]?.message.content ?? '';
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawContent);
    } catch {
      throw new EvaluationModelError(
        'model_invalid_output',
        'Speaking diagnostic model returned non-JSON content.',
        true,
      );
    }

    const parsed = RawModelOutputSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new EvaluationModelError(
        'model_invalid_output',
        'Speaking diagnostic model JSON failed schema validation.',
        true,
      );
    }

    const isUnplaced = parsed.data.status !== 'provisional';
    return DiagnosticSpeakingResultSchema.parse({
      skill: 'speaking',
      status: parsed.data.status,
      suggestedPracticeLevel: isUnplaced ? null : (parsed.data.suggestedPracticeLevel ?? null),
      tierHint: isUnplaced ? null : (parsed.data.tierHint ?? null),
      transcriptSummary: parsed.data.transcriptSummary ?? null,
      observations:
        parsed.data.observations.length > 0
          ? parsed.data.observations.slice(0, 2)
          : ['Short speaking sample reviewed.'],
      weaknessFocus: parsed.data.weaknessFocus ?? null,
      recommendedDrillType: parsed.data.recommendedDrillType ?? null,
      audioIssueNote: parsed.data.audioIssueNote ?? null,
      modelId: MODEL_REGISTRY.speakingAudioPrimary,
      rubricVersion: 'diagnostic-speaking-v1',
    });
  },
};
