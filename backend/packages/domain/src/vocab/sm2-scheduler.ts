import { addSerialDays, type SerialDay } from './serial-day.js';

export const REVIEW_QUALITIES = ['again', 'hard', 'good', 'easy'] as const;
export type ReviewQuality = (typeof REVIEW_QUALITIES)[number];

export const REVIEW_QUALITY_GRADES: Readonly<Record<ReviewQuality, 1 | 3 | 4 | 5>> = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5,
};

export const MIN_EASE_FACTOR_MILLI = 1300;
export const MAX_EASE_FACTOR_MILLI = 4000;
export const DEFAULT_EASE_FACTOR_MILLI = 2500;
export const MIN_EASE_FACTOR = 1.3;

export interface SrsCardState {
  readonly repetitions: number;
  readonly intervalDays: number;
  readonly easeFactorMilli: number;
  readonly dueDay: SerialDay;
}

/** Fresh unseen card initialized for immediate study on `today`. */
export function createInitialSrsCardState(today: SerialDay): SrsCardState {
  return {
    repetitions: 0,
    intervalDays: 0,
    easeFactorMilli: DEFAULT_EASE_FACTOR_MILLI,
    dueDay: today,
  };
}

/** Compatibility helper returning ease factor as floating-point ratio. */
export function getSrsEaseFactor(state: SrsCardState): number {
  return state.easeFactorMilli / 1000;
}

/** Computes the next SrsCardState from `current` given `quality` on `today`. */
export function scheduleSm2Review(params: {
  current: SrsCardState;
  quality: ReviewQuality;
  today: SerialDay;
}): SrsCardState {
  if (!Object.hasOwn(REVIEW_QUALITY_GRADES, params.quality)) {
    throw new Error(`Unsupported review quality: ${String(params.quality)}`);
  }
  const q = REVIEW_QUALITY_GRADES[params.quality];

  const deltaMilli = q === 5 ? 100 : q === 4 ? 0 : q === 3 ? -140 : -320;
  const nextEaseMilli = Math.max(
    MIN_EASE_FACTOR_MILLI,
    Math.min(MAX_EASE_FACTOR_MILLI, params.current.easeFactorMilli + deltaMilli),
  );
  const nextEaseDouble = nextEaseMilli / 1000;

  if (q < 3) {
    return {
      repetitions: 0,
      intervalDays: 1,
      easeFactorMilli: nextEaseMilli,
      dueDay: addSerialDays(params.today, 1),
    };
  }

  const nextReps = params.current.repetitions + 1;
  let nextInterval: number;
  if (nextReps === 1) {
    nextInterval = q >= 5 ? 4 : 1;
  } else if (nextReps === 2) {
    nextInterval = q >= 5 ? 8 : 6;
  } else {
    nextInterval = Math.max(
      1,
      Math.min(3650, Math.round(params.current.intervalDays * nextEaseDouble)),
    );
  }

  return {
    repetitions: nextReps,
    intervalDays: nextInterval,
    easeFactorMilli: nextEaseMilli,
    dueDay: addSerialDays(params.today, nextInterval),
  };
}

/** Formats day count into compact interval label (`'1d'`, `'6d'`, `'14d'`, `'1mo'`, etc.). */
export function formatSm2IntervalDays(days: number): string {
  if (days <= 0) return '1d';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}y`;
}

/** Calculates dynamic preview intervals for the 4 SM-2 ratings matching `scheduleSm2Review`. */
export function previewSm2Intervals(current: SrsCardState): Record<ReviewQuality, string> {
  const anchor: SerialDay = 0;
  return {
    again: formatSm2IntervalDays(
      scheduleSm2Review({ current, quality: 'again', today: anchor }).intervalDays,
    ),
    hard: formatSm2IntervalDays(
      scheduleSm2Review({ current, quality: 'hard', today: anchor }).intervalDays,
    ),
    good: formatSm2IntervalDays(
      scheduleSm2Review({ current, quality: 'good', today: anchor }).intervalDays,
    ),
    easy: formatSm2IntervalDays(
      scheduleSm2Review({ current, quality: 'easy', today: anchor }).intervalDays,
    ),
  };
}
