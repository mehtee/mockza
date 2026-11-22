import {
  OpenRouterAlphaClient,
  type DecisionOutcome,
  type DecisionQuestion,
} from '../models/openrouter-alpha.js';
import type { AiUsageTelemetryCallback } from '../models/openrouter.js';
import { EvaluationModelError } from '../errors.js';

export type LinguisticSourceKind =
  | 'writing'
  | 'speaking'
  | 'diagnostic'
  | 'register_shifter'
  | 'drop_anything'
  | 'mission';

export interface LinguisticSignalDelta {
  nodeKind: 'bottleneck' | 'target_structure' | 'interest_topic';
  canonicalKey: string;
  displayLabelEn: string;
  displayLabelFa: string;
  coachNoteEn: string;
  coachNoteFa: string;
  observedPolarity: 'gap_observed' | 'target_used' | 'interest_matched';
  excerptText: string | null;
}

export interface UpdateLinguisticGraphInput {
  edition: 'glb' | 'irn';
  sourceKind: LinguisticSourceKind;
  textSample: string;
  dueTargetPhrases?: string[];
  topicHint?: string;
}

export interface UpdateLinguisticGraphOutput {
  modelUsed: string;
  usedFallback: boolean;
  signals: LinguisticSignalDelta[];
  grammaticalVarietyScore: number;
}

export interface UpdateLinguisticGraphOptions {
  alphaClient?: OpenRouterAlphaClient;
  allowDemoEvaluator?: boolean;
  onUsage?: AiUsageTelemetryCallback;
}

const TOPIC_CATALOG: ReadonlyArray<{
  key: string;
  labelEn: string;
  labelFa: string;
  keywords: readonly string[];
}> = [
  {
    key: 'topic:artificial_intelligence',
    labelEn: 'Artificial Intelligence',
    labelFa: 'هوش مصنوعی',
    keywords: ['ai', 'model', 'algorithm', 'neural', 'automation', 'llm', 'machine learning'],
  },
  {
    key: 'topic:software_engineering',
    labelEn: 'Software Engineering',
    labelFa: 'مهندسی نرم‌افزار',
    keywords: ['code', 'software', 'api', 'database', 'architecture', 'deploy', 'cloud'],
  },
  {
    key: 'topic:business_workplace',
    labelEn: 'Workplace & Leadership',
    labelFa: 'محیط کار و مدیریت',
    keywords: ['meeting', 'deadline', 'project', 'team', 'manager', 'client', 'quarterly'],
  },
  {
    key: 'topic:sports_football',
    labelEn: 'Sports & Football',
    labelFa: 'ورزش و فوتبال',
    keywords: ['football', 'soccer', 'match', 'goal', 'league', 'coach', 'stadium'],
  },
  {
    key: 'topic:culture_cinema',
    labelEn: 'Cinema & Media',
    labelFa: 'سینما و رسانه',
    keywords: ['movie', 'film', 'director', 'series', 'book', 'podcast', 'documentary'],
  },
  {
    key: 'topic:society_environment',
    labelEn: 'Society & Environment',
    labelFa: 'جامعه و محیط‌زیست',
    keywords: ['climate', 'city', 'policy', 'education', 'housing', 'public', 'transport'],
  },
  {
    key: 'topic:health_wellbeing',
    labelEn: 'Health & Psychology',
    labelFa: 'سلامت و روان‌شناسی',
    keywords: ['health', 'sleep', 'exercise', 'nutrition', 'stress', 'mental', 'habit'],
  },
  {
    key: 'topic:everyday_life',
    labelEn: 'Everyday Conversations',
    labelFa: 'گفت‌وگوهای روزمره',
    keywords: ['weekend', 'friend', 'family', 'trip', 'coffee', 'dinner', 'morning'],
  },
];

function extractShortExcerpt(text: string): string | null {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 220);
}

function resolveTopicMeta(topicKey: string) {
  return (
    TOPIC_CATALOG.find((t) => t.key === topicKey || t.key.endsWith(`:${topicKey}`)) ??
    TOPIC_CATALOG[TOPIC_CATALOG.length - 1]!
  );
}

export function analyzeLinguisticSignalsDemoOnly(
  input: UpdateLinguisticGraphInput,
): UpdateLinguisticGraphOutput {
  const lower = input.textSample.toLowerCase();
  const excerpt = extractShortExcerpt(input.textSample);
  const signals: LinguisticSignalDelta[] = [];

  const hasConditional = /\b(if|unless|provided that|were we to|had i)\b/i.test(input.textSample);
  if (!hasConditional) {
    signals.push({
      nodeKind: 'bottleneck',
      canonicalKey: 'grammar:conditional_avoidance',
      displayLabelEn: 'Conditional Clause Avoidance',
      displayLabelFa: 'پرهیز از جملات شرطی',
      coachNoteEn: 'Practice complex conditional framing (e.g., "provided that", inverted conditionals).',
      coachNoteFa: 'در پاسخ بعدی از ساختارهای شرطی پیچیده‌تر (مانند if/unless یا شرطی معکوس) استفاده کنید.',
      observedPolarity: 'gap_observed',
      excerptText: excerpt,
    });
  } else {
    signals.push({
      nodeKind: 'target_structure',
      canonicalKey: 'grammar:conditional_framing',
      displayLabelEn: 'Conditional Framing',
      displayLabelFa: 'ساختار جملات شرطی',
      coachNoteEn: 'Good control of conditional hypothetical clauses.',
      coachNoteFa: 'تسلط خوبی روی جملات شرطی در متن/صحبت نشان دادید.',
      observedPolarity: 'target_used',
      excerptText: excerpt,
    });
  }

  const basicOveruse = (lower.match(/\b(very|good|bad|nice|a lot|big)\b/g) ?? []).length;
  if (basicOveruse >= 2) {
    signals.push({
      nodeKind: 'bottleneck',
      canonicalKey: 'lexis:evaluative_overuse_good_bad',
      displayLabelEn: 'Overuse of Basic Modifiers (good/bad/very)',
      displayLabelFa: 'استفاده بیش‌ازحد از صفت‌های ساده (good/bad/very)',
      coachNoteEn: 'Replace vague modifiers with precise collocations (e.g., substantial, detrimental).',
      coachNoteFa: 'به‌جای good/bad/very از صفت‌های دقیق‌تر مثل compelling یا detrimental استفاده کنید.',
      observedPolarity: 'gap_observed',
      excerptText: excerpt,
    });
  }

  const dueMatched = (input.dueTargetPhrases ?? []).some((phrase) =>
    lower.includes(phrase.trim().toLowerCase()),
  );
  if (dueMatched && (input.dueTargetPhrases?.length ?? 0) > 0) {
    const firstMatched =
      input.dueTargetPhrases?.find((p) => lower.includes(p.trim().toLowerCase())) ??
      input.dueTargetPhrases![0]!;
    signals.push({
      nodeKind: 'target_structure',
      canonicalKey: `lexis:target_${firstMatched.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 48)}`,
      displayLabelEn: firstMatched,
      displayLabelFa: firstMatched,
      coachNoteEn: `Successfully recycled target expression "${firstMatched}" in context.`,
      coachNoteFa: `اصطلاح هدف «${firstMatched}» را به‌درستی در بافت جمله به کار بردید.`,
      observedPolarity: 'target_used',
      excerptText: excerpt,
    });
  }

  let matchedTopic = TOPIC_CATALOG[TOPIC_CATALOG.length - 1]!;
  for (const candidate of TOPIC_CATALOG) {
    if (
      input.topicHint &&
      candidate.labelEn.toLowerCase().includes(input.topicHint.toLowerCase())
    ) {
      matchedTopic = candidate;
      break;
    }
    if (candidate.keywords.some((kw) => lower.includes(kw))) {
      matchedTopic = candidate;
      break;
    }
  }

  signals.push({
    nodeKind: 'interest_topic',
    canonicalKey: matchedTopic.key,
    displayLabelEn: matchedTopic.labelEn,
    displayLabelFa: matchedTopic.labelFa,
    coachNoteEn: `Engages actively with ${matchedTopic.labelEn}.`,
    coachNoteFa: `موضوع مورد علاقه: ${matchedTopic.labelFa}`,
    observedPolarity: 'interest_matched',
    excerptText: excerpt,
  });

  return {
    modelUsed: 'demo-heuristic-uncalibrated',
    usedFallback: false,
    signals,
    grammaticalVarietyScore: hasConditional ? 4 : 3,
  };
}

function buildSignalsFromDecisionOutcomes(
  input: UpdateLinguisticGraphInput,
  outcomes: Record<string, DecisionOutcome>,
): LinguisticSignalDelta[] {
  const excerpt = extractShortExcerpt(input.textSample);
  const signals: LinguisticSignalDelta[] = [];

  if (outcomes['avoided_conditionals']?.boolValue) {
    signals.push({
      nodeKind: 'bottleneck',
      canonicalKey: 'grammar:conditional_avoidance',
      displayLabelEn: 'Conditional Clause Avoidance',
      displayLabelFa: 'پرهیز از جملات شرطی',
      coachNoteEn: 'Integrate second/third conditionals or inversion ("Had policy changed...") into arguments.',
      coachNoteFa: 'در استدلال‌های بعدی از جملات شرطی نوع دوم/سوم یا ساختار معکوس استفاده کنید.',
      observedPolarity: 'gap_observed',
      excerptText: excerpt,
    });
  } else {
    signals.push({
      nodeKind: 'target_structure',
      canonicalKey: 'grammar:conditional_framing',
      displayLabelEn: 'Hypothetical & Conditional Framing',
      displayLabelFa: 'جملات شرطی و فرضی دقیق',
      coachNoteEn: 'Demonstrated hypothetical or conditional structure naturally.',
      coachNoteFa: 'ساختار شرطی را با دقت در پاسخ به کار بردید.',
      observedPolarity: 'target_used',
      excerptText: excerpt,
    });
  }

  if (outcomes['overused_basic_modifiers']?.boolValue) {
    signals.push({
      nodeKind: 'bottleneck',
      canonicalKey: 'lexis:evaluative_overuse_good_bad',
      displayLabelEn: 'Basic Modifier Overuse (good/bad/very)',
      displayLabelFa: 'تکرار صفت‌های عمومی (good/bad/very)',
      coachNoteEn: 'Upgrade generic evaluative adjectives to C1 collocations (e.g., pivotal, adverse, markedly).',
      coachNoteFa: 'واژگان کلی مثل good/bad/very را با کالوکیشن‌های آکادمیک جایگزین کنید.',
      observedPolarity: 'gap_observed',
      excerptText: excerpt,
    });
  }

  if (outcomes['plural_or_tense_slips']?.boolValue) {
    signals.push({
      nodeKind: 'bottleneck',
      canonicalKey: 'morphology:plural_s_or_agreement',
      displayLabelEn: 'Plural -s & Subject-Verb Slips',
      displayLabelFa: 'جاانداختن جمع -s و تطابق فعل',
      coachNoteEn: 'Double-check countable plural -s and third-person singular agreement under time pressure.',
      coachNoteFa: 'زیر فشار زمان حواستان به جمعِ -s و مطابقت زمان فعل با فاعل باشد.',
      observedPolarity: 'gap_observed',
      excerptText: excerpt,
    });
  }

  if (outcomes['simple_connectors_only']?.boolValue) {
    signals.push({
      nodeKind: 'bottleneck',
      canonicalKey: 'cohesion:concessive_linker_gap',
      displayLabelEn: 'Concessive & Subordinating Connectors',
      displayLabelFa: 'نیاز به ربط‌دهنده‌های تقابلی (albeit / whereas)',
      coachNoteEn: 'Replace repetitive "but/so" transitions with albeit, whereas, or nevertheless.',
      coachNoteFa: 'به‌جای تکرار but و so از پیونددهنده‌های سطح بالا مثل albeit یا whereas استفاده کنید.',
      observedPolarity: 'gap_observed',
      excerptText: excerpt,
    });
  }

  if (outcomes['used_due_target_phrase']?.boolValue && (input.dueTargetPhrases?.length ?? 0) > 0) {
    const phrase = input.dueTargetPhrases![0]!;
    signals.push({
      nodeKind: 'target_structure',
      canonicalKey: `lexis:target_${phrase.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 48)}`,
      displayLabelEn: phrase,
      displayLabelFa: phrase,
      coachNoteEn: `Verified active transfer of target structure "${phrase}".`,
      coachNoteFa: `ساختار هدف «${phrase}» به‌خوبی در تولید زبانی منتقل شد.`,
      observedPolarity: 'target_used',
      excerptText: excerpt,
    });
  }

  const chosenTopic = outcomes['topic_cluster']?.choiceValue ?? 'everyday_life';
  const topicMeta = resolveTopicMeta(chosenTopic);
  signals.push({
    nodeKind: 'interest_topic',
    canonicalKey: topicMeta.key,
    displayLabelEn: topicMeta.labelEn,
    displayLabelFa: topicMeta.labelFa,
    coachNoteEn: `User interest signal observed in ${topicMeta.labelEn}.`,
    coachNoteFa: `موضوع علاقه‌مندی ردیابی شد: ${topicMeta.labelFa}`,
    observedPolarity: 'interest_matched',
    excerptText: excerpt,
  });

  return signals;
}

/**
 * LangGraph-compatible System 1 Linguistic Graph updater (`ADR-ADV-003`).
 * Uses `google/gemini-decision-1` (zero output tokens) with automatic GA fallback when the circuit breaker opens.
 */
export async function updateLinguisticGraphSignals(
  input: UpdateLinguisticGraphInput,
  options: UpdateLinguisticGraphOptions = {},
): Promise<UpdateLinguisticGraphOutput> {
  if (!input.textSample || input.textSample.trim().length < 8) {
    return {
      modelUsed: 'skipped_short_sample',
      usedFallback: false,
      signals: [],
      grammaticalVarietyScore: 3,
    };
  }

  const apiKey = process.env['OPENROUTER_API_KEY'] ?? '';
  if (!apiKey && options.allowDemoEvaluator) {
    return analyzeLinguisticSignalsDemoOnly(input);
  }
  if (!apiKey && !options.alphaClient) {
    throw new EvaluationModelError(
      'model_unavailable',
      'OPENROUTER_API_KEY missing for linguistic graph signal extraction.',
      false,
    );
  }

  const alphaClient = options.alphaClient ?? new OpenRouterAlphaClient({ apiKey });
  const dueList = (input.dueTargetPhrases ?? []).slice(0, 5).join(', ') || '(none)';

  const questions: DecisionQuestion[] = [
    {
      id: 'avoided_conditionals',
      kind: 'noul',
      prompt: 'Does the learner text avoid conditional/hypothetical structures completely?',
    },
    {
      id: 'overused_basic_modifiers',
      kind: 'noul',
      prompt: 'Does the learner overuse basic adjectives/adverbs like good, bad, big, very, or a lot?',
    },
    {
      id: 'plural_or_tense_slips',
      kind: 'noul',
      prompt: 'Are there plural -s omissions or subject-verb tense agreement errors?',
    },
    {
      id: 'simple_connectors_only',
      kind: 'noul',
      prompt: 'Does cohesion rely mainly on repetitive basic linkers (and, but, so) rather than concessive/subordinating devices?',
    },
    {
      id: 'used_due_target_phrase',
      kind: 'noul',
      prompt: `Did the text accurately integrate at least one due target phrase from [${dueList}]?`,
    },
    {
      id: 'topic_cluster',
      kind: 'choice',
      prompt: 'Select the primary domain/interest topic represented in the sample.',
      options: TOPIC_CATALOG.map((t) => t.key.replace(/^topic:/, '')),
    },
    {
      id: 'grammatical_variety_1_to_5',
      kind: 'score',
      prompt: 'Rate overall grammatical range and syntactic complexity from 1 (very basic) to 5 (advanced natural C1+).',
      minScore: 1,
      maxScore: 5,
    },
  ];

  const decisionRes = await alphaClient.callDecisionsApi({
    routingTier: 'flex',
    featureKind: 'linguistic_graph_update',
    onUsage: options.onUsage,
    messages: [
      {
        role: 'system',
        content:
          'You are an IELTS/CEFR linguistic habit classifier identifying structural bottlenecks, active vocabulary transfer, and learner topic interests.',
      },
      {
        role: 'user',
        content: `Source: ${input.sourceKind}${input.topicHint ? ` (hint: ${input.topicHint})` : ''}\nSample:\n${input.textSample.slice(0, 3500)}`,
      },
    ],
    questions,
  });

  const signals = buildSignalsFromDecisionOutcomes(input, decisionRes.outcomes);
  return {
    modelUsed: decisionRes.modelUsed,
    usedFallback: decisionRes.usedFallback,
    signals,
    grammaticalVarietyScore: decisionRes.outcomes['grammatical_variety_1_to_5']?.scoreValue ?? 3,
  };
}
