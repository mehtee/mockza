import {
  normalizeScoreToQualityRatio,
  normalizeSupportedExamId,
  quantizeExamScore,
  roundIeltsBand,
  type SupportedExamId,
} from '../rubrics.js';
import { addSerialDays, MILLISECONDS_PER_DAY, type SerialDay } from '../vocab/serial-day.js';
import { EXAM_TRACK_SPECS, formatExamScore, isIeltsTrack, type SkillKind } from './exam-spec.js';

export interface ScoredAttemptInput {
  readonly score: number;
  readonly skill: SkillKind;
  readonly completedAtUtcMs: number;
}

export interface SkillAttemptInput {
  readonly score: number;
  readonly skill: SkillKind;
}

export interface EstimatedBandSummary {
  readonly overallBand: number | null;
  readonly attemptedSkillsCount: number;
  readonly isFullFourSkillEstimate: boolean;
  readonly isEstimated: boolean;
  readonly scaleMin: number;
  readonly scaleMax: number;
  readonly sampleSize: number;
  readonly diagnosticRecommended: boolean;
  readonly targetBand: number | null;
  readonly changeThisMonth: number | null;
  readonly scaleLabel: string;
  readonly progressToTarget: number;
}

export interface SkillScoreSummary {
  readonly skill: SkillKind;
  readonly score: number | null;
  readonly scaleMin: number;
  readonly scaleMax: number;
  readonly scoreLabel: string;
  readonly sampleCount: number;
  readonly normalizedPosition: number;
}

export interface StudyDayStatus {
  readonly daySerial: SerialDay;
  readonly dayLabel: string;
  readonly isCompleted: boolean;
  readonly isToday: boolean;
  readonly isFuture: boolean;
}

export interface StudyWeekSummary {
  readonly days: readonly StudyDayStatus[];
  readonly completedCount: number;
  readonly summaryLabel: string;
}

/** Matches Dart `double.round()` half-away-from-zero semantics and normalizes `-0` to `0`. */
function roundHalfAwayFromZero(n: number): number {
  const rounded = n < 0 ? -Math.round(-n) : Math.round(n);
  return rounded === 0 ? 0 : rounded;
}

function normalizeZero(n: number): number {
  return n === 0 ? 0 : n;
}

/**
 * Calculates estimated overall band and 30-day delta from completed attempt records.
 * - Returns unestimated when no attempts exist.
 * - `changeThisMonth` is calculated ONLY when total attempts >= 3 AND there is an older baseline.
 */
export function calculateEstimatedOverallBand(params: {
  scoredAttempts: readonly ScoredAttemptInput[];
  track?: SupportedExamId;
  targetBand?: number | null;
  currentUtcMs?: number | null;
}): EstimatedBandSummary {
  const track = normalizeSupportedExamId(params.track);
  const spec = EXAM_TRACK_SPECS[track];
  const targetBand = params.targetBand ?? null;

  if (params.scoredAttempts.length === 0) {
    return {
      overallBand: null,
      attemptedSkillsCount: 0,
      isFullFourSkillEstimate: false,
      isEstimated: true,
      scaleMin: spec.minScore,
      scaleMax: spec.maxScore,
      sampleSize: 0,
      diagnosticRecommended: true,
      targetBand,
      changeThisMonth: null,
      scaleLabel: spec.scaleLabel,
      progressToTarget: 0,
    };
  }

  const skillScores = new Map<SkillKind, number[]>();
  for (const attempt of params.scoredAttempts) {
    const existing = skillScores.get(attempt.skill);
    if (existing) {
      existing.push(attempt.score);
    } else {
      skillScores.set(attempt.skill, [attempt.score]);
    }
  }

  const skillAverages: number[] = [];
  for (const scores of skillScores.values()) {
    const sum = scores.reduce((a, b) => a + b, 0);
    skillAverages.push(sum / scores.length);
  }

  const rawOverallMean = skillAverages.reduce((a, b) => a + b, 0) / skillAverages.length;
  const overallScore = isIeltsTrack(track)
    ? roundIeltsBand(rawOverallMean)
    : quantizeExamScore(rawOverallMean, track);

  let changeThisMonth: number | null = null;
  if (params.scoredAttempts.length >= 3 && params.currentUtcMs != null) {
    const thirtyDaysMs = 30 * MILLISECONDS_PER_DAY;
    const thirtyDaysAgoMs = params.currentUtcMs - thirtyDaysMs;

    const baselineAttempts = params.scoredAttempts
      .filter((a) => a.completedAtUtcMs <= thirtyDaysAgoMs)
      .map((a) => a.score);
    const recentAttempts = params.scoredAttempts
      .filter((a) => a.completedAtUtcMs > thirtyDaysAgoMs)
      .map((a) => a.score);

    if (baselineAttempts.length > 0 && recentAttempts.length > 0) {
      const baselineMean = baselineAttempts.reduce((a, b) => a + b, 0) / baselineAttempts.length;
      const recentMean = recentAttempts.reduce((a, b) => a + b, 0) / recentAttempts.length;
      const rawDelta = recentMean - baselineMean;
      const step = spec.scoreStep;
      changeThisMonth = normalizeZero(roundHalfAwayFromZero(rawDelta / step) * step);
    }
  }

  let progressToTarget = 0;
  if (targetBand !== null) {
    const range = targetBand - spec.minScore;
    if (range <= 0) {
      progressToTarget = 1;
    } else {
      progressToTarget = Math.min(1, Math.max(0, (overallScore - spec.minScore) / range));
    }
  }

  return {
    overallBand: overallScore,
    attemptedSkillsCount: skillScores.size,
    isFullFourSkillEstimate: skillScores.size >= 4,
    isEstimated: true,
    scaleMin: spec.minScore,
    scaleMax: spec.maxScore,
    sampleSize: params.scoredAttempts.length,
    diagnosticRecommended: params.scoredAttempts.length < 4,
    targetBand,
    changeThisMonth,
    scaleLabel: spec.scaleLabel,
    progressToTarget,
  };
}

const REQUIRED_SKILLS: readonly SkillKind[] = ['speaking', 'writing', 'reading', 'listening'];

/** Calculates per-skill metric cards for Speaking, Writing, Reading, and Listening. */
export function calculateSkillMetrics(params: {
  attempts: readonly SkillAttemptInput[];
  track?: SupportedExamId;
}): SkillScoreSummary[] {
  const track = normalizeSupportedExamId(params.track);
  const spec = EXAM_TRACK_SPECS[track];

  const skillScores = new Map<SkillKind, number[]>();
  for (const attempt of params.attempts) {
    const existing = skillScores.get(attempt.skill);
    if (existing) {
      existing.push(attempt.score);
    } else {
      skillScores.set(attempt.skill, [attempt.score]);
    }
  }

  const results: SkillScoreSummary[] = [];
  for (const skill of REQUIRED_SKILLS) {
    const scores = skillScores.get(skill);
    if (!scores || scores.length === 0) {
      results.push({
        skill,
        score: null,
        scaleMin: spec.minScore,
        scaleMax: spec.maxScore,
        scoreLabel: '\u2014',
        sampleCount: 0,
        normalizedPosition: 0,
      });
    } else {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const rounded = isIeltsTrack(track) ? roundIeltsBand(avg) : quantizeExamScore(avg, track);
      results.push({
        skill,
        score: rounded,
        scaleMin: spec.minScore,
        scaleMax: spec.maxScore,
        scoreLabel: formatExamScore(rounded, track),
        sampleCount: scores.length,
        normalizedPosition: normalizeScoreToQualityRatio(rounded, track),
      });
    }
  }

  return results;
}

function toSerialDaySet(
  studyDays: ReadonlySet<SerialDay> | readonly SerialDay[],
): ReadonlySet<SerialDay> {
  return studyDays instanceof Set ? studyDays : new Set(studyDays);
}

/** Calculates current study streak in consecutive days leading up to `today` or yesterday. */
export function calculateCurrentStreak(params: {
  studyDays: ReadonlySet<SerialDay> | readonly SerialDay[];
  today: SerialDay;
}): number {
  const daySet = toSerialDaySet(params.studyDays);
  if (daySet.size === 0) return 0;

  let streak = 0;
  let checkDay = params.today;
  if (!daySet.has(checkDay)) {
    checkDay = addSerialDays(params.today, -1);
    if (!daySet.has(checkDay)) {
      return 0;
    }
  }

  while (daySet.has(checkDay)) {
    streak += 1;
    checkDay = addSerialDays(checkDay, -1);
  }

  return streak;
}

const WEEK_DAY_LABELS = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'] as const;

/**
 * Generates the 7-day study week status representing the ISO week containing `today`.
 * `weekdayOfToday` is 1 for Monday through 7 for Sunday.
 */
export function calculateStudyWeek(params: {
  studyDays: ReadonlySet<SerialDay> | readonly SerialDay[];
  today: SerialDay;
  weekdayOfToday?: number;
}): StudyWeekSummary {
  const daySet = toSerialDaySet(params.studyDays);
  const weekdayOfToday = params.weekdayOfToday ?? 1;
  const days: StudyDayStatus[] = [];
  let completedCount = 0;

  const mondayOffset = -(weekdayOfToday - 1);
  const monday = addSerialDays(params.today, mondayOffset);

  for (let i = 0; i < 7; i += 1) {
    const day = addSerialDays(monday, i);
    const isCompleted = daySet.has(day);
    const isToday = day === params.today;
    const isFuture = day > params.today;

    if (isCompleted) {
      completedCount += 1;
    }

    days.push({
      daySerial: day,
      dayLabel: WEEK_DAY_LABELS[i] ?? '',
      isCompleted,
      isToday,
      isFuture,
    });
  }

  return {
    days,
    completedCount,
    summaryLabel: `${completedCount}/7 days studied`,
  };
}
