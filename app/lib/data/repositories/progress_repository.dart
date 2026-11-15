import 'package:clock/clock.dart';
import 'package:meta/meta.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/data/db/app_database.dart';

/// Daily activity record summarized for streaks and weekly progress rings.
@immutable
class DailyStudySummary {
  /// Creates a [DailyStudySummary].
  const new({
    required this.serialDay,
    required this.studySeconds,
    required this.completedItems,
  });

  /// UTC calendar day number.
  final SerialDay serialDay;

  /// Study time accumulated on that day in seconds.
  final int studySeconds;

  /// Count of completed drills or test modules.
  final int completedItems;
}

/// Repository tracking daily study streaks and activity ledgers via Drift.
final class ProgressRepository {
  /// Creates a [ProgressRepository].
  const new({
    required this._db,
    required this._clock,
  });

  final AppDatabase _db;
  final Clock _clock;

  /// Streams recent [DailyStudySummary] entries ordered newest day first.
  Stream<List<DailyStudySummary>> watchRecentActivity({int limit = 30}) => _db
      .progressDao
      .watchRecentStudyLogs(limit: limit)
      .map(
        (rows) => rows
            .map(
              (row) => DailyStudySummary(
                serialDay: SerialDay(row.serialDay),
                studySeconds: row.studySeconds,
                completedItems: row.completedItems,
              ),
            )
            .toList(growable: false),
      );

  /// Records today's study activity on the current UTC [SerialDay], accumulating with earlier sessions.
  Future<void> logTodayActivity({
    required int studySeconds,
    required int completedItems,
  }) {
    final now = _clock.now().toUtc();
    final today = SerialDay.fromUtcDateTime(now);
    return _db.progressDao.accumulateDailyLog(
      serialDay: today.value,
      deltaSeconds: studySeconds,
      deltaItems: completedItems,
      now: now,
    );
  }
}
