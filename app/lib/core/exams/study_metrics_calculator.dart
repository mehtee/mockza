import 'package:meta/meta.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/vocab/serial_day.dart';

/// Summary of a learner's overall estimated exam score.
@immutable
class EstimatedBandSummary {
  /// Creates an [EstimatedBandSummary].
  const new({
    required this.overallBand,
    required this.isEstimated,
    required this.scaleMin,
    required this.scaleMax,
    required this.sampleSize,
    required this.diagnosticRecommended,
    this.targetBand,
    this.changeThisMonth,
    this.scaleLabel = 'Band',
  });

  /// Unestimated fallback state when insufficient attempts exist.
  const new unestimated({
    this.scaleMin = 0,
    this.scaleMax = 9,
    this.targetBand,
    this.scaleLabel = 'Band',
  }) : overallBand = null,
       isEstimated = true,
       sampleSize = 0,
       diagnosticRecommended = true,
       changeThisMonth = null;

  /// Overall estimated score (e.g. 6.5 for IELTS, 65 for PTE). Null if unestimated.
  final double? overallBand;

  /// Whether this score is an AI/heuristic estimate.
  final bool isEstimated;

  /// Minimum score on the exam scale (e.g. 0.0 for IELTS, 10.0 for PTE).
  final double scaleMin;

  /// Maximum score on the exam scale (e.g. 9.0 for IELTS, 90.0 for PTE).
  final double scaleMax;

  /// Number of completed scored attempts contributing to this estimate.
  final int sampleSize;

  /// Whether the learner should be prompted to take a diagnostic test.
  final bool diagnosticRecommended;

  /// Learner's target band/score if set.
  final double? targetBand;

  /// 30-day delta (e.g. `+0.5`), populated ONLY when sample size (>= 3) and history justify it.
  final double? changeThisMonth;

  /// Human-readable scale label (e.g. 'Band', 'Score').
  final String scaleLabel;

  /// Progress ratio towards target on scale [0.0..1.0].
  double get progressToTarget {
    if (overallBand == null || targetBand == null) return 0;
    final range = targetBand! - scaleMin;
    if (range <= 0) return 1;
    final progress = (overallBand! - scaleMin) / range;
    return progress.clamp(0.0, 1.0);
  }
}

/// Score summary for a specific skill domain (Speaking, Writing, Reading, Listening).
@immutable
class SkillScoreSummary {
  /// Creates a [SkillScoreSummary].
  const new({
    required this.skill,
    required this.score,
    required this.scaleMin,
    required this.scaleMax,
    required this.scoreLabel,
    required this.sampleCount,
  });

  /// Skill domain.
  final SkillKind skill;

  /// Estimated average score, or null if no attempts recorded.
  final double? score;

  /// Minimum score for this skill.
  final double scaleMin;

  /// Maximum score for this skill.
  final double scaleMax;

  /// Formatted score label (e.g. '6.5' or '—').
  final String scoreLabel;

  /// Number of attempts recorded for this skill.
  final int sampleCount;

  /// Normalized position in the scale range [0.0..1.0].
  double get normalizedPosition {
    if (score == null) return 0;
    final range = scaleMax - scaleMin;
    if (range <= 0) return 0;
    return ((score! - scaleMin) / range).clamp(0.0, 1.0);
  }
}

/// Completion state of a single day in the 7-day study week strip.
@immutable
class StudyDayStatus {
  /// Creates a [StudyDayStatus].
  const new({
    required this.daySerial,
    required this.dayLabel,
    required this.isCompleted,
    required this.isToday,
    required this.isFuture,
  });

  /// Day serial counter.
  final SerialDay daySerial;

  /// Short day abbreviation (e.g. 'M', 'T', 'W', 'Th', 'F', 'Sa', 'Su').
  final String dayLabel;

  /// Whether study activity was recorded on this day.
  final bool isCompleted;

  /// Whether this tile corresponds to today.
  final bool isToday;

  /// Whether this day is in the future.
  final bool isFuture;
}

/// Summary of the 7-day study week strip.
@immutable
class StudyWeekSummary {
  /// Creates a [StudyWeekSummary].
  const new({
    required this.days,
    required this.completedCount,
    required this.summaryLabel,
  });

  /// Exactly 7 days representing the active week.
  final List<StudyDayStatus> days;

  /// Count of completed study days in this 7-day window.
  final int completedCount;

  /// Formatted summary (e.g. '4/7 days studied').
  final String summaryLabel;
}

/// Pure Dart study metrics calculator for estimating bands, trends, streaks, and habits.
abstract final class StudyMetricsCalculator {
  /// Calculates estimated overall band and 30-day delta from completed attempt records.
  ///
  /// Adheres strictly to design.md honest-data rule:
  /// - Returns unestimated when no attempts or insufficient data exist.
  /// - `changeThisMonth` is calculated ONLY when total attempts >= 3 AND there is an older baseline.
  static EstimatedBandSummary calculateEstimatedOverallBand({
    required List<({double score, SkillKind skill, int completedAtUtcMs})>
    scoredAttempts,
    ExamTrack track = ExamTrack.ieltsAcademic,
    double? targetBand,
    int? currentUtcMs,
  }) {
    if (scoredAttempts.isEmpty) {
      return EstimatedBandSummary.unestimated(
        scaleMin: track.minScore,
        scaleMax: track.maxScore,
        targetBand: targetBand,
        scaleLabel: track.scaleLabel,
      );
    }

    // Group attempts by skill to compute skill averages
    final skillScores = <SkillKind, List<double>>{};
    for (final attempt in scoredAttempts) {
      skillScores.putIfAbsent(attempt.skill, () => []).add(attempt.score);
    }

    // Average each skill
    final skillAverages = <double>[];
    for (final scores in skillScores.values) {
      final avg = scores.reduce((a, b) => a + b) / scores.length;
      skillAverages.add(avg);
    }

    // Calculate raw mean across available skills
    final rawOverallMean =
        skillAverages.reduce((a, b) => a + b) / skillAverages.length;

    // Apply exam-specific rounding
    final double overallScore;
    if (track == ExamTrack.ieltsAcademic || track == ExamTrack.ieltsGeneral) {
      overallScore = ExamSpec.roundIeltsBand(rawOverallMean);
    } else {
      overallScore = (rawOverallMean * 2).round() / 2.0;
    }

    // 30-day delta calculation:
    // Requires >= 3 total attempts, with at least 1 baseline attempt >= 30 days old.
    double? changeThisMonth;
    if (scoredAttempts.length >= 3 && currentUtcMs != null) {
      const thirtyDaysMs = 30 * Duration.millisecondsPerDay;
      final thirtyDaysAgoMs = currentUtcMs - thirtyDaysMs;

      final baselineAttempts = scoredAttempts
          .where((a) => a.completedAtUtcMs <= thirtyDaysAgoMs)
          .map((a) => a.score)
          .toList();
      final recentAttempts = scoredAttempts
          .where((a) => a.completedAtUtcMs > thirtyDaysAgoMs)
          .map((a) => a.score)
          .toList();

      if (baselineAttempts.isNotEmpty && recentAttempts.isNotEmpty) {
        final baselineMean =
            baselineAttempts.reduce((a, b) => a + b) / baselineAttempts.length;
        final recentMean =
            recentAttempts.reduce((a, b) => a + b) / recentAttempts.length;

        final rawDelta = recentMean - baselineMean;
        // Round delta to nearest 0.5 for IELTS, 1.0 for others
        if (track == ExamTrack.ieltsAcademic ||
            track == ExamTrack.ieltsGeneral) {
          changeThisMonth = (rawDelta * 2).round() / 2.0;
        } else {
          changeThisMonth = rawDelta.roundToDouble();
        }
      }
    }

    return EstimatedBandSummary(
      overallBand: overallScore,
      isEstimated: true,
      scaleMin: track.minScore,
      scaleMax: track.maxScore,
      sampleSize: scoredAttempts.length,
      diagnosticRecommended: scoredAttempts.length < 4,
      targetBand: targetBand,
      changeThisMonth: changeThisMonth,
      scaleLabel: track.scaleLabel,
    );
  }

  /// Calculates per-skill metric cards for Speaking, Writing, Reading, and Listening.
  static List<SkillScoreSummary> calculateSkillMetrics({
    required List<({double score, SkillKind skill})> attempts,
    ExamTrack track = ExamTrack.ieltsAcademic,
  }) {
    const requiredSkills = [
      SkillKind.speaking,
      SkillKind.writing,
      SkillKind.reading,
      SkillKind.listening,
    ];

    final skillScores = <SkillKind, List<double>>{};
    for (final attempt in attempts) {
      skillScores.putIfAbsent(attempt.skill, () => []).add(attempt.score);
    }

    final results = <SkillScoreSummary>[];
    for (final skill in requiredSkills) {
      final scores = skillScores[skill];
      if (scores == null || scores.isEmpty) {
        results.add(
          SkillScoreSummary(
            skill: skill,
            score: null,
            scaleMin: track.minScore,
            scaleMax: track.maxScore,
            scoreLabel: '—',
            sampleCount: 0,
          ),
        );
      } else {
        final avg = scores.reduce((a, b) => a + b) / scores.length;
        final double rounded;
        if (track == ExamTrack.ieltsAcademic ||
            track == ExamTrack.ieltsGeneral) {
          rounded = ExamSpec.roundIeltsBand(avg);
        } else {
          rounded = (avg * 2).round() / 2.0;
        }
        results.add(
          SkillScoreSummary(
            skill: skill,
            score: rounded,
            scaleMin: track.minScore,
            scaleMax: track.maxScore,
            scoreLabel: rounded.toStringAsFixed(1),
            sampleCount: scores.length,
          ),
        );
      }
    }

    return results;
  }

  /// Calculates current study streak in consecutive days leading up to [today].
  static int calculateCurrentStreak({
    required Set<SerialDay> studyDays,
    required SerialDay today,
  }) {
    if (studyDays.isEmpty) return 0;

    var streak = 0;
    // Check if studied today
    var checkDay = today;
    if (!studyDays.contains(checkDay)) {
      // If not studied today, check if yesterday was studied to keep streak alive
      checkDay = today.addDays(-1);
      if (!studyDays.contains(checkDay)) {
        return 0;
      }
    }

    // Count backwards
    while (studyDays.contains(checkDay)) {
      streak++;
      checkDay = checkDay.addDays(-1);
    }

    return streak;
  }

  /// Generates the 7-day study week status representing the ISO week containing [today].
  ///
  /// [weekdayOfToday] is 1 for Monday through 7 for Sunday (matching [DateTime.weekday]).
  static StudyWeekSummary calculateStudyWeek({
    required Set<SerialDay> studyDays,
    required SerialDay today,
    int weekdayOfToday = 1,
  }) {
    const dayLabels = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'];
    final days = <StudyDayStatus>[];
    var completedCount = 0;

    // Start on Monday of the current week: offset = -(weekday - 1)
    final mondayOffset = -(weekdayOfToday - 1);
    final monday = today.addDays(mondayOffset);

    for (var i = 0; i < 7; i++) {
      final day = monday.addDays(i);
      final isCompleted = studyDays.contains(day);
      final isToday = day == today;
      final isFuture = day.value > today.value;

      if (isCompleted) {
        completedCount++;
      }

      days.add(
        StudyDayStatus(
          daySerial: day,
          dayLabel: dayLabels[i],
          isCompleted: isCompleted,
          isToday: isToday,
          isFuture: isFuture,
        ),
      );
    }

    return StudyWeekSummary(
      days: days,
      completedCount: completedCount,
      summaryLabel: '$completedCount/7 days studied',
    );
  }
}
