import { DailyMissionPayloadSchema } from '@mockza/contracts';
import type { z } from 'zod';
import { EvaluationModelError } from '../errors.js';
import { OpenRouterClient } from '../models/openrouter.js';
import { MODEL_REGISTRY } from '../models/registry.js';

export type DailyMissionPayload = z.infer<typeof DailyMissionPayloadSchema>;

export interface PlanDailyMissionInput {
  edition: 'glb' | 'irn';
  examTrack: string;
  focusTopic: string;
  bottlenecks: Array<{
    canonicalKey: string;
    displayLabelEn: string;
    displayLabelFa?: string | null;
    lastExampleEn?: string | null;
  }>;
  dueCards: Array<{
    cardId: string;
    word: string;
    meaningEn?: string | null;
    meaningFa?: string | null;
  }>;
  responseMode?: 'writing' | 'speaking';
}

export interface PlanDailyMissionOutput {
  payload: DailyMissionPayload;
  modelId: string;
  promptVersion: string;
}

export interface PlanDailyMissionOptions {
  client?: Pick<OpenRouterClient, 'createChatCompletion'>;
  allowDemoEvaluator?: boolean;
  routingTier?: 'standard' | 'flex';
}

const PROMPT_VERSION = 'daily-mission@2026-11';

export function planDailyMissionDemoOnly(input: PlanDailyMissionInput): PlanDailyMissionOutput {
  const b0 = input.bottlenecks[0] ?? {
    canonicalKey: 'grammar:conditional_framing',
    displayLabelEn: 'Hypothetical & Conditional Clauses',
  };
  const c0 = input.dueCards[0] ?? {
    cardId: 'card-starter-1',
    word: 'albeit',
    meaningEn: 'although / even though',
    meaningFa: 'اگرچه / هرچند',
  };
  const responseMode = input.responseMode ?? 'writing';
  const topicClean = input.focusTopic || 'Artificial Intelligence';

  const payload = DailyMissionPayloadSchema.parse({
    estimatedSeconds: 600,
    warmupCardIds: input.dueCards.slice(0, 5).map((c) => c.cardId),
    forcedTargets: [
      {
        canonicalKey: b0.canonicalKey,
        phraseEn: b0.canonicalKey.includes('conditional')
          ? 'Were we to prioritize...'
          : b0.displayLabelEn,
        hintEn: `Use an explicit conditional or concessive clause while discussing ${topicClean}.`,
        hintFa:
          input.edition === 'irn'
            ? `در پاسخ خود درباره «${topicClean}» حتماً از یک جمله شرطی یا ربط تقابلی استفاده کنید.`
            : null,
      },
      {
        canonicalKey: `lexis:${c0.word.toLowerCase()}`,
        phraseEn: c0.word,
        hintEn: c0.meaningEn ? `Recycled SM-2 card: ${c0.meaningEn}` : `Apply "${c0.word}" naturally.`,
        hintFa:
          input.edition === 'irn'
            ? c0.meaningFa ?? `واژه مروری دِک امروز («${c0.word}») را طبیعی به کار ببرید.`
            : null,
      },
    ],
    promptTitle: `10-Min Transfer: ${topicClean}`,
    promptTextEn: `In 4–6 concise sentences about ${topicClean}, defend one practical trade-off using both forced targets above.`,
    promptTextFa:
      input.edition === 'irn'
        ? `مأموریت ۱۰ دقیقه‌ای درباره «${topicClean}»: در ۴ تا ۶ جمله استدلالی، یک مزیت و ریسک را تحلیل کنید و هر دو ساختار هدفِ بالا را حتماً در پاسخ بیاورید.`
        : null,
    responseMode,
  });

  return {
    payload,
    modelId: 'demo-heuristic-uncalibrated',
    promptVersion: 'demo-non-production',
  };
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

/**
 * Synthesizes a focused 10-minute Daily Mission uniting user bottlenecks, SM-2 due cards,
 * and favorite topic interests (`ADR-ADV-002` / `ADR-ADV-003`).
 */
export async function planDailyMissionGraph(
  input: PlanDailyMissionInput,
  options: PlanDailyMissionOptions = {},
): Promise<PlanDailyMissionOutput> {
  const apiKey = process.env['OPENROUTER_API_KEY'] ?? '';
  if (!apiKey && options.allowDemoEvaluator) {
    return planDailyMissionDemoOnly(input);
  }
  if (!apiKey && !options.client) {
    throw new EvaluationModelError(
      'model_unavailable',
      'OPENROUTER_API_KEY missing for Daily Mission planning.',
      false,
    );
  }

  const client = options.client ?? new OpenRouterClient({ apiKey, timeoutMs: 20_000 });
  const tier = options.routingTier ?? 'flex';

  const bottlenecksDesc =
    input.bottlenecks.length > 0
      ? input.bottlenecks
          .slice(0, 2)
          .map((b) => `- ${b.canonicalKey}: ${b.displayLabelEn}`)
          .join('\n')
      : '- grammar:conditional_framing: Conditional framing\n- cohesion:concessive_linker_gap: Concessive transition';

  const dueDesc =
    input.dueCards.length > 0
      ? input.dueCards
          .slice(0, 5)
          .map((c) => `- (${c.cardId}) "${c.word}": ${c.meaningEn ?? ''}`)
          .join('\n')
      : '- (none) Choose one practical C1 academic collocation';

  const editionInstruction =
    input.edition === 'irn'
      ? 'Keep ALL forcedTargets[].phraseEn, hintEn, promptTitle, and promptTextEn in crisp natural English. Write hintFa and promptTextFa in clear encouraging Persian (fa-IR).'
      : 'Keep all strings in crisp natural English. Set hintFa and promptTextFa to null.';

  const systemPrompt = [
    'You are an adaptive language coach generating a high-signal 10-minute Daily Mission.',
    `Target exam track: ${input.examTrack}. Focus interest topic: ${input.focusTopic}.`,
    editionInstruction,
    'Return ONLY JSON matching:',
    '{"estimatedSeconds":600,"warmupCardIds":["..."],"forcedTargets":[{"canonicalKey":"...","phraseEn":"...","hintEn":"...","hintFa":null}],"promptTitle":"...","promptTextEn":"...","promptTextFa":null,"responseMode":"writing"|"speaking"}',
    'Always provide exactly 2 actionable forcedTargets combining the learner bottleneck + SM-2 vocabulary.',
  ].join('\n');

  const userPrompt = `Top Bottlenecks:\n${bottlenecksDesc}\n\nDue SM-2 Cards:\n${dueDesc}\n\nPreferred mode: ${input.responseMode ?? 'writing'}`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await client.createChatCompletion({
        model: MODEL_REGISTRY.missionPlanner,
        routingTier: tier,
        response_format: { type: 'json_object' },
        temperature: 0.35,
        max_tokens: 1800,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content:
              attempt === 0
                ? userPrompt
                : `${userPrompt}\n\nPrevious JSON failed schema validation (${String(lastError)}). Fix structure strictly.`,
          },
        ],
      });

      const raw = stripJsonCodeFences(res.choices[0]?.message?.content ?? '{}');
      const parsedJson = JSON.parse(raw) as Record<string, unknown>;
      // Ensure warmupCardIds always carries valid card IDs from input
      if (!Array.isArray(parsedJson['warmupCardIds'])) {
        parsedJson['warmupCardIds'] = input.dueCards.slice(0, 5).map((c) => c.cardId);
      }
      const payload = DailyMissionPayloadSchema.parse(parsedJson);
      return {
        payload,
        modelId: MODEL_REGISTRY.missionPlanner,
        promptVersion: PROMPT_VERSION,
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw new EvaluationModelError(
    'model_invalid_output',
    `Daily Mission planner failed schema validation: ${(lastError as Error)?.message ?? 'invalid json'}`,
    true,
  );
}
