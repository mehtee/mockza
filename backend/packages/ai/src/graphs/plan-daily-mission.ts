import { DailyMissionPayloadSchema } from '@mockza/contracts';
import { normalizeCanonicalTopicKey, type CanonicalTopicKey } from '@mockza/domain';
import type { z } from 'zod';
import { EvaluationModelError } from '../errors.js';
import { type AiUsageTelemetryCallback, OpenRouterClient } from '../models/openrouter.js';
import { MODEL_REGISTRY } from '../models/registry.js';
import { emitChatUsage } from '../observability/usage-extract.js';

export type DailyMissionPayload = z.infer<typeof DailyMissionPayloadSchema>;

export interface PlanDailyMissionInput {
  edition: 'glb' | 'irn';
  examTrack: string;
  focusTopic: string;
  activePhase?: 'favorite_topics' | 'weakness_transfer' | 'exam_breadth';
  phaseReasonEn?: string;
  phaseReasonFa?: string;
  currentBand?: number;
  targetBand?: number;
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
  onUsage?: AiUsageTelemetryCallback;
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

const STARTER_TOPIC_TEMPLATES: Record<CanonicalTopicKey, StarterTopicTemplate> = {
  technology_ai: {
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
  career_workplace: {
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
  health_sports: {
    promptTitleEn: 'Preventive Habits & Athletic Performance',
    promptTextEn:
      'In 4–6 sentences, argue why consistent sleep, nutrition, and conditioning outweigh short bursts of intense training.',
    promptTextFa:
      'در ۴ تا ۶ جمله انگلیسی توضیح دهید چرا خواب، تغذیه و تمرین پیوسته از فشار مقطعی و کوتاه‌مدت مؤثرتر است.',
    target1Phrase: 'Rather than prioritizing..., athletes and systems ought to...',
    target1HintEn: 'Strong comparative structure for policy and opinion questions.',
    target1HintFa: 'ساختار مقایسه‌ای عالی برای سؤال‌های استدلالی و تحلیلی.',
    target2Phrase: 'alleviate the burden on',
    target2HintEn: 'High-value collocation meaning to reduce strain on a system or body.',
    target2HintFa: 'کالوکیشن دقیق نمره ۸+ به معنای «کاهش فشار بر...».',
  },
  science_climate: {
    promptTitleEn: 'Renewable Grids vs Short-Term Energy Costs',
    promptTextEn:
      'In 4–6 sentences, evaluate how cities should balance cleaner renewable infrastructure against household energy affordability.',
    promptTextFa:
      'در ۴ تا ۶ جمله انگلیسی بررسی کنید شهرها چگونه باید میان انرژی‌های پاک و هزینهٔ معقول برق برای خانوارها تعادل بسازند.',
    target1Phrase: 'Provided that governments subsidize..., emissions could...',
    target1HintEn: 'Conditional framing ideal for environmental policy arguments.',
    target1HintFa: 'ساختار شرطی قوی برای استدلال‌های زیست‌محیطی و سیاست‌گذاری.',
    target2Phrase: 'irreversible ecological damage',
    target2HintEn: 'Exact C1 topic collocation for IELTS/PTE environmental prompts.',
    target2HintFa: 'کالوکیشن آکادمیک سطح C1 برای موضوعات محیط‌زیست.',
  },
  education_campus: {
    promptTitleEn: 'Project-Based Learning vs Standardized Exams',
    promptTextEn:
      'In 4–6 sentences, discuss whether schools prepare students better through practical projects or formal written examinations.',
    promptTextFa:
      'در ۴ تا ۶ جمله انگلیسی تحلیل کنید آیا پروژه‌های عملی دانشجویان را بهتر آماده می‌کنند یا آزمون‌های استاندارد.',
    target1Phrase: 'Whereas rote memorization encourages..., inquiry-based tasks cultivate...',
    target1HintEn: 'High-scoring contrastive structure with whereas.',
    target1HintFa: 'ساختار تقابلی حرفه‌ای با whereas برای بالا بردن نمره گرامر.',
    target2Phrase: 'foster independent critical thinking',
    target2HintEn: 'Strong Academic verb-noun collocation.',
    target2HintFa: 'کالوکیشن دقیق برای بحث‌های آموزش عالی.',
  },
  urban_society: {
    promptTitleEn: 'Compact Housing vs Public Green Spaces',
    promptTextEn:
      'In 4–6 sentences, examine how growing cities should allocate scarce urban land between affordable housing and parks.',
    promptTextFa:
      'در ۴ تا ۶ جمله انگلیسی بنویسید کلان‌شهرها چگونه باید زمین محدود شهری را بین مسکن اقتصادی و فضای سبز تقسیم کنند.',
    target1Phrase: 'Not only does dense housing expand..., it also demands...',
    target1HintEn: 'Inversion structure ("Not only does...") boosts GRA range.',
    target1HintFa: 'ساختار وارونه‌سازی برای نشان دادن تنوع گرامری نمره بالا.',
    target2Phrase: 'mitigate social isolation',
    target2HintEn: 'Authentic Band 8 collocation for urban planning topics.',
    target2HintFa: 'کالوکیشن آکادمیک برای موضوعات اجتماعی و شهری.',
  },
  arts_media: {
    promptTitleEn: 'Global Streaming Platforms & Local Culture',
    promptTextEn:
      'In 4–6 sentences, analyze whether international streaming algorithms enrich local storytelling or homogenize cultural identity.',
    promptTextFa:
      'در ۴ تا ۶ جمله انگلیسی بررسی کنید پلتفرم‌های جهانی استریم به سینمای بومی کمک می‌کنند یا فرهنگ‌ها را یکسان‌سازی می‌کنند.',
    target1Phrase: 'While global exposure amplifies..., it simultaneously risks...',
    target1HintEn: 'Balanced concessive clause weighing dual cultural impacts.',
    target1HintFa: 'ساختار متوازن برای تحلیل دو سوی یک پدیده فرهنگی.',
    target2Phrase: 'preserve cultural authenticity',
    target2HintEn: 'Natural C1 collocation for arts and heritage topics.',
    target2HintFa: 'عبارت سطح بالا به معنای «حفظ اصالت فرهنگی».',
  },
  travel_culture: {
    promptTitleEn: 'High-Speed Rail vs Sustainable Tourism',
    promptTextEn:
      'In 4–6 sentences, compare investing in high-speed intercity rail and heritage preservation against mass short-haul tourism.',
    promptTextFa:
      'در ۴ تا ۶ جمله انگلیسی سرمایه‌گذاری در قطار سریع‌السیر و گردشگری پایدار را با سفرهای پرحجم مقایسه کنید.',
    target1Phrase: 'Had regions modernized rail corridors earlier, travelers would...',
    target1HintEn: 'Inverted third conditional for infrastructure reflection.',
    target1HintFa: 'شرطی نوع سوم معکوس؛ ساختار ممتاز برای تحلیل حمل‌ونقل و سفر.',
    target2Phrase: 'alleviate chronic congestion',
    target2HintEn: 'High-value Band 8 urban-mobility collocation.',
    target2HintFa: 'کالوکیشن دقیق برای کاهش ترافیک و ازدحام.',
  },
  academic_core: {
    promptTitleEn: 'Open-Science Data Sharing vs Commercial Patents',
    promptTextEn:
      'In 4–6 sentences, explain whether publicly funded laboratories should publish raw data immediately or allow commercial patent windows.',
    promptTextFa:
      'در ۴ تا ۶ جمله انگلیسی توضیح دهید آیا پژوهش‌های با بودجه عمومی باید فوراً داده‌ها را منتشر کنند یا مهلت ثبت تجاری داشته باشند.',
    target1Phrase: 'Even though exclusive patents incentivize..., open replication accelerates...',
    target1HintEn: 'Nuanced causal comparison using Even though.',
    target1HintFa: 'ساختار پیچیده و دقیق برای مقایسه انگیزه‌های علمی.',
    target2Phrase: 'reproducible empirical evidence',
    target2HintEn: 'Precision C1 research vocabulary.',
    target2HintFa: 'واژگان تخصصی سطح C1 در پژوهش و علم.',
  },
  business_finance: {
    promptTitleEn: 'Financial Literacy vs Consumer Credit Regulation',
    promptTextEn:
      'In 4–6 sentences, discuss whether school financial education or stricter lending regulation better protects young households from debt.',
    promptTextFa:
      'در ۴ تا ۶ جمله انگلیسی بررسی کنید آموزش سواد مالی مؤثرتر است یا قوانین سخت‌گیرانه‌تر وام‌دهی.',
    target1Phrase: 'Without transparent borrowing safeguards, households become...',
    target1HintEn: 'Prepositional conditional frame without "if".',
    target1HintFa: 'جمله شرطی پیشرفته با Without برای نشان دادن پیامد اقتصادی.',
    target2Phrase: 'long-term financial resilience',
    target2HintEn: 'Sophisticated Band 8 economics phrase.',
    target2HintFa: 'عبارت دقیق نمره ۸+ برای اقتصاد و بودجه خانوار.',
  },
};

function matchStarterTemplate(topic: string): StarterTopicTemplate {
  const canonical = normalizeCanonicalTopicKey(topic) ?? 'technology_ai';
  return STARTER_TOPIC_TEMPLATES[canonical] ?? STARTER_TOPIC_TEMPLATES.technology_ai;
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
    topicSelectionReasonEn: input.phaseReasonEn ?? null,
    topicSelectionReasonFa: isIrn ? (input.phaseReasonFa ?? null) : null,
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

  const startedAt = Date.now();
  const res = await client.createChatCompletion({
    model,
    routingTier: options.routingTier ?? 'standard',
    featureKind: 'daily_mission_eval',
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
  await emitChatUsage(
    'daily_mission_eval',
    model,
    res,
    Date.now() - startedAt,
    options.onUsage,
  );

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

  const phaseLine = input.activePhase
    ? `Adaptive Phase: ${input.activePhase}${input.phaseReasonEn ? ` (${input.phaseReasonEn})` : ''}. Current estimated band: ${input.currentBand ?? 'uncalibrated'}, Target band: ${input.targetBand ?? '7.0'}.`
    : '';

  const systemPrompt = [
    'You are an adaptive language coach generating a high-signal 10-minute Daily Mission.',
    `Target exam track: ${input.examTrack}. Focus interest topic: ${input.focusTopic}.`,
    phaseLine,
    editionInstruction,
    'Return ONLY JSON matching:',
    '{"estimatedSeconds":600,"warmupCardIds":["..."],"forcedTargets":[{"canonicalKey":"...","phraseEn":"...","hintEn":"...","hintFa":null}],"promptTitle":"...","promptTextEn":"...","promptTextFa":null,"responseMode":"writing"|"speaking"}',
    'Always provide exactly 2 actionable forcedTargets combining the learner bottleneck + SM-2 vocabulary.',
  ]
    .filter((l) => l.length > 0)
    .join('\n');

  const userPrompt = `Top Bottlenecks:\n${bottlenecksDesc}\n\nDue SM-2 Cards:\n${dueDesc}\n\nPreferred mode: ${input.responseMode ?? 'writing'}`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const startedAt = Date.now();
      const res = await client.createChatCompletion({
        model: MODEL_REGISTRY.missionPlanner,
        routingTier: tier,
        featureKind: 'daily_mission_plan',
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
      await emitChatUsage(
        'daily_mission_plan',
        MODEL_REGISTRY.missionPlanner,
        res,
        Date.now() - startedAt,
        options.onUsage,
      );

      const raw = stripJsonCodeFences(res.choices[0]?.message?.content ?? '{}');
      const parsedJson = JSON.parse(raw) as Record<string, unknown>;
      // Ensure warmupCardIds always carries valid card IDs from input
      if (!Array.isArray(parsedJson['warmupCardIds'])) {
        parsedJson['warmupCardIds'] = input.dueCards.slice(0, 5).map((c) => c.cardId);
      }
      if (input.phaseReasonEn && parsedJson['topicSelectionReasonEn'] == null) {
        parsedJson['topicSelectionReasonEn'] = input.phaseReasonEn;
      }
      if (input.edition === 'irn' && input.phaseReasonFa && parsedJson['topicSelectionReasonFa'] == null) {
        parsedJson['topicSelectionReasonFa'] = input.phaseReasonFa;
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
