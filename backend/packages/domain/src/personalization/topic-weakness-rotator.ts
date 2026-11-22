import {
  computeNodePriorityScore,
  type LinguisticNodeSummary,
} from '../advanced/linguistic-graph-math.js';
import type { AuthoringTier } from '../diagnostic/types.js';
import type { SupportedExamId } from '../rubrics.js';
import { estimateCefrTierFromScore } from './live-band-engine.js';
import {
  CANONICAL_TOPICS,
  type CanonicalTopicKey,
  getTopicLabel,
  normalizeFavoriteTopicList,
} from './topic-taxonomy.js';

export type AdaptationPhase =
  | 'ignition'
  | 'interest_weakness'
  | 'cross_topic_transfer'
  | 'exam_breadth';

export interface TopicWeaknessCoverageEntry {
  readonly weaknessKey: string;
  readonly topicKey: CanonicalTopicKey;
  readonly practiceCount: number;
  readonly passCount: number;
  readonly lastMasteryMilli: number;
  readonly lastPracticedDaySerial: number;
}

export interface AdaptiveContentCandidate {
  readonly id: string;
  readonly topicKeys: readonly CanonicalTopicKey[];
  readonly weaknessTags: readonly string[];
  readonly cefrMin: AuthoringTier;
  readonly cefrMax: AuthoringTier;
  readonly lastAttemptedDaySerial?: number | null;
  readonly attemptCount?: number;
}

export interface WeaknessPhaseDecision {
  readonly weaknessKey: string;
  readonly phase: AdaptationPhase;
  readonly favCoverageCount: number;
  readonly favoredTopic: CanonicalTopicKey | null;
  readonly transferTopic: CanonicalTopicKey | null;
}

export interface RankedContentItem<T extends AdaptiveContentCandidate> {
  readonly item: T;
  readonly score: number;
  readonly phase: AdaptationPhase;
  readonly matchedTopic: CanonicalTopicKey;
  readonly matchedWeaknessKey: string | null;
  readonly reasonEn: string;
  readonly reasonFa: string;
}

export interface NextCoachTopicSelection {
  readonly topicKey: CanonicalTopicKey;
  readonly topicLabelEn: string;
  readonly topicLabelFa: string;
  readonly phase: AdaptationPhase;
  readonly primaryWeaknessKey: string | null;
  readonly reasonEn: string;
  readonly reasonFa: string;
}

const CEFR_ORDER: Record<AuthoringTier, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

const MASTERED_THRESHOLD_MILLI = 780;

export function resolveWeaknessPhase(params: {
  readonly weaknessNodes: readonly LinguisticNodeSummary[];
  readonly favoriteTopics: readonly CanonicalTopicKey[];
  readonly coverage: readonly TopicWeaknessCoverageEntry[];
  readonly currentDaySerial: number;
  readonly availableTopicsWithWeakness?: ReadonlySet<CanonicalTopicKey>;
}): {
  readonly overallPhase: AdaptationPhase;
  readonly activeWeaknesses: readonly LinguisticNodeSummary[];
  readonly perWeakness: Record<string, WeaknessPhaseDecision>;
} {
  const favs = normalizeFavoriteTopicList(params.favoriteTopics);
  const favSet = new Set<CanonicalTopicKey>(favs);

  const priorityFor = (node: LinguisticNodeSummary) =>
    computeNodePriorityScore({ node, currentDaySerial: params.currentDaySerial });

  const activeWeaknesses = params.weaknessNodes
    .filter((n) => n.nodeKind === 'bottleneck' && n.masteryScoreMilli < MASTERED_THRESHOLD_MILLI)
    .slice()
    .sort((a, b) => {
      const pa = priorityFor(a);
      const pb = priorityFor(b);
      if (pb !== pa) return pb - pa;
      return a.canonicalKey.localeCompare(b.canonicalKey);
    });

  if (activeWeaknesses.length === 0) {
    const hasHistory =
      params.weaknessNodes.some((n) => n.nodeKind === 'bottleneck') ||
      params.coverage.some((c) => c.practiceCount > 0);
    return {
      overallPhase: hasHistory ? 'exam_breadth' : 'ignition',
      activeWeaknesses: [],
      perWeakness: {},
    };
  }

  const perWeakness: Record<string, WeaknessPhaseDecision> = {};
  const transferTopicsPriority = CANONICAL_TOPICS.filter(
    (t) => t !== 'academic_core' && !favSet.has(t),
  );

  for (const w of activeWeaknesses) {
    const covForW = params.coverage.filter((c) => c.weaknessKey === w.canonicalKey);
    const favCovCount = covForW
      .filter((c) => favSet.has(c.topicKey))
      .reduce((sum, c) => sum + c.practiceCount, 0);

    const practicedFavs = new Set(
      covForW.filter((c) => favSet.has(c.topicKey) && c.practiceCount >= 1).map((c) => c.topicKey),
    );
    const unpracticedFav = favs.find((t) => !practicedFavs.has(t)) ?? favs[0] ?? null;

    const noFavHasRemainingContent =
      params.availableTopicsWithWeakness != null &&
      favs.length > 0 &&
      !favs.some((t) => params.availableTopicsWithWeakness!.has(t));

    const readyForTransfer =
      favs.length === 0 || favCovCount >= 2 || noFavHasRemainingContent;

    if (!readyForTransfer) {
      perWeakness[w.canonicalKey] = {
        weaknessKey: w.canonicalKey,
        phase: 'interest_weakness',
        favCoverageCount: favCovCount,
        favoredTopic: unpracticedFav,
        transferTopic: null,
      };
    } else {
      const practicedCountsByTopic = new Map<CanonicalTopicKey, number>(
        covForW.map((c) => [c.topicKey, c.practiceCount]),
      );
      const leastPracticedOther =
        transferTopicsPriority
          .slice()
          .sort((a, b) => {
            const ca = practicedCountsByTopic.get(a) ?? 0;
            const cb = practicedCountsByTopic.get(b) ?? 0;
            if (ca !== cb) return ca - cb;
            return a.localeCompare(b);
          })[0] ?? 'science_climate';

      perWeakness[w.canonicalKey] = {
        weaknessKey: w.canonicalKey,
        phase: 'cross_topic_transfer',
        favCoverageCount: favCovCount,
        favoredTopic: null,
        transferTopic: leastPracticedOther,
      };
    }
  }

  const topDecision = perWeakness[activeWeaknesses[0]!.canonicalKey];
  return {
    overallPhase: topDecision?.phase ?? 'interest_weakness',
    activeWeaknesses,
    perWeakness,
  };
}

function bandFitScore(
  itemMin: AuthoringTier,
  itemMax: AuthoringTier,
  currentTier: AuthoringTier,
): number {
  const cur = CEFR_ORDER[currentTier];
  // ZPD target is slightly above current tier when below C2
  const zpd = Math.min(6, cur + (cur < 6 ? 0.5 : 0));
  const lo = CEFR_ORDER[itemMin];
  const hi = CEFR_ORDER[itemMax];
  if (zpd >= lo - 0.5 && zpd <= hi + 0.5) return 1.0;
  const dist = zpd < lo ? lo - zpd : zpd - hi;
  return Math.max(0.15, Number((1.0 - dist * 0.25).toFixed(3)));
}

export function rankAdaptiveCandidates<T extends AdaptiveContentCandidate>(params: {
  readonly candidates: readonly T[];
  readonly weaknessNodes: readonly LinguisticNodeSummary[];
  readonly favoriteTopics: readonly CanonicalTopicKey[];
  readonly coverage: readonly TopicWeaknessCoverageEntry[];
  readonly examId: SupportedExamId;
  readonly currentBand: number | null;
  readonly targetBand: number;
  readonly currentDaySerial: number;
}): RankedContentItem<T>[] {
  const favs = normalizeFavoriteTopicList(params.favoriteTopics);
  const favSet = new Set<CanonicalTopicKey>(favs);
  const currentTier =
    estimateCefrTierFromScore(params.currentBand ?? Math.max(5.0, params.targetBand - 1.0), params.examId) ??
    'B2';

  const phaseInfo = resolveWeaknessPhase({
    weaknessNodes: params.weaknessNodes,
    favoriteTopics: favs,
    coverage: params.coverage,
    currentDaySerial: params.currentDaySerial,
  });

  const activeWeaknessPriority = new Map<string, number>();
  for (const node of phaseInfo.activeWeaknesses) {
    activeWeaknessPriority.set(
      node.canonicalKey,
      computeNodePriorityScore({ node, currentDaySerial: params.currentDaySerial }) / 1000,
    );
  }

  const ranked = params.candidates.map((item): RankedContentItem<T> => {
    let bestWeakness: string | null = null;
    let weaknessMatch = 0;
    for (const tag of item.weaknessTags) {
      const p = activeWeaknessPriority.get(tag) ?? 0;
      if (p > weaknessMatch) {
        weaknessMatch = p;
        bestWeakness = tag;
      }
    }
    if (phaseInfo.activeWeaknesses.length === 0) {
      weaknessMatch = 0.4;
    }

    const decision = bestWeakness ? phaseInfo.perWeakness[bestWeakness] : undefined;
    const effectivePhase: AdaptationPhase = decision?.phase ?? phaseInfo.overallPhase;
    const topics = item.topicKeys.length > 0 ? item.topicKeys : (['academic_core'] as const);
    const hasFavTopic = topics.some((t) => favSet.has(t));
    const hasCore = topics.includes('academic_core');
    const matchedTopic =
      (effectivePhase === 'cross_topic_transfer'
        ? topics.find((t) => !favSet.has(t))
        : topics.find((t) => favSet.has(t))) ?? topics[0]!;

    let topicPhaseFit = 0.25;
    if (effectivePhase === 'ignition') {
      topicPhaseFit = hasFavTopic ? 1.0 : hasCore ? 0.55 : 0.15;
    } else if (effectivePhase === 'interest_weakness') {
      topicPhaseFit = hasFavTopic ? (bestWeakness ? 1.0 : 0.7) : hasCore ? 0.45 : 0.25;
    } else if (effectivePhase === 'cross_topic_transfer') {
      topicPhaseFit = !hasFavTopic ? (bestWeakness ? 1.0 : 0.7) : 0.35;
    } else {
      // exam_breadth: reward unseen non-saturated topics
      topicPhaseFit = (item.attemptCount ?? 0) === 0 ? 0.95 : 0.45;
    }

    const bFit = bandFitScore(item.cefrMin, item.cefrMax, currentTier);

    let novelty = 1.0;
    if (item.lastAttemptedDaySerial != null) {
      const age = Math.max(0, params.currentDaySerial - item.lastAttemptedDaySerial);
      novelty = age < 7 ? 0.08 : age < 14 ? 0.45 : 0.75;
    }

    const total = Number(
      (0.38 * weaknessMatch + 0.27 * topicPhaseFit + 0.2 * bFit + 0.15 * novelty).toFixed(4),
    );

    const topicEn = getTopicLabel(matchedTopic, 'glb');
    const topicFa = getTopicLabel(matchedTopic, 'irn');

    let reasonEn: string;
    let reasonFa: string;
    if (effectivePhase === 'cross_topic_transfer' && bestWeakness) {
      reasonEn = `Transfer Challenge: practicing ${bestWeakness.split(':').pop()?.replaceAll('_', ' ')} in ${topicEn}`;
      reasonFa = `چالش انتقال مهارت: تمرین نقطه ضعف شما در موضوع جدید «${topicFa}»`;
    } else if (hasFavTopic && bestWeakness) {
      reasonEn = `Your topic (${topicEn}) + fixes ${bestWeakness.split(':').pop()?.replaceAll('_', ' ')}`;
      reasonFa = `موضوع دلخواه (${topicFa}) + رفع خطای پرتکرار شما`;
    } else if (hasFavTopic) {
      reasonEn = `Matches your favorite topic: ${topicEn} (${currentTier} fit)`;
      reasonFa = `متناسب با علاقه شما (${topicFa}) و سطح ${currentTier}`;
    } else {
      reasonEn = `Exam breadth · ${topicEn} (${item.cefrMin}–${item.cefrMax})`;
      reasonFa = `پوشش تنوع موضوعات آزمون · ${topicFa} (${item.cefrMin}–${item.cefrMax})`;
    }

    return {
      item,
      score: total,
      phase: effectivePhase,
      matchedTopic,
      matchedWeaknessKey: bestWeakness,
      reasonEn,
      reasonFa,
    };
  });

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.item.id.localeCompare(b.item.id);
  });

  return ranked;
}

export function selectNextCoachTopic(params: {
  readonly weaknessNodes: readonly LinguisticNodeSummary[];
  readonly favoriteTopics: readonly CanonicalTopicKey[];
  readonly coverage: readonly TopicWeaknessCoverageEntry[];
  readonly currentDaySerial: number;
  readonly recentMissionTopics?: readonly CanonicalTopicKey[];
}): NextCoachTopicSelection {
  const favs = normalizeFavoriteTopicList(params.favoriteTopics);
  const effectiveFavs: CanonicalTopicKey[] =
    favs.length > 0 ? favs : ['technology_ai', 'education_campus', 'science_climate'];

  const recentSet = new Set(params.recentMissionTopics ?? []);
  const phaseInfo = resolveWeaknessPhase({
    weaknessNodes: params.weaknessNodes,
    favoriteTopics: effectiveFavs,
    coverage: params.coverage,
    currentDaySerial: params.currentDaySerial,
  });

  const topWeakness = phaseInfo.activeWeaknesses[0] ?? null;

  if (!topWeakness) {
    // Ignition or Exam Breadth: rotate across favorite topics cleanly (avoid repeating yesterday's!)
    const candidatePool =
      phaseInfo.overallPhase === 'exam_breadth'
        ? CANONICAL_TOPICS.filter((t) => t !== 'academic_core')
        : effectiveFavs;
    const pick =
      candidatePool.find((t) => !recentSet.has(t)) ??
      candidatePool[params.currentDaySerial % candidatePool.length]!;
    const labelEn = getTopicLabel(pick, 'glb');
    const labelFa = getTopicLabel(pick, 'irn');
    return {
      topicKey: pick,
      topicLabelEn: labelEn,
      topicLabelFa: labelFa,
      phase: phaseInfo.overallPhase,
      primaryWeaknessKey: null,
      reasonEn:
        phaseInfo.overallPhase === 'exam_breadth'
          ? `Broadening exam fluency with fresh topic: ${labelEn}`
          : `Starting with your favorite topic: ${labelEn}`,
      reasonFa:
        phaseInfo.overallPhase === 'exam_breadth'
          ? `گسترش تسلط در موضوعات متنوع آزمون: ${labelFa}`
          : `شروع با موضوع مورد علاقه شما: ${labelFa}`,
    };
  }

  const decision = phaseInfo.perWeakness[topWeakness.canonicalKey]!;
  if (decision.phase === 'cross_topic_transfer') {
    const transferPool = CANONICAL_TOPICS.filter(
      (t) => t !== 'academic_core' && !effectiveFavs.includes(t),
    );
    const chosen =
      transferPool.find((t) => !recentSet.has(t)) ??
      decision.transferTopic ??
      'science_climate';
    const labelEn = getTopicLabel(chosen, 'glb');
    const labelFa = getTopicLabel(chosen, 'irn');
    return {
      topicKey: chosen,
      topicLabelEn: labelEn,
      topicLabelFa: labelFa,
      phase: 'cross_topic_transfer',
      primaryWeaknessKey: topWeakness.canonicalKey,
      reasonEn: `You practiced this weak spot in your favorite topics — now transferring it to ${labelEn}.`,
      reasonFa: `این نقطه ضعف را در موضوعات دلخواه تمرین کردید؛ اکنون آن را در موضوع جدید «${labelFa}» تثبیت می‌کنیم.`,
    };
  }

  const favChosen =
    effectiveFavs.find((t) => !recentSet.has(t)) ?? decision.favoredTopic ?? effectiveFavs[0]!;
  const labelEn = getTopicLabel(favChosen, 'glb');
  const labelFa = getTopicLabel(favChosen, 'irn');
  return {
    topicKey: favChosen,
    topicLabelEn: labelEn,
    topicLabelFa: labelFa,
    phase: 'interest_weakness',
    primaryWeaknessKey: topWeakness.canonicalKey,
    reasonEn: `Targeting your top weak spot inside your favorite topic: ${labelEn}.`,
    reasonFa: `تمرین روی مهم‌ترین نقطه ضعف شما در موضوع دلخواهتان (${labelFa}).`,
  };
}
