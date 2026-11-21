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

interface StarterTopicTemplate {
  promptTitleEn: string;
  promptTextEn: string;
  promptTextFa: string;
  target1Phrase: string;
  target1HintEn: string;
  target1HintFa: string;
  target2Phrase: string;
  target2HintEn: string;
  target2HintFa: string;
}

const STARTER_TOPIC_TEMPLATES: Record<string, StarterTopicTemplate> = {
  ai_tech: {
    promptTitleEn: 'AI at Work: Weighing Speed vs Reliability',
    promptTextEn:
      'In 4–6 sentences, explain whether teams should automate routine tasks with AI tools right away or roll them out slowly with human checks.',
    promptTextFa:
      'در ۴ تا ۶ جمله انگلیسی بنویسید یا بگویید آیا تیم‌ها باید کارهای تکراری را فوراً با هوش مصنوعی خودکار کنند یا به‌تدریج و با نظارت انسانی پیش بروند.',
    target1Phrase: 'If teams rely solely on..., they risk...',
    target1HintEn: 'Use a clean conditional frame to show a realistic consequence.',
    target1HintFa: 'از این ساختار شرطی برای بیان نتیجه یا ریسک احتمالی استفاده کنید.',
    target2Phrase: 'albeit at the cost of',
    target2HintEn: 'Use this formal linker to weigh a trade-off smoothly.',
    target2HintFa: 'برای بیان موازنه یا هزینهٔ پنهان یک مزیت از عبارت «albeit at the cost of» بهره ببرید.',
  },
  business_work: {
    promptTitleEn: 'Remote Flexibility vs In-Office Collaboration',
    promptTextEn:
      'In 4–6 sentences, discuss how hybrid work changes team communication and accountability.',
    promptTextFa:
      'در ۴ تا ۶ جمله انگلیسی درباره تأثیر کار ترکیبی (حضوری و دورکاری) بر ارتباط و مسئولیت‌پذیری تیم‌ها بنویسید یا صحبت کنید.',
    target1Phrase: 'Although remote work offers..., it can hinder...',
    target1HintEn: 'Balance two contrasting perspectives in a single complex sentence.',
    target1HintFa: 'در یک جمله مرکب هر دو سوی موضوع را متعادل بیان کنید.',
    target2Phrase: 'strike a balance between',
    target2HintEn: 'Natural Band 8 collocation for managing competing priorities.',
    target2HintFa: 'کالوکیشن طبیعی نمره ۸+ به معنای «ایجاد تعادل میان دو چیز».',
  },
  sports_football: {
    promptTitleEn: 'High-Press Tactics vs Energy Management',
    promptTextEn:
      'In 4–6 sentences, explain whether a coach should instruct players to press aggressively from the first minute or conserve stamina for the final quarter.',
    promptTextFa:
      'در ۴ تا ۶ جمله انگلیسی توضیح دهید آیا مربی باید از دقیقه اول پرس سنگین را انتخاب کند یا انرژی تیم را برای دقایق پایانی نگه دارد.',
    target1Phrase: 'Had the side maintained..., they might have...',
    target1HintEn: 'Third-conditional structure ideal for analyzing match tactics.',
    target1HintFa: 'ساختار شرطی نوع سوم، بسیار کاربردی برای تحلیل تصمیم‌های تاکتیکی.',
    target2Phrase: 'turn the tide',
    target2HintEn: 'Idiomatic phrase meaning to change the direction of a match or situation.',
    target2HintFa: 'اصطلاح طبیعی به معنای «تغییر دادن جریان بازی یا شرایط».',
  },
  medicine_health: {
    promptTitleEn: 'Preventive Habits vs Reactive Treatment',
    promptTextEn:
      'In 4–6 sentences, argue why public health systems should invest more in preventive habits like sleep and nutrition rather than waiting to treat illness.',
    promptTextFa:
      'در ۴ تا ۶ جمله انگلیسی بنویسید چرا سرمایه‌گذاری روی پیشگیری (خواب و تغذیه) مؤثرتر از درمان دیرهنگام است.',
    target1Phrase: 'Rather than treating..., systems ought to...',
    target1HintEn: 'Strong comparative structure for policy and opinion questions.',
    target1HintFa: 'ساختار مقایسه‌ای عالی برای سؤال‌های استدلالی و تحلیلی.',
    target2Phrase: 'alleviate the burden on',
    target2HintEn: 'High-value collocation meaning to reduce pressure on a system.',
    target2HintFa: 'کالوکیشن دقیق نمره ۸+ به معنای «کاهش فشار بر...».',
  },
};

function matchStarterTemplate(topic: string): StarterTopicTemplate {
  const lower = topic.toLowerCase();
  if (lower.includes('ai') || lower.includes('tech') || lower.includes('هوش')) {
    return STARTER_TOPIC_TEMPLATES['ai_tech']!;
  }
  if (lower.includes('business') || lower.includes('work') || lower.includes('کار')) {
    return STARTER_TOPIC_TEMPLATES['business_work']!;
  }
  if (lower.includes('sport') || lower.includes('football') || lower.includes('ورزش') || lower.includes('فوتبال')) {
    return STARTER_TOPIC_TEMPLATES['sports_football']!;
  }
  if (lower.includes('med') || lower.includes('health') || lower.includes('پزشک') || lower.includes('سلامت')) {
    return STARTER_TOPIC_TEMPLATES['medicine_health']!;
  }
  const cleanTopic = topic.trim() || 'Everyday Technology & Modern Life';
  return {
    promptTitleEn: `${cleanTopic}: Balancing Benefits & Trade-Offs`,
    promptTextEn: `In 4–6 natural sentences about "${cleanTopic}", compare one clear advantage with one practical challenge using both target expressions above.`,
    promptTextFa: `درباره «${cleanTopic}» ۴ تا ۶ جمله انگلیسی بنویسید یا بگویید؛ یک مزیت روشن و یک چالش واقعی را با کمک هر دو عبارت بالا مقایسه کنید.`,
    target1Phrase: 'While it is clear that..., one cannot overlook...',
    target1HintEn: `Use this balanced concessive opener to frame "${cleanTopic}".`,
    target1HintFa: 'از این ساختار متعادل برای شروع استدلال و بیان نکته مقابل استفاده کنید.',
    target2Phrase: 'in the long run',
    target2HintEn: 'Idiomatic expression meaning over an extended period of time.',
    target2HintFa: 'اصطلاح کاربردی به معنای «در درازمدت».',
  };
}

/**
 * Instant (<1ms) curated Track x Topic Day-1 Starter Coach session so brand-new
 * users never wait 20+ seconds or hit HTTP timeouts on GET /v1/missions/today.
 */
export function buildCuratedStarterMission(input: PlanDailyMissionInput): PlanDailyMissionOutput {
  const isIrn = input.edition === 'irn';
  const topicClean = input.focusTopic.trim() || 'AI & Tech';
  const tpl = matchStarterTemplate(topicClean);
  const dueWord = input.dueCards[0];
  const b0 = input.bottlenecks[0];

  const targets = [
    b0
      ? {
          canonicalKey: b0.canonicalKey,
          phraseEn: tpl.target1Phrase,
          hintEn: `${b0.displayLabelEn}: ${tpl.target1HintEn}`,
          hintFa: isIrn ? tpl.target1HintFa : null,
        }
      : {
          canonicalKey: 'grammar:balanced_framing',
          phraseEn: tpl.target1Phrase,
          hintEn: tpl.target1HintEn,
          hintFa: isIrn ? tpl.target1HintFa : null,
        },
    dueWord
      ? {
          canonicalKey: `lexis:${dueWord.word.toLowerCase()}`,
          phraseEn: dueWord.word,
          hintEn: dueWord.meaningEn
            ? `Review word: ${dueWord.meaningEn}`
            : `Use "${dueWord.word}" naturally in your answer.`,
          hintFa: isIrn
            ? dueWord.meaningFa ?? `واژه «${dueWord.word}» از دفترچه واژگان خود را در پاسخ به کار ببرید.`
            : null,
        }
      : {
          canonicalKey: 'lexis:starter_collocation',
          phraseEn: tpl.target2Phrase,
          hintEn: tpl.target2HintEn,
          hintFa: isIrn ? tpl.target2HintFa : null,
        },
  ];

  const payload = DailyMissionPayloadSchema.parse({
    estimatedSeconds: 600,
    warmupCardIds: input.dueCards.slice(0, 5).map((c) => c.cardId),
    forcedTargets: targets,
    promptTitle: tpl.promptTitleEn,
    promptTextEn: tpl.promptTextEn,
    promptTextFa: isIrn ? tpl.promptTextFa : null,
    responseMode: input.responseMode ?? 'writing',
  });

  return {
    payload,
    modelId: 'curated-starter-v1',
    promptVersion: 'curated-starter@2026-11',
  };
}

export interface EvaluateMissionInput {
  edition: 'glb' | 'irn';
  examTrack: string;
  focusTopic: string;
  forcedTargets: Array<{ phraseEn: string }>;
  responseText?: string;
  base64AudioData?: string;
  audioFormat?: 'm4a' | 'mp3' | 'wav';
}

export interface EvaluateMissionOutput {
  matchedTargets: string[];
  missedTargets: string[];
  feedbackEn: string;
  feedbackFa: string | null;
  clarityScore1To5: number;
  transcriptEn: string | null;
  inlineUpgrades: Array<{
    original: string;
    improved: string;
    whyEn: string;
    whyFa: string | null;
  }>;
  modelRewriteEn: string | null;
}

export async function evaluateMissionResponseGraph(
  input: EvaluateMissionInput,
  options: PlanDailyMissionOptions = {},
): Promise<EvaluateMissionOutput> {
  const apiKey = process.env['OPENROUTER_API_KEY'] ?? '';
  const targets = input.forcedTargets.map((t) => t.phraseEn);
  const sampleText = input.responseText?.trim() ?? '';
  const isIrn = input.edition === 'irn';

  if ((!apiKey && options.allowDemoEvaluator) || (!sampleText && !input.base64AudioData)) {
    const lower = sampleText.toLowerCase();
    const matched = targets.filter((p) => {
      const core = p.toLowerCase().replace(/\.\.\./g, '').trim().split(/\s+/).slice(0, 2).join(' ');
      return core.length >= 3 && lower.includes(core);
    });
    const missed = targets.filter((t) => !matched.includes(t));
    return {
      matchedTargets: matched,
      missedTargets: missed,
      clarityScore1To5: matched.length === targets.length ? 5 : matched.length > 0 ? 4 : 3,
      feedbackEn:
        matched.length > 0
          ? `Nice job using ${matched.join(', ')} naturally in context!`
          : `Good clarity! Next time weave in "${missed[0] ?? 'one target expression'}" in your opening sentence for higher Band impact.`,
      feedbackFa: isIrn
        ? matched.length > 0
          ? `عالی بود! ساختار (${matched.join('، ')}) را طبیعی در پاسخ به کار بردید.`
          : `پاسخ روشنی بود؛ دفعه بعد عبارت «${missed[0] ?? 'ساختار هدف'}» را در جمله اول بیاورید.`
        : null,
      transcriptEn: sampleText || null,
      inlineUpgrades: [],
      modelRewriteEn: null,
    };
  }

  const client = options.client ?? new OpenRouterClient({ apiKey, timeoutMs: 14_000 });
  const hasAudio = Boolean(input.base64AudioData);
  const model = hasAudio ? MODEL_REGISTRY.speakingAudioPrimary : MODEL_REGISTRY.drillFast;

  const res = await client.createChatCompletion({
    model,
    routingTier: options.routingTier ?? 'standard',
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 1100,
    messages: [
      {
        role: 'system',
        content: [
          `You are an encouraging, concrete English coach evaluating a short 10-min practice response (${input.examTrack}, topic: ${input.focusTopic}).`,
          hasAudio ? 'First accurately transcribe what the learner spoke into transcriptEn.' : 'Set transcriptEn equal to the learner text.',
          isIrn
            ? 'Keep transcriptEn, upgrades, and modelRewriteEn in English; write feedbackFa and whyFa in warm Persian (fa-IR).'
            : 'Set feedbackFa and whyFa to null.',
          'Return ONLY JSON matching:',
          '{"transcriptEn":"...","matchedTargets":["..."],"missedTargets":["..."],"clarityScore1To5":4,"feedbackEn":"2 concise actionable sentences praising a strength and naming 1 specific next step","feedbackFa":null,"inlineUpgrades":[{"original":"exact short phrase from learner","improved":"Band 8+ natural upgrade","whyEn":"concise reason","whyFa":null}],"modelRewriteEn":"Polished 2-4 sentence Band 8+ version preserving learner ideas."}',
        ].join('\n'),
      },
      {
        role: 'user',
        content: hasAudio
          ? [
              { type: 'text', text: `Target expressions:\n${targets.map((t) => `- ${t}`).join('\n')}` },
              {
                type: 'input_audio',
                input_audio: { data: input.base64AudioData!, format: input.audioFormat ?? 'm4a' },
              },
            ]
          : `Target expressions:\n${targets.map((t) => `- ${t}`).join('\n')}\n\nLearner response:\n${sampleText}`,
      },
    ],
  });

  const parsed = JSON.parse(stripJsonCodeFences(res.choices[0]?.message?.content ?? '{}')) as Partial<EvaluateMissionOutput>;
  const matched = Array.isArray(parsed.matchedTargets) ? parsed.matchedTargets : [];
  const missed = Array.isArray(parsed.missedTargets)
    ? parsed.missedTargets
    : targets.filter((t) => !matched.includes(t));

  return {
    matchedTargets: matched,
    missedTargets: missed,
    clarityScore1To5: Math.min(5, Math.max(1, Math.round(parsed.clarityScore1To5 ?? 4))),
    feedbackEn: parsed.feedbackEn?.trim() || 'Submitted! Keep recycling these expressions aloud.',
    feedbackFa: isIrn ? (parsed.feedbackFa ?? null) : null,
    transcriptEn: parsed.transcriptEn ?? (sampleText || null),
    inlineUpgrades: (parsed.inlineUpgrades ?? []).slice(0, 2).map((u) => ({
      original: u.original,
      improved: u.improved,
      whyEn: u.whyEn,
      whyFa: isIrn ? (u.whyFa ?? null) : null,
    })),
    modelRewriteEn: parsed.modelRewriteEn ?? null,
  };
}

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
