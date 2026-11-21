import { z } from 'zod';
import { EvaluationModelError } from '../errors.js';
import { OpenRouterClient, type OpenRouterMessage } from './openrouter.js';
import { ALPHA_FALLBACK_REGISTRY, MODEL_REGISTRY } from './registry.js';

export const DecisionQuestionSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string().min(1),
    kind: z.literal('noul'),
    prompt: z.string().min(1),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal('choice'),
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(64),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal('score'),
    prompt: z.string().min(1),
    minScore: z.number().int().min(0).default(1),
    maxScore: z.number().int().min(1).max(255).default(5),
  }),
]);

export type DecisionQuestion = z.infer<typeof DecisionQuestionSchema>;

export const DecisionOutcomeSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['noul', 'choice', 'score']),
  boolValue: z.boolean().optional(),
  probability: z.number().min(0).max(1).optional(),
  choiceValue: z.string().optional(),
  scoreValue: z.number().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type DecisionOutcome = z.infer<typeof DecisionOutcomeSchema>;

export const DecisionResponseSchema = z.object({
  modelUsed: z.string().min(1),
  usedFallback: z.boolean(),
  fallbackReason: z.string().optional(),
  latencyMs: z.number().nonnegative(),
  outcomes: z.record(z.string(), DecisionOutcomeSchema),
});

export type DecisionResponse = z.infer<typeof DecisionResponseSchema>;

export const ExtractionSpanSchema = z.object({
  text: z.string(),
  startUtf16: z.number().int().nonnegative().optional(),
  endUtf16: z.number().int().nonnegative().optional(),
  confidence: z.number().min(0).max(1).optional(),
  pNull: z.number().min(0).max(1).optional(),
});

export const ExtractionFieldSpecSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  kind: z.enum(['text', 'list']),
});

export type ExtractionFieldSpec = z.infer<typeof ExtractionFieldSpecSchema>;

export const ExtractionResponseSchema = z.object({
  modelUsed: z.string().min(1),
  usedFallback: z.boolean(),
  fallbackReason: z.string().optional(),
  latencyMs: z.number().nonnegative(),
  fields: z.record(
    z.string(),
    z.object({
      items: z.array(ExtractionSpanSchema),
      pNull: z.number().min(0).max(1).optional(),
    }),
  ),
});

export type ExtractionResponse = z.infer<typeof ExtractionResponseSchema>;

export interface SlidingWindowCircuitBreakerOptions {
  failureThreshold?: number;
  windowMs?: number;
  openDurationMs?: number;
  now?: () => number;
}

/**
 * Sliding-window circuit breaker guarding experimental OpenRouter System 1 alpha routes (`ADR-ADV-002`).
 * 5 failures in 60s opens the circuit for 120s and routes directly to GA System 2 fallbacks.
 */
export class SlidingWindowCircuitBreaker {
  private readonly failureThreshold: number;
  private readonly windowMs: number;
  private readonly openDurationMs: number;
  private readonly now: () => number;
  private failureTimestamps: number[] = [];
  private openUntilMs = 0;

  constructor(options: SlidingWindowCircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.windowMs = options.windowMs ?? 60_000;
    this.openDurationMs = options.openDurationMs ?? 120_000;
    this.now = options.now ?? (() => Date.now());
  }

  isOpen(): boolean {
    const t = this.now();
    if (this.openUntilMs > t) {
      return true;
    }
    this.failureTimestamps = this.failureTimestamps.filter((ts) => t - ts <= this.windowMs);
    return false;
  }

  recordSuccess(): void {
    this.failureTimestamps = [];
    this.openUntilMs = 0;
  }

  recordFailure(): void {
    const t = this.now();
    this.failureTimestamps = this.failureTimestamps.filter((ts) => t - ts <= this.windowMs);
    this.failureTimestamps.push(t);
    if (this.failureTimestamps.length >= this.failureThreshold) {
      this.openUntilMs = t + this.openDurationMs;
    }
  }

  getState(): { open: boolean; recentFailures: number; openUntilMs: number } {
    const open = this.isOpen();
    return {
      open,
      recentFailures: this.failureTimestamps.length,
      openUntilMs: this.openUntilMs,
    };
  }
}

export interface OpenRouterAlphaClientOptions {
  apiKey?: string;
  alphaBaseUrl?: string;
  gaBaseUrl?: string;
  alphaTimeoutMs?: number;
  gaFallbackClient?: OpenRouterClient;
  decisionBreaker?: SlidingWindowCircuitBreaker;
  extractionBreaker?: SlidingWindowCircuitBreaker;
  fetchFn?: typeof fetch;
}

const RawAlphaDecisionWireSchema = z.object({
  results: z
    .record(
      z.string(),
      z.object({
        value: z.union([z.boolean(), z.string(), z.number()]).optional(),
        probability: z.number().min(0).max(1).optional(),
        probabilities: z.record(z.string(), z.number()).optional(),
        confidence: z.number().min(0).max(1).optional(),
        score: z.number().optional(),
      }),
    )
    .optional(),
  decisions: z
    .array(
      z.object({
        id: z.string(),
        value: z.union([z.boolean(), z.string(), z.number()]).optional(),
        probability: z.number().min(0).max(1).optional(),
        confidence: z.number().min(0).max(1).optional(),
        score: z.number().optional(),
      }),
    )
    .optional(),
});

const RawAlphaExtractionWireSchema = z.object({
  extractions: z
    .record(
      z.string(),
      z.object({
        value: z.unknown().optional(),
        items: z
          .array(
            z.object({
              value: z.string().optional(),
              text: z.string().optional(),
              span: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]).optional(),
              confidence: z.number().min(0).max(1).optional(),
              p_null: z.number().min(0).max(1).optional(),
            }),
          )
          .optional(),
        span: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]).optional(),
        confidence: z.number().min(0).max(1).optional(),
        p_null: z.number().min(0).max(1).optional(),
      }),
    )
    .optional(),
});

function hasAudioParts(messages: readonly OpenRouterMessage[]): boolean {
  return messages.some(
    (m) => Array.isArray(m.content) && m.content.some((part) => part.type === 'input_audio'),
  );
}

function hasImageParts(messages: readonly OpenRouterMessage[]): boolean {
  return messages.some(
    (m) => Array.isArray(m.content) && m.content.some((part) => part.type === 'image_url'),
  );
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
 * Dual-System AI client routing System 1 calls to `/api/alpha/decisions` and `/api/alpha/extractions`
 * with sliding-window circuit breakers and automatic fallback to calibrated GA models (`ADR-ADV-002`).
 */
const sharedDecisionBreaker = new SlidingWindowCircuitBreaker();
const sharedExtractionBreaker = new SlidingWindowCircuitBreaker();

export class OpenRouterAlphaClient {
  private readonly apiKey: string;
  private readonly alphaBaseUrl: string;
  private readonly alphaTimeoutMs: number;
  private readonly gaClient: OpenRouterClient;
  readonly decisionBreaker: SlidingWindowCircuitBreaker;
  readonly extractionBreaker: SlidingWindowCircuitBreaker;
  private readonly fetchFn: typeof fetch;

  constructor(options: OpenRouterAlphaClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env['OPENROUTER_API_KEY'] ?? '';
    this.alphaBaseUrl = (
      options.alphaBaseUrl ??
      process.env['OPENROUTER_ALPHA_BASE_URL'] ??
      'https://openrouter.ai/api/alpha'
    ).replace(/\/+$/, '');
    this.alphaTimeoutMs = options.alphaTimeoutMs ?? 4_000;
    this.gaClient =
      options.gaFallbackClient ??
      new OpenRouterClient({
        apiKey: this.apiKey,
        baseUrl: options.gaBaseUrl,
        timeoutMs: 20_000,
      });
    this.decisionBreaker = options.decisionBreaker ?? sharedDecisionBreaker;
    this.extractionBreaker = options.extractionBreaker ?? sharedExtractionBreaker;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async callDecisionsApi(params: {
    messages: OpenRouterMessage[];
    questions: DecisionQuestion[];
    routingTier?: 'standard' | 'flex';
  }): Promise<DecisionResponse> {
    const startMs = Date.now();
    const isMultimodal = hasAudioParts(params.messages) || hasImageParts(params.messages);

    if (!this.decisionBreaker.isOpen()) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.alphaTimeoutMs);
      try {
        const res = await this.fetchFn(`${this.alphaBaseUrl}/decisions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            'HTTP-Referer': 'https://mockza.app',
            'X-Title': 'Mockza Linguistic Engine',
          },
          body: JSON.stringify({
            model: MODEL_REGISTRY.system1Decision,
            messages: params.messages,
            decisions: params.questions.map((q) => ({
              id: q.id,
              type: q.kind,
              prompt: q.prompt,
              ...(q.kind === 'choice' ? { options: q.options } : {}),
              ...(q.kind === 'score' ? { min: q.minScore, max: q.maxScore } : {}),
            })),
            provider: { data_collection: 'deny' },
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Alpha decisions HTTP ${res.status}`);
        }

        const wireJson = await res.json();
        const parsed = RawAlphaDecisionWireSchema.parse(wireJson);
        const outcomes = this.normalizeDecisionOutcomes(params.questions, parsed);
        this.decisionBreaker.recordSuccess();

        return DecisionResponseSchema.parse({
          modelUsed: MODEL_REGISTRY.system1Decision,
          usedFallback: false,
          latencyMs: Math.max(0, Date.now() - startMs),
          outcomes,
        });
      } catch (err) {
        this.decisionBreaker.recordFailure();
        const reason = err instanceof Error ? err.message.slice(0, 120) : 'alpha_decision_error';
        return this.runDecisionGaFallback({
          messages: params.messages,
          questions: params.questions,
          isMultimodal,
          routingTier: params.routingTier,
          fallbackReason: reason,
          startMs,
        });
      } finally {
        clearTimeout(timer);
      }
    }

    return this.runDecisionGaFallback({
      messages: params.messages,
      questions: params.questions,
      isMultimodal,
      routingTier: params.routingTier,
      fallbackReason: 'circuit_open',
      startMs,
    });
  }

  private normalizeDecisionOutcomes(
    questions: readonly DecisionQuestion[],
    raw: z.infer<typeof RawAlphaDecisionWireSchema>,
  ): Record<string, DecisionOutcome> {
    const outcomes: Record<string, DecisionOutcome> = {};
    const listMap = new Map((raw.decisions ?? []).map((item) => [item.id, item]));

    for (const q of questions) {
      const entry = raw.results?.[q.id] ?? listMap.get(q.id);
      if (!entry) {
        throw new Error(`Missing decision outcome for question '${q.id}'`);
      }

      if (q.kind === 'noul') {
        const prob = entry.probability ?? (typeof entry.value === 'boolean' ? (entry.value ? 0.9 : 0.1) : 0.5);
        const boolVal = typeof entry.value === 'boolean' ? entry.value : prob >= 0.5;
        outcomes[q.id] = {
          id: q.id,
          kind: 'noul',
          boolValue: boolVal,
          probability: prob,
          confidence: entry.confidence ?? prob,
        };
      } else if (q.kind === 'choice') {
        const chosen = typeof entry.value === 'string' && q.options.includes(entry.value)
          ? entry.value
          : q.options[0]!;
        outcomes[q.id] = {
          id: q.id,
          kind: 'choice',
          choiceValue: chosen,
          confidence: entry.confidence ?? entry.probability ?? 0.5,
        };
      } else {
        const rawScore =
          entry.score ?? (typeof entry.value === 'number' ? entry.value : q.minScore);
        const bounded = Math.max(q.minScore, Math.min(q.maxScore, Math.round(rawScore)));
        outcomes[q.id] = {
          id: q.id,
          kind: 'score',
          scoreValue: bounded,
          confidence: entry.confidence ?? 0.5,
        };
      }
    }

    return outcomes;
  }

  private async runDecisionGaFallback(params: {
    messages: OpenRouterMessage[];
    questions: DecisionQuestion[];
    isMultimodal: boolean;
    routingTier?: 'standard' | 'flex';
    fallbackReason: string;
    startMs: number;
  }): Promise<DecisionResponse> {
    const fallbackModel = params.isMultimodal
      ? ALPHA_FALLBACK_REGISTRY['google/gemini-decision-1'].multimodal
      : ALPHA_FALLBACK_REGISTRY['google/gemini-decision-1'].text;

    const specPrompt = params.questions
      .map((q) => {
        if (q.kind === 'noul') return `- "${q.id}" (boolean): ${q.prompt}`;
        if (q.kind === 'choice') {
          return `- "${q.id}" (one of [${q.options.join(', ')}]): ${q.prompt}`;
        }
        return `- "${q.id}" (integer ${q.minScore}..${q.maxScore}): ${q.prompt}`;
      })
      .join('\n');

    const chatRes = await this.gaClient.createChatCompletion({
      model: fallbackModel,
      routingTier: params.routingTier,
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 512,
      messages: [
        ...params.messages,
        {
          role: 'user',
          content: `Return ONLY valid JSON mapping each question id to its answer value and optional confidence (0..1):\n{\n  "answers": { "<id>": { "value": <boolean|string|number>, "confidence": 0.9 } }\n}\nQuestions:\n${specPrompt}`,
        },
      ],
    });

    const content = stripJsonCodeFences(chatRes.choices[0]?.message?.content ?? '{}');
    const parsedJson = JSON.parse(content) as {
      answers?: Record<string, { value?: boolean | string | number; confidence?: number }>;
    };
    const answers = parsedJson.answers ?? {};
    const outcomes: Record<string, DecisionOutcome> = {};

    for (const q of params.questions) {
      const a = answers[q.id];
      const conf = typeof a?.confidence === 'number' ? Math.max(0, Math.min(1, a.confidence)) : 0.75;
      if (q.kind === 'noul') {
        const boolVal = Boolean(a?.value);
        outcomes[q.id] = {
          id: q.id,
          kind: 'noul',
          boolValue: boolVal,
          probability: boolVal ? conf : 1 - conf,
          confidence: conf,
        };
      } else if (q.kind === 'choice') {
        const chosen =
          typeof a?.value === 'string' && q.options.includes(a.value) ? a.value : q.options[0]!;
        outcomes[q.id] = {
          id: q.id,
          kind: 'choice',
          choiceValue: chosen,
          confidence: conf,
        };
      } else {
        const num = typeof a?.value === 'number' ? a.value : q.minScore;
        outcomes[q.id] = {
          id: q.id,
          kind: 'score',
          scoreValue: Math.max(q.minScore, Math.min(q.maxScore, Math.round(num))),
          confidence: conf,
        };
      }
    }

    return DecisionResponseSchema.parse({
      modelUsed: fallbackModel,
      usedFallback: true,
      fallbackReason: params.fallbackReason,
      latencyMs: Math.max(0, Date.now() - params.startMs),
      outcomes,
    });
  }

  async callExtractionsApi(params: {
    messages: OpenRouterMessage[];
    fields: ExtractionFieldSpec[];
    routingTier?: 'standard' | 'flex';
  }): Promise<ExtractionResponse> {
    const startMs = Date.now();
    if (hasAudioParts(params.messages)) {
      throw new EvaluationModelError(
        'model_unavailable',
        'cloudflare/clairic supports text and <=4 images only, never audio.',
        false,
      );
    }

    const withImages = hasImageParts(params.messages);
    if (!this.extractionBreaker.isOpen()) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.alphaTimeoutMs);
      try {
        const res = await this.fetchFn(`${this.alphaBaseUrl}/extractions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            'HTTP-Referer': 'https://mockza.app',
            'X-Title': 'Mockza Drop Extractor',
          },
          body: JSON.stringify({
            model: MODEL_REGISTRY.system1Extractor,
            messages: params.messages,
            schema: Object.fromEntries(
              params.fields.map((f) => [
                f.name,
                {
                  type: f.kind,
                  description: f.description,
                  ...(f.kind === 'list' ? { items: { type: 'text' } } : {}),
                },
              ]),
            ),
            provider: { data_collection: 'deny' },
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Alpha extractions HTTP ${res.status}`);
        }

        const wireJson = await res.json();
        const parsed = RawAlphaExtractionWireSchema.parse(wireJson);
        const normalizedFields: ExtractionResponse['fields'] = {};

        for (const f of params.fields) {
          const entry = parsed.extractions?.[f.name];
          if (entry?.items && entry.items.length > 0) {
            normalizedFields[f.name] = {
              pNull: entry.p_null,
              items: entry.items.map((it) => ({
                text: it.text ?? it.value ?? '',
                startUtf16: it.span?.[0],
                endUtf16: it.span?.[1],
                confidence: it.confidence,
                pNull: it.p_null,
              })),
            };
          } else if (typeof entry?.value === 'string') {
            normalizedFields[f.name] = {
              pNull: entry.p_null,
              items: [
                {
                  text: entry.value,
                  startUtf16: entry.span?.[0],
                  endUtf16: entry.span?.[1],
                  confidence: entry.confidence,
                  pNull: entry.p_null,
                },
              ],
            };
          } else if (Array.isArray(entry?.value)) {
            normalizedFields[f.name] = {
              pNull: entry.p_null,
              items: entry.value
                .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
                .map((v) => ({ text: v, confidence: entry.confidence })),
            };
          } else {
            normalizedFields[f.name] = { items: [], pNull: entry?.p_null ?? 1 };
          }
        }

        this.extractionBreaker.recordSuccess();
        return ExtractionResponseSchema.parse({
          modelUsed: MODEL_REGISTRY.system1Extractor,
          usedFallback: false,
          latencyMs: Math.max(0, Date.now() - startMs),
          fields: normalizedFields,
        });
      } catch (err) {
        this.extractionBreaker.recordFailure();
        const reason = err instanceof Error ? err.message.slice(0, 120) : 'alpha_extraction_error';
        return this.runExtractionGaFallback({
          messages: params.messages,
          fields: params.fields,
          withImages,
          routingTier: params.routingTier,
          fallbackReason: reason,
          startMs,
        });
      } finally {
        clearTimeout(timer);
      }
    }

    return this.runExtractionGaFallback({
      messages: params.messages,
      fields: params.fields,
      withImages,
      routingTier: params.routingTier,
      fallbackReason: 'circuit_open',
      startMs,
    });
  }

  private async runExtractionGaFallback(params: {
    messages: OpenRouterMessage[];
    fields: ExtractionFieldSpec[];
    withImages: boolean;
    routingTier?: 'standard' | 'flex';
    fallbackReason: string;
    startMs: number;
  }): Promise<ExtractionResponse> {
    const fallbackModel = params.withImages
      ? ALPHA_FALLBACK_REGISTRY['cloudflare/clairic'].image
      : ALPHA_FALLBACK_REGISTRY['cloudflare/clairic'].text;

    const fieldGuide = params.fields
      .map((f) => `- "${f.name}" (${f.kind}): ${f.description}`)
      .join('\n');

    const chatRes = await this.gaClient.createChatCompletion({
      model: fallbackModel,
      routingTier: params.routingTier,
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 700,
      messages: [
        ...params.messages,
        {
          role: 'user',
          content: `Extract verbatim fields into JSON:\n{\n  "fields": { "<name>": string[] }\n}\nFields:\n${fieldGuide}`,
        },
      ],
    });

    const content = stripJsonCodeFences(chatRes.choices[0]?.message?.content ?? '{}');
    const parsedJson = JSON.parse(content) as { fields?: Record<string, unknown> };
    const normalizedFields: ExtractionResponse['fields'] = {};

    for (const f of params.fields) {
      const rawVal = parsedJson.fields?.[f.name];
      if (Array.isArray(rawVal)) {
        normalizedFields[f.name] = {
          items: rawVal
            .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
            .map((v) => ({ text: v.trim(), confidence: 0.8 })),
        };
      } else if (typeof rawVal === 'string' && rawVal.trim().length > 0) {
        normalizedFields[f.name] = {
          items: [{ text: rawVal.trim(), confidence: 0.8 }],
        };
      } else {
        normalizedFields[f.name] = { items: [], pNull: 1 };
      }
    }

    return ExtractionResponseSchema.parse({
      modelUsed: fallbackModel,
      usedFallback: true,
      fallbackReason: params.fallbackReason,
      latencyMs: Math.max(0, Date.now() - params.startMs),
      fields: normalizedFields,
    });
  }
}
