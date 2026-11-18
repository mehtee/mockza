import { describe, expect, it } from 'vitest';
import {
  addSerialDays,
  computeBoundedStageDeadlineUtcMs,
  computeDiagnosticRemainingSeconds,
  createInitialSrsCardState,
  DEFAULT_EASE_FACTOR_MILLI,
  DIAGNOSTIC_BUDGET_SECONDS,
  differenceSerialDays,
  formatSm2IntervalDays,
  getSrsEaseFactor,
  MAX_EASE_FACTOR_MILLI,
  MIN_EASE_FACTOR_MILLI,
  previewSm2Intervals,
  REVIEW_QUALITIES,
  scheduleSm2Review,
  serialDayFromUtcDate,
  serialDayFromUtcMs,
  utcMidnightMsFromSerialDay,
} from '../index.js';

describe('@mockza/domain vocab & diagnostic budget', () => {
  describe('SerialDay', () => {
    it('handles UTC calendar day math, leap years, and -0 normalization', () => {
      const d = new Date(Date.UTC(2024, 0, 1, 23, 59, 59));
      const day = serialDayFromUtcDate(d);
      expect(day).toBe(19723);
      expect(serialDayFromUtcMs(Date.UTC(2024, 0, 1, 0, 0, 0))).toBe(19723);

      const nextYear = addSerialDays(day, 366);
      expect(differenceSerialDays(nextYear, day)).toBe(366);
      expect(utcMidnightMsFromSerialDay(day)).toBe(19723 * 86_400_000);

      const epoch = serialDayFromUtcMs(0);
      expect(Object.is(epoch, -0)).toBe(false);
      expect(epoch).toBe(0);
    });
  });

  describe('Sm2Scheduler', () => {
    const today = 20000;

    it('schedules Good (1d -> 6d -> 15d), Easy (+100, 4d/8d), Hard (-140), and Again (-320)', () => {
      const initial = createInitialSrsCardState(today);
      expect(initial.easeFactorMilli).toBe(DEFAULT_EASE_FACTOR_MILLI);
      expect(getSrsEaseFactor(initial)).toBe(2.5);

      const firstGood = scheduleSm2Review({ current: initial, quality: 'good', today });
      expect(firstGood.repetitions).toBe(1);
      expect(firstGood.intervalDays).toBe(1);
      expect(firstGood.dueDay).toBe(20001);

      const secondGood = scheduleSm2Review({
        current: firstGood,
        quality: 'good',
        today: 20001,
      });
      expect(secondGood.repetitions).toBe(2);
      expect(secondGood.intervalDays).toBe(6);
      expect(secondGood.dueDay).toBe(20007);

      const thirdGood = scheduleSm2Review({
        current: secondGood,
        quality: 'good',
        today: 20007,
      });
      expect(thirdGood.repetitions).toBe(3);
      expect(thirdGood.intervalDays).toBe(15);

      const easy1 = scheduleSm2Review({ current: initial, quality: 'easy', today });
      expect(easy1.intervalDays).toBe(4);
      expect(easy1.easeFactorMilli).toBe(2600);

      const easy2 = scheduleSm2Review({ current: easy1, quality: 'easy', today });
      expect(easy2.intervalDays).toBe(8);
      expect(easy2.easeFactorMilli).toBe(2700);

      const hard = scheduleSm2Review({ current: firstGood, quality: 'hard', today });
      expect(hard.repetitions).toBe(2);
      expect(hard.easeFactorMilli).toBe(2360);
      expect(hard.intervalDays).toBe(6);

      const lapsed = scheduleSm2Review({ current: thirdGood, quality: 'again', today });
      expect(lapsed.repetitions).toBe(0);
      expect(lapsed.intervalDays).toBe(1);
      expect(lapsed.easeFactorMilli).toBe(2180);
    });

    it('clamps easeFactorMilli [1300, 4000], max interval 3650, and matches previewIntervals', () => {
      let lowCard = { repetitions: 1, intervalDays: 1, easeFactorMilli: 1350, dueDay: today };
      for (let i = 0; i < 5; i += 1) {
        lowCard = scheduleSm2Review({ current: lowCard, quality: 'again', today });
      }
      expect(lowCard.easeFactorMilli).toBe(MIN_EASE_FACTOR_MILLI);

      let highCard = { repetitions: 5, intervalDays: 2000, easeFactorMilli: 3950, dueDay: today };
      highCard = scheduleSm2Review({ current: highCard, quality: 'easy', today });
      expect(highCard.easeFactorMilli).toBe(MAX_EASE_FACTOR_MILLI);
      expect(highCard.intervalDays).toBe(3650);

      const previews = previewSm2Intervals(createInitialSrsCardState(today));
      for (const q of REVIEW_QUALITIES) {
        const next = scheduleSm2Review({
          current: createInitialSrsCardState(today),
          quality: q,
          today,
        });
        expect(previews[q]).toBe(formatSm2IntervalDays(next.intervalDays));
      }
      expect(formatSm2IntervalDays(0)).toBe('1d');
      expect(formatSm2IntervalDays(60)).toBe('2mo');
      expect(formatSm2IntervalDays(730)).toBe('2y');
    });
  });

  describe('DiagnosticBudget', () => {
    it('enforces 75/35/60/35/5 sub-turn and 900/90/990 session bounds', () => {
      expect(DIAGNOSTIC_BUDGET_SECONDS).toEqual({
        introMaxSeconds: 60,
        readingMaxSeconds: 210,
        listeningMaxSeconds: 210,
        writingMaxSeconds: 240,
        writingFollowUpMaxSeconds: 75,
        speakingPrepMaxSeconds: 35,
        speakingMainMaxSeconds: 60,
        speakingFollowUpMaxSeconds: 35,
        speakingMaxSeconds: 150,
        transitionMaxSeconds: 5,
        collectionTotalSeconds: 900,
        resultsWindowSeconds: 90,
        totalSessionSeconds: 990,
      });

      const nowMs = Date.UTC(2026, 10, 17, 14, 0, 0);
      const globalDeadline = nowMs + 45 * 1000;
      const stageDeadline = computeBoundedStageDeadlineUtcMs({
        stageCapSeconds: DIAGNOSTIC_BUDGET_SECONDS.readingMaxSeconds,
        globalCollectionDeadlineUtcMs: globalDeadline,
        mode: 'standard',
        nowUtcMs: nowMs,
      });
      expect(stageDeadline).toBe(globalDeadline);
      expect(
        computeDiagnosticRemainingSeconds({ deadlineUtcMs: stageDeadline, nowUtcMs: nowMs }),
      ).toBe(45);
      expect(
        computeDiagnosticRemainingSeconds({
          deadlineUtcMs: nowMs + 44_001,
          nowUtcMs: nowMs,
        }),
      ).toBe(45);
      expect(
        computeDiagnosticRemainingSeconds({
          deadlineUtcMs: nowMs - 100,
          nowUtcMs: nowMs,
        }),
      ).toBe(0);

      const extendedDeadline = computeBoundedStageDeadlineUtcMs({
        stageCapSeconds: 210,
        globalCollectionDeadlineUtcMs: globalDeadline,
        mode: 'extended',
        nowUtcMs: nowMs,
      });
      expect(extendedDeadline).toBe(nowMs + 210 * 3 * 1000);
    });
  });
});
