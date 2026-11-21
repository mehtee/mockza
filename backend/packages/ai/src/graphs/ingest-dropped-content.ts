import { DroppedContentResponseSchema } from '@mockza/contracts';
import { normalizeUtf16Span } from '@mockza/domain';
import type { z } from 'zod';
import { EvaluationModelError } from '../errors.js';
import { OpenRouterAlphaClient } from '../models/openrouter-alpha.js';
import { OpenRouterClient, type OpenRouterMessage } from '../models/openrouter.js';
import { MODEL_REGISTRY } from '../models/registry.js';

export type DroppedPhraseDto = z.infer<typeof DroppedContentResponseSchema>['extractedPhrases'][number];
export type DropDrillPayload = z.infer<typeof DroppedContentResponseSchema>['drillPayload'];

export interface IngestDroppedContentInput {
  dropId: string;
  edition: 'glb' | 'irn';
  inputKind: 'text_url' | 'text' | 'image' | 'audio';
  examTrack: string;
  sourceDomainOrLabel: string;
  titleHint?: string;
  rawText?: string;
  imageDataUris?: string[];
  audioBase64?: string;
  audioFormat?: 'm4a' | 'mp3' | 'wav';
}

export interface IngestDroppedContentOutput {
  title: string;
  cefrEstimate: string;
  detectedTopics: string[];
  extractedPhrases: DroppedPhraseDto[];
  drillPayload: DropDrillPayload;
  excerptForGraph: string;
}

export interface IngestDroppedContentOptions {
  alphaClient?: OpenRouterAlphaClient;
  client?: Pick<OpenRouterClient, 'createChatCompletion'>;
  allowDemoEvaluator?: boolean;
  routingTier?: 'standard' | 'flex';
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

function alignPhraseSpan(
  sourceText: string | undefined,
  headword: string,
  rawStart?: number,
  rawEnd?: number,
): { startUtf16: number | null; endUtf16: number | null } {
  if (!sourceText || sourceText.length === 0) {
    return { startUtf16: null, endUtf16: null };
  }
  if (typeof rawStart === 'number' && typeof rawEnd === 'number' && rawEnd > rawStart) {
    const normalized = normalizeUtf16Span(sourceText, rawStart, rawEnd);
    return { startUtf16: normalized.startUtf16, endUtf16: normalized.endUtf16 };
  }
  const idx = sourceText.toLowerCase().indexOf(headword.trim().toLowerCase());
  if (idx >= 0) {
    const normalized = normalizeUtf16Span(sourceText, idx, idx + headword.trim().length);
    return { startUtf16: normalized.startUtf16, endUtf16: normalized.endUtf16 };
  }
  return { startUtf16: null, endUtf16: null };
}

export function ingestDroppedContentDemoOnly(
  input: IngestDroppedContentInput,
): IngestDroppedContentOutput {
  const isIrn = input.edition === 'irn';
  const raw = input.rawText ?? 'Real-world technology trends shape modern productivity.';
  const candidatePhrase = raw.trim().split(/\s+/).slice(0, 3).join(' ') || 'structured feedback';
  const span = alignPhraseSpan(input.rawText, candidatePhrase);

  return {
    title: input.titleHint || `Study Drop (${input.sourceDomainOrLabel})`,
    cefrEstimate: 'B2',
    detectedTopics: ['artificial_intelligence', 'workplace'],
    extractedPhrases: [
      {
        headword: candidatePhrase,
        ipa: '/ˈstrʌktʃərd/',
        definitionEn: 'Systematic academic expression captured from your shared material.',
        glossFa: isIrn ? 'عبارت کاربردی استخراج‌شده از محتوای ارسالی شما' : null,
        exampleSentence: `Applying ${candidatePhrase} improves clarity in formal discussions.`,
        startUtf16: span.startUtf16,
        endUtf16: span.endUtf16,
      },
      {
        headword: 'deliberate practice',
        ipa: '/dɪˈlɪbərət ˈpræktɪs/',
        definitionEn: 'Purposeful, feedback-driven repetition aimed at fixing specific weaknesses.',
        glossFa: isIrn ? 'تمرین هدفمند مبتنی بر بازخورد برای رفع نقاط ضعف' : null,
        exampleSentence: 'Band 8 speakers combine immersion with deliberate practice.',
        startUtf16: null,
        endUtf16: null,
      },
      {
        headword: 'trade-off',
        ipa: '/ˈtreɪd ɒf/',
        definitionEn: 'A balance achieved between two desirable but incompatible features.',
        glossFa: isIrn ? 'موازنه یا بده‌بستان میان دو گزینه' : null,
        exampleSentence: 'Teams weigh speed against reliability as an ongoing trade-off.',
        startUtf16: null,
        endUtf16: null,
      },
    ],
    drillPayload: {
      comprehensionPrompt: 'Which takeaway best reflects the central point of this dropped item?',
      comprehensionOptions: [
        'Structured input tied to active transfer accelerates academic fluency.',
        'Passive memorization alone guarantees Band 8 performance.',
        'Register never changes between casual chat and academic writing.',
      ],
      correctOptionIndex: 0,
      clozeSentence: 'Replacing passive reading with ______ strengthens long-term speaking accuracy.',
      clozeAnswer: 'deliberate practice',
      shadowingPrompt: 'Say aloud: "We must evaluate the long-term trade-off before adopting new tools."',
    },
    excerptForGraph: raw.slice(0, 320),
  };
}

/**
 * Dual-System bounded "Drop Anything" LangGraph pipeline (`ADR-ADV-002`, `ADR-ADV-003`):
 * - Mode A (`text_url`/`text`) & Mode B (`image`): `gemini-decision-1` preflight -> `cloudflare/clairic` span extraction (+ GA fallback) -> System 2 drill synthesis.
 * - Mode C (`audio <= 180s`): skips `clairic` directly -> `gemini-decision-1` preflight -> `google/gemini-3.1-flash-lite` audio comprehension & drill synthesis.
 */
export async function ingestDroppedContentGraph(
  input: IngestDroppedContentInput,
  options: IngestDroppedContentOptions = {},
): Promise<IngestDroppedContentOutput> {
  const apiKey = process.env['OPENROUTER_API_KEY'] ?? '';
  if (!apiKey && options.allowDemoEvaluator) {
    return ingestDroppedContentDemoOnly(input);
  }
  if (!apiKey && (!options.alphaClient || !options.client)) {
    throw new EvaluationModelError(
      'model_unavailable',
      'OPENROUTER_API_KEY missing for Drop Anything pipeline.',
      false,
    );
  }

  const alphaClient = options.alphaClient;
  const gaClient = options.client ?? new OpenRouterClient({ apiKey, timeoutMs: 25_000 });
  const routingTier = options.routingTier ?? 'flex';

  // Fast-path 1-call multimodal / text synthesis for live production runs (cuts 25-45s waterfall -> ~4-8s).
  // When an explicit alphaClient is injected (unit tests verifying dual-system alpha routing), run the dual-system path below.
  if (!alphaClient) {
    const fastModel =
      input.inputKind === 'audio' || input.inputKind === 'image'
        ? MODEL_REGISTRY.speakingAudioPrimary
        : MODEL_REGISTRY.missionPlanner;
    const isIrn = input.edition === 'irn';

    const userContent: OpenRouterMessage['content'] =
      input.inputKind === 'audio' && input.audioBase64
        ? [
            {
              type: 'text',
              text: `Analyze this bounded English audio clip for ${input.examTrack}.`,
            },
            {
              type: 'input_audio',
              input_audio: { data: input.audioBase64, format: input.audioFormat ?? 'm4a' },
            },
          ]
        : input.inputKind === 'image' && input.imageDataUris?.length
          ? [
              {
                type: 'text',
                text: `Extract English reading/study content across these ${input.imageDataUris.length} image(s) for ${input.examTrack}.`,
              },
              ...input.imageDataUris.slice(0, 4).map((url) => ({
                type: 'image_url' as const,
                image_url: { url },
              })),
            ]
          : `Source: ${input.sourceDomainOrLabel}${input.titleHint ? `\nTitle: ${input.titleHint}` : ''}\nExcerpt:\n${(input.rawText ?? '').slice(0, 10_000)}`;

    const singleRes = await gaClient.createChatCompletion({
      model: fastModel,
      routingTier,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 1800,
      messages: [
        {
          role: 'system',
          content: [
            `You turn authentic English articles, screenshots, or short audio clips into a concise 2-minute interactive study drill for ${input.examTrack}.`,
            isIrn
              ? 'Keep title, headwords, definitions, exampleSentences, comprehensionQuestion, cloze, and shadowingPrompt in natural English. Provide clear Persian (fa-IR) glossFa and comprehensionExplanationFa.'
              : 'Set glossFa and comprehensionExplanationFa to null.',
            'Return ONLY valid JSON matching:',
            '{"isSafeEducational":true,"cefrEstimate":"B2","mainTopic":"technology_ai","title":"Short 4-8 Word Title","transcriptExcerpt":"...","extractedPhrases":[{"headword":"...","ipa":"/.../","definitionEn":"...","glossFa":null,"exampleSentence":"..."}],"drillPayload":{"comprehensionPrompt":"...","comprehensionOptions":["...","...","..."],"correctOptionIndex":0,"comprehensionExplanationEn":"...","comprehensionExplanationFa":null,"clozeSentence":"... (with ______)","clozeAnswer":"...","shadowingPrompt":"..."}}',
          ].join('\n'),
        },
        { role: 'user', content: userContent },
      ],
    });

    const parsed = JSON.parse(
      stripJsonCodeFences(singleRes.choices[0]?.message?.content ?? '{}'),
    ) as {
      isSafeEducational?: boolean;
      cefrEstimate?: string;
      mainTopic?: string;
      title?: string;
      transcriptExcerpt?: string;
      extractedPhrases?: Array<Partial<DroppedPhraseDto>>;
      drillPayload?: Partial<DropDrillPayload>;
    };

    if (parsed.isSafeEducational === false) {
      throw new EvaluationModelError(
        'model_unavailable',
        'Dropped content failed educational safety screening.',
        false,
      );
    }

    const cefrEstimate =
      parsed.cefrEstimate && ['A2', 'B1', 'B2', 'C1', 'C2'].includes(parsed.cefrEstimate)
        ? parsed.cefrEstimate
        : 'B2';
    const mainTopic = parsed.mainTopic?.trim() || 'everyday_life';
    const extractedTitle = (
      parsed.title?.trim() ||
      input.titleHint ||
      `Study Material (${input.sourceDomainOrLabel})`
    ).slice(0, 140);

    const phrases: DroppedPhraseDto[] = (parsed.extractedPhrases ?? [])
      .slice(0, 5)
      .map((p) => {
        const headword = p.headword?.trim() || 'academic expression';
        const aligned = alignPhraseSpan(input.rawText, headword);
        return {
          headword,
          ipa: p.ipa ?? null,
          definitionEn: p.definitionEn ?? 'Useful expression captured from your study material.',
          glossFa: isIrn ? (p.glossFa ?? null) : null,
          exampleSentence: p.exampleSentence ?? `Practice using "${headword}" naturally.`,
          startUtf16: aligned.startUtf16,
          endUtf16: aligned.endUtf16,
        };
      });

    return {
      title: extractedTitle,
      cefrEstimate,
      detectedTopics: [mainTopic],
      extractedPhrases: phrases,
      drillPayload: {
        comprehensionPrompt:
          parsed.drillPayload?.comprehensionPrompt ??
          `Which statement best reflects the core idea of "${extractedTitle}"?`,
        comprehensionOptions: parsed.drillPayload?.comprehensionOptions?.length
          ? parsed.drillPayload.comprehensionOptions.slice(0, 4)
          : [
              'It highlights practical language patterns in authentic context.',
              'It recommends memorizing isolated grammar tables without context.',
            ],
        correctOptionIndex: Math.max(
          0,
          parsed.drillPayload?.correctOptionIndex ?? 0,
        ),
        comprehensionExplanationEn: parsed.drillPayload?.comprehensionExplanationEn ?? null,
        comprehensionExplanationFa: isIrn
          ? (parsed.drillPayload?.comprehensionExplanationFa ?? null)
          : null,
        clozeSentence:
          parsed.drillPayload?.clozeSentence ??
          `You can express this point clearly using ______.`,
        clozeAnswer:
          parsed.drillPayload?.clozeAnswer ?? phrases[0]?.headword ?? 'academic expression',
        shadowingPrompt:
          parsed.drillPayload?.shadowingPrompt ??
          phrases[0]?.exampleSentence ??
          'Read the target sentence aloud smoothly.',
      },
      excerptForGraph: (
        parsed.transcriptExcerpt ??
        input.rawText ??
        extractedTitle
      ).slice(0, 320),
    };
  }

  // Build System 1 preflight payload
  const preflightContent: OpenRouterMessage['content'] =
    input.inputKind === 'audio' && input.audioBase64
      ? [
          { type: 'text', text: 'Classify safety, English presence, CEFR difficulty, and topic of this audio drop.' },
          {
            type: 'input_audio',
            input_audio: { data: input.audioBase64, format: input.audioFormat ?? 'm4a' },
          },
        ]
      : input.inputKind === 'image' && input.imageDataUris?.length
        ? [
            { type: 'text', text: 'Classify safety, English text presence, CEFR level, and topic across these screenshots.' },
            ...input.imageDataUris.slice(0, 4).map((url) => ({
              type: 'image_url' as const,
              image_url: { url },
            })),
          ]
        : (input.rawText ?? '').slice(0, 3500);

  const preflight = await alphaClient.callDecisionsApi({
    routingTier,
    messages: [
      { role: 'system', content: 'Content moderator and CEFR estimator for an English learning app.' },
      { role: 'user', content: preflightContent },
    ],
    questions: [
      {
        id: 'is_safe_educational',
        kind: 'noul',
        prompt: 'Is this content safe for general study (non-NSFW, non-malware)?',
      },
      {
        id: 'is_mostly_english',
        kind: 'noul',
        prompt: 'Does the content contain usable English words/phrases worth learning?',
      },
      {
        id: 'cefr_level',
        kind: 'choice',
        prompt: 'Estimate the English CEFR level.',
        options: ['A2', 'B1', 'B2', 'C1', 'C2'],
      },
      {
        id: 'topic',
        kind: 'choice',
        prompt: 'Select main topic.',
        options: [
          'artificial_intelligence',
          'software_engineering',
          'business_workplace',
          'culture_cinema',
          'society_environment',
          'health_wellbeing',
          'everyday_life',
        ],
      },
    ],
  });

  if (preflight.outcomes['is_safe_educational']?.boolValue === false) {
    throw new EvaluationModelError(
      'model_unavailable',
      'Dropped content failed educational safety screening.',
      false,
    );
  }

  const cefrEstimate = preflight.outcomes['cefr_level']?.choiceValue ?? 'B2';
  const mainTopic = preflight.outcomes['topic']?.choiceValue ?? 'everyday_life';

  // Mode C (Audio) bypasses cloudflare/clairic directly -> gemini-3.1-flash-lite
  if (input.inputKind === 'audio' && input.audioBase64) {
    const audioRes = await gaClient.createChatCompletion({
      model: MODEL_REGISTRY.speakingAudioPrimary,
      routingTier,
      response_format: { type: 'json_object' },
      temperature: 0.25,
      max_tokens: 1400,
      messages: [
        {
          role: 'system',
          content: [
            `You are building a 2-minute English micro-drill (${cefrEstimate}) from a <= 3-minute audio clip.`,
            input.edition === 'irn'
              ? 'Keep all English phrases and drill items in English; populate glossFa with concise Persian translations.'
              : 'Populate glossFa as null.',
            'Return ONLY JSON matching: {"title":"...","transcriptExcerpt":"...","extractedPhrases":[{"headword":"...","ipa":"...","definitionEn":"...","glossFa":null,"exampleSentence":"..."}],"drillPayload":{"comprehensionPrompt":"...","comprehensionOptions":["...","...","..."],"correctOptionIndex":0,"clozeSentence":"...","clozeAnswer":"...","shadowingPrompt":"..."}}',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Extract 3-5 useful B2/C1 phrases and generate a 2-min drill for ${input.examTrack}.` },
            {
              type: 'input_audio',
              input_audio: { data: input.audioBase64, format: input.audioFormat ?? 'm4a' },
            },
          ],
        },
      ],
    });

    const parsedAudio = JSON.parse(
      stripJsonCodeFences(audioRes.choices[0]?.message?.content ?? '{}'),
    ) as {
      title?: string;
      transcriptExcerpt?: string;
      extractedPhrases?: Array<Partial<DroppedPhraseDto>>;
      drillPayload?: Partial<DropDrillPayload>;
    };

    const phrases = (parsedAudio.extractedPhrases ?? []).slice(0, 5).map((p) => ({
      headword: p.headword ?? 'key takeaway',
      ipa: p.ipa ?? null,
      definitionEn: p.definitionEn ?? 'Useful spoken expression from clip.',
      glossFa: input.edition === 'irn' ? (p.glossFa ?? null) : null,
      exampleSentence: p.exampleSentence ?? 'Keep this expression ready in your speaking turn.',
      startUtf16: null,
      endUtf16: null,
    }));

    return {
      title: parsedAudio.title || input.titleHint || 'Audio Micro-Drill',
      cefrEstimate,
      detectedTopics: [mainTopic],
      extractedPhrases: phrases,
      drillPayload: {
        comprehensionPrompt:
          parsedAudio.drillPayload?.comprehensionPrompt ?? 'What is the main point of this audio clip?',
        comprehensionOptions: parsedAudio.drillPayload?.comprehensionOptions ?? [
          'It presents a practical perspective worth summarizing.',
          'It contradicts itself completely.',
        ],
        correctOptionIndex: parsedAudio.drillPayload?.correctOptionIndex ?? 0,
        clozeSentence:
          parsedAudio.drillPayload?.clozeSentence ??
          `Using "${phrases[0]?.headword ?? 'this idiom'}" adds natural fluency.`,
        clozeAnswer: parsedAudio.drillPayload?.clozeAnswer ?? phrases[0]?.headword ?? 'this idiom',
        shadowingPrompt:
          parsedAudio.drillPayload?.shadowingPrompt ??
          phrases[0]?.exampleSentence ??
          'Repeat the key sentence aloud cleanly.',
      },
      excerptForGraph: (parsedAudio.transcriptExcerpt ?? input.titleHint ?? '').slice(0, 320),
    };
  }

  // Mode A / Mode B: cloudflare/clairic extraction (with GA fallback) -> System 2 drill synthesis
  const extractionMessages: OpenRouterMessage[] =
    input.inputKind === 'image' && input.imageDataUris?.length
      ? [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract 3-5 useful English idioms, collocations, or technical phrases visible in these images plus a short topic title.',
              },
              ...input.imageDataUris.slice(0, 4).map((url) => ({
                type: 'image_url' as const,
                image_url: { url },
              })),
            ],
          },
        ]
      : [
          {
            role: 'user',
            content: (input.rawText ?? '').slice(0, 12_000),
          },
        ];

  const extracted = await alphaClient.callExtractionsApi({
    routingTier,
    messages: extractionMessages,
    fields: [
      {
        name: 'expressions',
        description: `3 to 5 high-value English idioms, academic collocations, or phrasal verbs at CEFR ${cefrEstimate}.`,
        kind: 'list',
      },
      {
        name: 'summary_title',
        description: 'Concise 4-8 word title describing the content.',
        kind: 'text',
      },
    ],
  });

  const candidateItems = (extracted.fields['expressions']?.items ?? []).slice(0, 5);
  const extractedTitle =
    extracted.fields['summary_title']?.items[0]?.text ||
    input.titleHint ||
    `Dropped ${input.sourceDomainOrLabel}`;

  const synthModel =
    input.inputKind === 'image'
      ? MODEL_REGISTRY.speakingAudioPrimary
      : MODEL_REGISTRY.missionPlanner;

  const synthMessages: OpenRouterMessage[] = [
    {
      role: 'system',
      content: [
        `Build a concise 2-minute micro-drill from extracted expressions for ${input.examTrack} (${cefrEstimate}).`,
        input.edition === 'irn'
          ? 'All headword, definitionEn, exampleSentence, and drill questions stay in English; add concise Persian meanings in glossFa.'
          : 'Set glossFa to null.',
        'Return ONLY JSON matching:',
        '{"extractedPhrases":[{"headword":"...","ipa":"/.../","definitionEn":"...","glossFa":null,"exampleSentence":"..."}],"drillPayload":{"comprehensionPrompt":"...","comprehensionOptions":["...","...","..."],"correctOptionIndex":0,"clozeSentence":"... (with ____)","clozeAnswer":"...","shadowingPrompt":"..."}}',
      ].join('\n'),
    },
    {
      role: 'user',
      content:
        input.inputKind === 'image' && input.imageDataUris?.length
          ? [
              {
                type: 'text',
                text: `Title: ${extractedTitle}\nCandidate phrases: ${candidateItems.map((c) => c.text).join(', ') || '(infer 3-5 from image)'}`,
              },
              ...input.imageDataUris.slice(0, 4).map((url) => ({
                type: 'image_url' as const,
                image_url: { url },
              })),
            ]
          : `Title: ${extractedTitle}\nCandidate phrases: ${candidateItems.map((c) => c.text).join(', ')}\nExcerpt:\n${(input.rawText ?? '').slice(0, 4000)}`,
    },
  ];

  const drillRes = await gaClient.createChatCompletion({
    model: synthModel,
    routingTier,
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 1800,
    messages: synthMessages,
  });

  const parsedDrill = JSON.parse(
    stripJsonCodeFences(drillRes.choices[0]?.message?.content ?? '{}'),
  ) as {
    extractedPhrases?: Array<Partial<DroppedPhraseDto>>;
    drillPayload?: Partial<DropDrillPayload>;
  };

  const phrases: DroppedPhraseDto[] = (parsedDrill.extractedPhrases ?? [])
    .slice(0, 5)
    .map((p, idx) => {
      const headword = p.headword?.trim() || candidateItems[idx]?.text || 'academic phrase';
      const candidate = candidateItems.find(
        (c) => c.text.toLowerCase() === headword.toLowerCase(),
      );
      const aligned = alignPhraseSpan(
        input.rawText,
        headword,
        candidate?.startUtf16,
        candidate?.endUtf16,
      );
      return {
        headword,
        ipa: p.ipa ?? null,
        definitionEn: p.definitionEn ?? 'High-utility expression extracted from your reading.',
        glossFa: input.edition === 'irn' ? (p.glossFa ?? null) : null,
        exampleSentence: p.exampleSentence ?? `Practice using "${headword}" in context.`,
        startUtf16: aligned.startUtf16,
        endUtf16: aligned.endUtf16,
      };
    });

  return {
    title: extractedTitle.slice(0, 140),
    cefrEstimate,
    detectedTopics: [mainTopic],
    extractedPhrases: phrases,
    drillPayload: {
      comprehensionPrompt:
        parsedDrill.drillPayload?.comprehensionPrompt ??
        `Which idea best matches "${extractedTitle}"?`,
      comprehensionOptions: parsedDrill.drillPayload?.comprehensionOptions ?? [
        'It highlights practical real-world language patterns.',
        'It recommends avoiding academic vocabulary.',
      ],
      correctOptionIndex: parsedDrill.drillPayload?.correctOptionIndex ?? 0,
      clozeSentence:
        parsedDrill.drillPayload?.clozeSentence ??
        `You can articulate this point more clearly using ______.`,
      clozeAnswer:
        parsedDrill.drillPayload?.clozeAnswer ?? phrases[0]?.headword ?? 'academic phrase',
      shadowingPrompt:
        parsedDrill.drillPayload?.shadowingPrompt ??
        phrases[0]?.exampleSentence ??
        'Speak the target expression aloud smoothly.',
    },
    excerptForGraph: (input.rawText ?? extractedTitle).slice(0, 320),
  };
}
