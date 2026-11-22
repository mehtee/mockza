import type { AuthoringTier } from '../diagnostic/types.js';
import type { SupportedExamId } from '../rubrics.js';
import { estimateCefrTierFromScore } from './live-band-engine.js';
import {
  type CanonicalTopicKey,
  mapLegacyVocabTopicTag,
  normalizeCanonicalTopicKey,
  normalizeFavoriteTopicList,
} from './topic-taxonomy.js';

export interface VocabWaveCardInput {
  readonly cardId: string;
  readonly headword: string;
  readonly canonicalTopicKey?: CanonicalTopicKey;
  readonly legacyTopicTag: string;
  readonly cefrLevel?: AuthoringTier;
  readonly bandTarget?: number;
  readonly weaknessTags?: readonly string[];
  readonly baseWaveOrder?: number;
  readonly sourceKind?: 'seeded' | 'mistake_to_deck' | 'evaluation_upgrade' | 'drop_extract';
  readonly repetitions: number;
  readonly dueSerialDay: number;
  readonly isMastered?: boolean;
}

export interface AssignedVocabWaveCard<T extends VocabWaveCardInput> {
  readonly card: T;
  readonly canonicalTopicKey: CanonicalTopicKey;
  readonly waveNumber: number;
  readonly orderInWave: number;
  readonly isUnlocked: boolean;
}

export interface VocabWaveSummary {
  readonly unlockedWave: number;
  readonly totalWaves: number;
  readonly currentWaveTotal: number;
  readonly currentWaveLearned: number;
  readonly readyToUnlockNext: boolean;
  readonly dailyNewRemaining: number;
}

export const DEFAULT_VOCAB_WAVE_SIZE = 15;
export const DEFAULT_DAILY_NEW_CAP = 10;

const CEFR_NUM: Record<AuthoringTier, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

export function assignVocabWaves<T extends VocabWaveCardInput>(params: {
  readonly cards: readonly T[];
  readonly favoriteTopics: readonly string[];
  readonly examId: SupportedExamId;
  readonly currentBand: number | null;
  readonly targetBand: number;
  readonly activeWeaknessKeys: readonly string[];
  readonly unlockedWave: number;
  readonly waveSize?: number;
}): {
  readonly assigned: AssignedVocabWaveCard<T>[];
  readonly totalWaves: number;
  readonly shouldAutoUnlockNext: boolean;
} {
  const waveSize = Math.max(5, Math.min(30, params.waveSize ?? DEFAULT_VOCAB_WAVE_SIZE));
  const favSet = new Set<CanonicalTopicKey>(
    normalizeFavoriteTopicList(params.favoriteTopics),
  );
  const weakSet = new Set<string>(params.activeWeaknessKeys);
  const effectiveBand = params.currentBand ?? Math.max(5.5, params.targetBand - 0.5);
  const userCefr = estimateCefrTierFromScore(effectiveBand, params.examId) ?? 'B2';
  const userLevel = CEFR_NUM[userCefr];

  const scored = params.cards.map((card) => {
    const topic = card.canonicalTopicKey
      ? normalizeCanonicalTopicKey(card.canonicalTopicKey)
      : mapLegacyVocabTopicTag(card.legacyTopicTag);
    const cardLevel = CEFR_NUM[card.cefrLevel ?? 'B2'];
    const bandDiff = Math.abs(cardLevel - userLevel);
    const isFav = favSet.has(topic);
    const isCore = topic === 'academic_core';
    const matchesWeakness = (card.weaknessTags ?? []).some((w) => weakSet.has(w));
    const isUserMistake = card.sourceKind && card.sourceKind !== 'seeded';

    // Tier priority:
    // 0: Saved mistakes / upgrades
    // 1: Favorite topic or academic_core near user's band (<= 1 CEFR step away)
    // 2: Active weakness match or favorite topic stretch
    // 3: Cross-topic exam breadth near user's band
    // 4: Stretch C1/C2 vocabulary
    let bucket = 3;
    if (isUserMistake) {
      bucket = 0;
    } else if ((isFav || isCore) && bandDiff <= 1) {
      bucket = 1;
    } else if (matchesWeakness || isFav) {
      bucket = 2;
    } else if (bandDiff <= 1) {
      bucket = 3;
    } else {
      bucket = 4;
    }

    const relevanceScore =
      (matchesWeakness ? 200 : 0) +
      (isFav ? 120 : isCore ? 70 : 0) +
      Math.max(0, 50 - bandDiff * 20);

    return {
      card,
      topic,
      bucket,
      relevanceScore,
      baseOrder: card.baseWaveOrder ?? 500,
    };
  });

  scored.sort((a, b) => {
    if (a.bucket !== b.bucket) return a.bucket - b.bucket;
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
    if (a.baseOrder !== b.baseOrder) return a.baseOrder - b.baseOrder;
    return a.card.cardId.localeCompare(b.card.cardId);
  });

  const unlockedWave = Math.max(1, params.unlockedWave);
  const assigned: AssignedVocabWaveCard<T>[] = scored.map((entry, idx) => {
    const waveNumber = Math.floor(idx / waveSize) + 1;
    return {
      card: entry.card,
      canonicalTopicKey: entry.topic,
      waveNumber,
      orderInWave: (idx % waveSize) + 1,
      isUnlocked: entry.bucket === 0 || waveNumber <= unlockedWave,
    };
  });

  const totalWaves = Math.max(1, Math.ceil(assigned.length / waveSize));
  const currentWaveCards = assigned.filter((a) => a.waveNumber === unlockedWave);
  const learnedInWave = currentWaveCards.filter((a) => a.card.repetitions >= 1).length;
  const shouldAutoUnlockNext =
    unlockedWave < totalWaves &&
    currentWaveCards.length > 0 &&
    learnedInWave / currentWaveCards.length >= 0.6;

  return {
    assigned,
    totalWaves,
    shouldAutoUnlockNext,
  };
}

export function selectDailyReviewQueue<T extends VocabWaveCardInput>(params: {
  readonly assigned: readonly AssignedVocabWaveCard<T>[];
  readonly todaySerialDay: number;
  readonly newCardsIntroducedToday: number;
  readonly dailyNewCap?: number;
  readonly unlockedWave: number;
}): {
  readonly queue: AssignedVocabWaveCard<T>[];
  readonly summary: VocabWaveSummary;
} {
  const dailyNewCap = Math.max(1, params.dailyNewCap ?? DEFAULT_DAILY_NEW_CAP);
  const dailyNewRemaining = Math.max(0, dailyNewCap - Math.max(0, params.newCardsIntroducedToday));

  const mistakesDue: AssignedVocabWaveCard<T>[] = [];
  const waveDueReviews: AssignedVocabWaveCard<T>[] = [];
  const waveNewPool: AssignedVocabWaveCard<T>[] = [];

  for (const item of params.assigned) {
    if (!item.isUnlocked) continue;
    const isDue = item.card.dueSerialDay <= params.todaySerialDay;
    const isMistake = item.card.sourceKind && item.card.sourceKind !== 'seeded';
    if (item.card.repetitions === 0) {
      waveNewPool.push(item);
    } else if (isDue) {
      if (isMistake) {
        mistakesDue.push(item);
      } else {
        waveDueReviews.push(item);
      }
    }
  }

  const cappedNewCards = waveNewPool.slice(0, dailyNewRemaining);
  const queue = [...mistakesDue, ...waveDueReviews, ...cappedNewCards];

  const currentWaveCards = params.assigned.filter((a) => a.waveNumber === params.unlockedWave);
  const currentWaveLearned = currentWaveCards.filter((a) => a.card.repetitions >= 1).length;
  const totalWaves = Math.max(
    1,
    params.assigned.reduce((maxW, a) => Math.max(maxW, a.waveNumber), 1),
  );

  return {
    queue,
    summary: {
      unlockedWave: params.unlockedWave,
      totalWaves,
      currentWaveTotal: currentWaveCards.length,
      currentWaveLearned,
      readyToUnlockNext:
        params.unlockedWave < totalWaves &&
        currentWaveCards.length > 0 &&
        currentWaveLearned / currentWaveCards.length >= 0.6,
      dailyNewRemaining,
    },
  };
}
