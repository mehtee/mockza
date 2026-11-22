import type { AuthoringTier } from '../diagnostic/types.js';
import type { SkillKind } from '../exams/exam-spec.js';
import { EXAM_SCALES, quantizeExamScore, type SupportedExamId } from '../rubrics.js';

export type BandConfidence = 'none' | 'provisional' | 'developing' | 'calibrated';

export type CoreExamSkill = 'reading' | 'listening' | 'writing' | 'speaking';

export type BandEventSourceKind =
  | 'full_mock'
  | 'timed_exam'
  | 'study_mode'
  | 'diagnostic'
  | 'micro_drill';

export interface BandEvidenceEvent {
  readonly skill: CoreExamSkill;
  readonly sourceKind: BandEventSourceKind;
  readonly rawScore: number;
  readonly cefrEstimate?: AuthoringTier | null;
  readonly recordedAtMs: number;
}

export interface LiveSkillBandState {
  readonly skill: CoreExamSkill;
  readonly score: number | null;
  readonly cefrEstimate: AuthoringTier | null;
  readonly confidence: BandConfidence;
  readonly sampleCount: number;
  readonly trendDelta: number | null;
  readonly lastUpdatedAtMs: number | null;
}

export interface BandShiftEvent {
  readonly previousOverall: number | null;
  readonly nextOverall: number | null;
  readonly delta: number;
}

export interface LiveBandProfile {
  readonly examId: SupportedExamId;
  readonly overallScore: number | null;
  readonly previousOverallScore: number | null;
  readonly overallConfidence: BandConfidence;
  readonly targetBand: number;
  readonly skills: Record<CoreExamSkill, LiveSkillBandState>;
  readonly bandShift: BandShiftEvent | null;
}

const CORE_SKILLS: readonly CoreExamSkill[] = ['reading', 'listening', 'writing', 'speaking'];
const HALF_LIFE_DAYS = 21;
const MS_PER_DAY = 86_400_000;

const CEFR_IELTS_MAP: Record<AuthoringTier, number> = {
  A1: 3.5,
  A2: 4.5,
  B1: 5.5,
  B2: 6.5,
  C1: 7.5,
  C2: 8.5,
};

const CEFR_TOEFL_MAP: Record<AuthoringTier, number> = {
  A1: 1.5,
  A2: 2.5,
  B1: 3.5,
  B2: 4.5,
  C1: 5.5,
  C2: 6.0,
};

const CEFR_PTE_MAP: Record<AuthoringTier, number> = {
  A1: 24,
  A2: 36,
  B1: 50,
  B2: 65,
  C1: 79,
  C2: 86,
};

const CEFR_DET_MAP: Record<AuthoringTier, number> = {
  A1: 45,
  A2: 65,
  B1: 85,
  B2: 110,
  C1: 135,
  C2: 150,
};

export function mapCefrTierToExamScore(tier: AuthoringTier, examId: SupportedExamId): number {
  switch (examId) {
    case 'ielts_academic':
    case 'ielts_general':
      return CEFR_IELTS_MAP[tier];
    case 'toefl_ibt':
      return CEFR_TOEFL_MAP[tier];
    case 'pte_academic':
      return CEFR_PTE_MAP[tier];
    case 'det':
      return CEFR_DET_MAP[tier];
  }
}

export function estimateCefrTierFromScore(
  score: number | null,
  examId: SupportedExamId,
): AuthoringTier | null {
  if (score == null || !Number.isFinite(score)) return null;
  const scale = EXAM_SCALES[examId];
  const ratio = scale.max > scale.min ? (score - scale.min) / (scale.max - scale.min) : 0;
  if (examId === 'ielts_academic' || examId === 'ielts_general') {
    if (score >= 8.25) return 'C2';
    if (score >= 7.0) return 'C1';
    if (score >= 6.0) return 'B2';
    if (score >= 5.0) return 'B1';
    if (score >= 4.0) return 'A2';
    return 'A1';
  }
  if (ratio >= 0.88) return 'C2';
  if (ratio >= 0.72) return 'C1';
  if (ratio >= 0.54) return 'B2';
  if (ratio >= 0.36) return 'B1';
  if (ratio >= 0.2) return 'A2';
  return 'A1';
}

export function sourceWeightForKind(kind: BandEventSourceKind): number {
  switch (kind) {
    case 'full_mock':
      return 1.0;
    case 'timed_exam':
      return 0.85;
    case 'study_mode':
      return 0.45;
    case 'diagnostic':
      return 0.4;
    case 'micro_drill':
      return 0.2;
  }
}

export function isCoreExamSkill(skill: SkillKind | string): skill is CoreExamSkill {
  return (
    skill === 'reading' || skill === 'listening' || skill === 'writing' || skill === 'speaking'
  );
}

export function computeLiveBandProfile(params: {
  readonly events: readonly BandEvidenceEvent[];
  readonly examId: SupportedExamId;
  readonly targetBand: number;
  readonly nowUtcMs: number;
  readonly previousOverallScore?: number | null;
}): LiveBandProfile {
  const scale = EXAM_SCALES[params.examId];
  const skillStates = {} as Record<CoreExamSkill, LiveSkillBandState>;

  const confidenceRank: Record<BandConfidence, number> = {
    none: 0,
    provisional: 1,
    developing: 2,
    calibrated: 3,
  };

  for (const skill of CORE_SKILLS) {
    const skillEvents = params.events
      .filter((e) => e.skill === skill && Number.isFinite(e.rawScore))
      .slice()
      .sort((a, b) => a.recordedAtMs - b.recordedAtMs);

    if (skillEvents.length === 0) {
      skillStates[skill] = {
        skill,
        score: null,
        cefrEstimate: null,
        confidence: 'none',
        sampleCount: 0,
        trendDelta: null,
        lastUpdatedAtMs: null,
      };
      continue;
    }

    const realEvents = skillEvents.filter(
      (e) =>
        e.sourceKind === 'full_mock' ||
        e.sourceKind === 'timed_exam' ||
        e.sourceKind === 'study_mode',
    );
    const timedEvents = skillEvents.filter(
      (e) => e.sourceKind === 'full_mock' || e.sourceKind === 'timed_exam',
    );
    const hasFullMock = skillEvents.some((e) => e.sourceKind === 'full_mock');

    let weightedSum = 0;
    let totalWeight = 0;

    for (const ev of skillEvents) {
      const ageDays = Math.max(0, (params.nowUtcMs - ev.recordedAtMs) / MS_PER_DAY);
      const decay = 0.5 ** (ageDays / HALF_LIFE_DAYS);
      let baseW = sourceWeightForKind(ev.sourceKind);
      if (ev.sourceKind === 'diagnostic') {
        baseW = 0.4 * 0.5 ** realEvents.length;
      }
      const effectiveW = baseW * decay;
      weightedSum += ev.rawScore * effectiveW;
      totalWeight += effectiveW;
    }

    const rawMean = totalWeight > 0 ? weightedSum / totalWeight : skillEvents[0]!.rawScore;
    const score = quantizeExamScore(rawMean, params.examId);
    const cefrEstimate = estimateCefrTierFromScore(score, params.examId);

    let confidence: BandConfidence = 'provisional';
    if (timedEvents.length >= 3 || (hasFullMock && timedEvents.length >= 1)) {
      confidence = 'calibrated';
    } else if (timedEvents.length >= 1) {
      confidence = 'developing';
    } else if (realEvents.length >= 2) {
      confidence = 'developing';
    }

    let trendDelta: number | null = null;
    if (skillEvents.length >= 2) {
      const splitIdx = Math.max(1, skillEvents.length - Math.min(3, Math.floor(skillEvents.length / 2)));
      const prior = skillEvents.slice(0, splitIdx);
      const recent = skillEvents.slice(splitIdx);
      const priorMean = prior.reduce((s, e) => s + e.rawScore, 0) / prior.length;
      const recentMean = recent.reduce((s, e) => s + e.rawScore, 0) / recent.length;
      const quantizedDelta =
        quantizeExamScore(recentMean, params.examId) -
        quantizeExamScore(priorMean, params.examId);
      trendDelta = Number(quantizedDelta.toFixed(2));
    }

    skillStates[skill] = {
      skill,
      score,
      cefrEstimate,
      confidence,
      sampleCount: skillEvents.length,
      trendDelta,
      lastUpdatedAtMs: skillEvents[skillEvents.length - 1]!.recordedAtMs,
    };
  }

  const populatedSkills = CORE_SKILLS.map((s) => skillStates[s]).filter(
    (s) => s.score !== null,
  );
  let overallScore: number | null = null;
  let overallConfidence: BandConfidence = 'none';

  if (populatedSkills.length > 0) {
    const mean =
      populatedSkills.reduce((acc, s) => acc + (s.score ?? 0), 0) / populatedSkills.length;
    overallScore = quantizeExamScore(mean, params.examId);

    const allCalibrated =
      populatedSkills.length === 4 &&
      populatedSkills.every((s) => confidenceRank[s.confidence] >= confidenceRank.calibrated);
    const anyDevelopingOrHigher = populatedSkills.some(
      (s) => confidenceRank[s.confidence] >= confidenceRank.developing,
    );
    if (allCalibrated) {
      overallConfidence = 'calibrated';
    } else if (populatedSkills.length >= 2 && anyDevelopingOrHigher) {
      overallConfidence = 'developing';
    } else {
      overallConfidence = 'provisional';
    }
  }

  let bandShift: BandShiftEvent | null = null;
  const prev = params.previousOverallScore ?? null;
  if (
    prev !== null &&
    overallScore !== null &&
    Math.abs(overallScore - prev) >= scale.step - 1e-6
  ) {
    bandShift = {
      previousOverall: prev,
      nextOverall: overallScore,
      delta: Number((overallScore - prev).toFixed(2)),
    };
  }

  return {
    examId: params.examId,
    overallScore,
    previousOverallScore: prev,
    overallConfidence,
    targetBand: quantizeExamScore(params.targetBand, params.examId),
    skills: skillStates,
    bandShift,
  };
}
