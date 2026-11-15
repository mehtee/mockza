import 'package:mockza/core/exams/study_metrics_calculator.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:test/test.dart';

void main() {
  group('StudyMetricsCalculator Tier 1 Suite', () {
    const today = SerialDay(20000);
    const nowUtcMs = 20000 * Duration.millisecondsPerDay;

    test('returns unestimated summary when no scored attempts exist', () {
      final summary = StudyMetricsCalculator.calculateEstimatedOverallBand(
        scoredAttempts: [],
        targetBand: 7.5,
      );

      expect(summary.overallBand, isNull);
      expect(summary.isEstimated, isTrue);
      expect(summary.sampleSize, 0);
      expect(summary.diagnosticRecommended, isTrue);
      expect(summary.changeThisMonth, isNull);
      expect(summary.progressToTarget, 0.0);
    });

    test(
      'rounds mean of IELTS skills using standard IELTS half-band rounding',
      () {
        final attempts = [
          (score: 6.0, skill: SkillKind.speaking, completedAtUtcMs: nowUtcMs),
          (score: 6.5, skill: SkillKind.writing, completedAtUtcMs: nowUtcMs),
          (score: 7.0, skill: SkillKind.reading, completedAtUtcMs: nowUtcMs),
          (score: 6.5, skill: SkillKind.listening, completedAtUtcMs: nowUtcMs),
        ];

        // Mean: (6.0 + 6.5 + 7.0 + 6.5) / 4 = 26.0 / 4 = 6.5
        final summary = StudyMetricsCalculator.calculateEstimatedOverallBand(
          scoredAttempts: attempts,
          targetBand: 7.5,
        );

        expect(summary.overallBand, 6.5);
        expect(summary.sampleSize, 4);
        expect(summary.diagnosticRecommended, isFalse);
        expect(summary.progressToTarget, closeTo(6.5 / 7.5, 0.01));
      },
    );

    test('rounds boundary quarter bands (e.g. 6.25 -> 6.5, 6.75 -> 7.0)', () {
      final attempts = [
        (score: 6.0, skill: SkillKind.speaking, completedAtUtcMs: nowUtcMs),
        (score: 6.0, skill: SkillKind.writing, completedAtUtcMs: nowUtcMs),
        (score: 6.5, skill: SkillKind.reading, completedAtUtcMs: nowUtcMs),
        (score: 6.5, skill: SkillKind.listening, completedAtUtcMs: nowUtcMs),
      ];

      // Mean: 25.0 / 4 = 6.25 -> rounds up to 6.5
      final summary = StudyMetricsCalculator.calculateEstimatedOverallBand(
        scoredAttempts: attempts,
        targetBand: 7,
      );

      expect(summary.overallBand, 6.5);
    });

    test('30-day delta is null when total attempts < 3 (design.md honest data rule)', () {
      final attempts = [
        (
          score: 6.0,
          skill: SkillKind.speaking,
          completedAtUtcMs: nowUtcMs - 40 * Duration.millisecondsPerDay,
        ),
        (
          score: 6.5,
          skill: SkillKind.writing,
          completedAtUtcMs: nowUtcMs - 5 * Duration.millisecondsPerDay,
        ),
      ];

      final summary = StudyMetricsCalculator.calculateEstimatedOverallBand(
        scoredAttempts: attempts,
        currentUtcMs: nowUtcMs,
      );

      expect(summary.changeThisMonth, isNull);
    });

    test('30-day delta is calculated when total attempts >= 3 with historical baseline', () {
      final attempts = [
        (
          score: 6.0,
          skill: SkillKind.speaking,
          completedAtUtcMs: nowUtcMs - 45 * Duration.millisecondsPerDay,
        ),
        (
          score: 6.0,
          skill: SkillKind.writing,
          completedAtUtcMs: nowUtcMs - 35 * Duration.millisecondsPerDay,
        ),
        (
          score: 7.0,
          skill: SkillKind.reading,
          completedAtUtcMs: nowUtcMs - 5 * Duration.millisecondsPerDay,
        ),
        (
          score: 7.0,
          skill: SkillKind.listening,
          completedAtUtcMs: nowUtcMs - 2 * Duration.millisecondsPerDay,
        ),
      ];

      // Baseline avg = 6.0. Recent avg = 7.0. Delta = +1.0
      final summary = StudyMetricsCalculator.calculateEstimatedOverallBand(
        scoredAttempts: attempts,
        currentUtcMs: nowUtcMs,
      );

      expect(summary.changeThisMonth, 1.0);
    });

    test('calculateSkillMetrics returns all 4 skills with formatted labels and dash for unattempted', () {
      final attempts = [
        (score: 6.5, skill: SkillKind.speaking),
        (score: 7.0, skill: SkillKind.reading),
      ];

      final skills = StudyMetricsCalculator.calculateSkillMetrics(
        attempts: attempts,
      );

      expect(skills.length, 4);

      final speaking = skills.firstWhere((s) => s.skill == SkillKind.speaking);
      expect(speaking.score, 6.5);
      expect(speaking.scoreLabel, '6.5');
      expect(speaking.sampleCount, 1);

      final writing = skills.firstWhere((s) => s.skill == SkillKind.writing);
      expect(writing.score, isNull);
      expect(writing.scoreLabel, '—');
      expect(writing.sampleCount, 0);
    });

    test('calculateCurrentStreak counts consecutive days backwards from today or yesterday', () {
      final studyDays = {
        today,
        today.addDays(-1),
        today.addDays(-2),
      };

      expect(
        StudyMetricsCalculator.calculateCurrentStreak(
          studyDays: studyDays,
          today: today,
        ),
        3,
      );

      // If not yet studied today, but studied yesterday, streak is kept
      final studyDaysYesterday = {
        today.addDays(-1),
        today.addDays(-2),
      };

      expect(
        StudyMetricsCalculator.calculateCurrentStreak(
          studyDays: studyDaysYesterday,
          today: today,
        ),
        2,
      );

      // Broken streak (gap yesterday)
      final broken = {
        today.addDays(-2),
      };

      expect(
        StudyMetricsCalculator.calculateCurrentStreak(
          studyDays: broken,
          today: today,
        ),
        0,
      );
    });

    test(
      'calculateStudyWeek creates 7 day tiles with completed counts and label',
      () {
        // Wednesday is day 3
        final studyDays = {
          today.addDays(-2), // Mon
          today.addDays(-1), // Tue
          today, // Wed
        };

        final week = StudyMetricsCalculator.calculateStudyWeek(
          studyDays: studyDays,
          today: today,
          weekdayOfToday: 3,
        );

        expect(week.days.length, 7);
        expect(week.completedCount, 3);
        expect(week.summaryLabel, '3/7 days studied');
        expect(week.days[0].dayLabel, 'M');
        expect(week.days[0].isCompleted, isTrue);
        expect(week.days[2].isToday, isTrue);
        expect(week.days[3].isFuture, isTrue);
        expect(week.days[6].dayLabel, 'Su');
      },
    );
  });
}
