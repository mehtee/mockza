import 'package:meta/meta.dart';
import 'package:mockza/core/vocab/serial_day.dart';

/// Learner self-rating on an SRS vocabulary review card.
enum ReviewQuality {
  /// Total lapse; reset interval to 1 day / next session.
  again(1),

  /// Recalled with effort; mild ease penalty.
  hard(3),

  /// Smooth recall; standard SM-2 ease adjustment.
  good(4),

  /// Effortless recall; ease bonus.
  easy(5);

  new(this.sm2Grade);

  /// Canonical SM-2 integer grade (`0..5`).
  final int sm2Grade;
}

/// Current scheduling state persisted per vocabulary card.
/// Uses integer `easeFactorMilli` (floor 1300, default 2500) per ADR-006 / ADR-013.
@immutable
class SrsCardState {
  /// Creates an [SrsCardState].
  const new({
    required this.repetitions,
    required this.intervalDays,
    required this.easeFactorMilli,
    required this.dueDay,
  });

  /// Fresh unseen card initialized for immediate study on [today].
  factory initial(SerialDay today) => SrsCardState(
    repetitions: 0,
    intervalDays: 0,
    easeFactorMilli: 2500,
    dueDay: today,
  );

  /// Consecutive successful recalls (`sm2Grade >= 3`).
  final int repetitions;

  /// Scheduled review gap in days.
  final int intervalDays;

  /// SM-2 ease multiplier in thousandths (`2500` = 2.50, floor `1300`, max `4000`).
  final int easeFactorMilli;

  /// Next due UTC day counter.
  final SerialDay dueDay;

  /// Compatibility getter returning ease factor as floating point double.
  double get easeFactor => easeFactorMilli / 1000.0;
}

/// Pure deterministic SM-2 spaced repetition scheduler.
abstract final class Sm2Scheduler {
  /// Minimum allowed SM-2 ease factor in thousandths (`1300` = 1.3).
  static const int minEaseFactorMilli = 1300;

  /// Maximum allowed SM-2 ease factor in thousandths (`4000` = 4.0).
  static const int maxEaseFactorMilli = 4000;

  /// Minimum ease factor as double.
  static const double minEaseFactor = 1.3;

  /// Computes the next [SrsCardState] from [current] given [quality] on [today].
  static SrsCardState schedule({
    required SrsCardState current,
    required ReviewQuality quality,
    required SerialDay today,
  }) {
    final q = quality.sm2Grade;

    // Delta formula: 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)
    // Converted to thousandths:
    final deltaMilli = switch (q) {
      5 => 100, // +0.100
      4 => 0, // +0.000
      3 => -140, // -0.140
      _ => -320, // -0.320
    };

    final nextEaseMilli = (current.easeFactorMilli + deltaMilli).clamp(
      minEaseFactorMilli,
      maxEaseFactorMilli,
    );

    final nextEaseDouble = nextEaseMilli / 1000.0;

    if (q < 3) {
      return SrsCardState(
        repetitions: 0,
        intervalDays: 1,
        easeFactorMilli: nextEaseMilli,
        dueDay: today.addDays(1),
      );
    }

    final nextReps = current.repetitions + 1;
    final nextInterval = switch (nextReps) {
      1 => 1,
      2 => 6,
      _ => (current.intervalDays * nextEaseDouble).round().clamp(1, 3650),
    };

    return SrsCardState(
      repetitions: nextReps,
      intervalDays: nextInterval,
      easeFactorMilli: nextEaseMilli,
      dueDay: today.addDays(nextInterval),
    );
  }

  /// Calculates dynamic preview intervals for the 4 SM-2 buttons.
  /// Formatted as user-friendly strings (e.g. `'1m'`, `'1d'`, `'4d'`, `'7d'`).
  static Map<ReviewQuality, String> previewIntervals(SrsCardState current) {
    // Again: immediate review / next session
    final againStr = current.repetitions == 0 ? '1m' : '10m';

    // Hard: interval 1 day if new, else 1.2x
    final hardDays = current.repetitions == 0
        ? 1
        : (current.intervalDays * 1.2).round().clamp(1, 365);
    final hardStr = formatDays(hardDays);

    // Good: standard next interval
    final goodDays = switch (current.repetitions) {
      0 => 1,
      1 => 6,
      _ => (current.intervalDays * (current.easeFactorMilli / 1000.0)).round(),
    };
    final goodStr = formatDays(goodDays);

    // Easy: standard interval + bonus
    final easyDays = switch (current.repetitions) {
      0 => 4,
      1 => 8,
      _ =>
        (current.intervalDays * ((current.easeFactorMilli + 150) / 1000.0))
            .round(),
    };
    final easyStr = formatDays(easyDays);

    return <ReviewQuality, String>{
      ReviewQuality.again: againStr,
      ReviewQuality.hard: hardStr,
      ReviewQuality.good: goodStr,
      ReviewQuality.easy: easyStr,
    };
  }

  /// Formats day count into compact interval label (`'1d'`, `'6d'`, `'14d'`, `'1mo'`, etc.).
  static String formatDays(int days) {
    if (days <= 0) return '1d';
    if (days < 30) return '${days}d';
    if (days < 365) return '${(days / 30).round()}mo';
    return '${(days / 365).round()}y';
  }
}
