import 'package:drift/drift.dart';
import 'package:mockza/data/db/app_database.dart';
import 'package:mockza/data/db/tables/core_tables.dart';

part 'progress_dao.g.dart';

/// Data access object for [UserProfiles] and [DailyStudyLogs].
@DriftAccessor(tables: [UserProfiles, DailyStudyLogs])
class ProgressDao extends DatabaseAccessor<AppDatabase>
    with _$ProgressDaoMixin {
  /// Creates a [ProgressDao].
  new(super.attachedDatabase);

  /// Fetches the primary learner profile row if initialized.
  Future<UserProfileRow?> getProfile(String deviceId) => (select(
    userProfiles,
  )..where((t) => t.deviceId.equals(deviceId))).getSingleOrNull();

  /// Streams the most recently updated learner profile row for reactive routing/UI.
  Stream<UserProfileRow?> watchPrimaryProfile() =>
      (select(userProfiles)
            ..orderBy([(t) => OrderingTerm.desc(t.updatedAt)])
            ..limit(1))
          .watchSingleOrNull();

  /// Saves or updates the learner profile row.
  Future<void> upsertProfile(UserProfilesCompanion profile) =>
      into(userProfiles).insertOnConflictUpdate(profile);

  /// Streams recent [DailyStudyLogs] ordered newest day first.
  Stream<List<DailyStudyLogRow>> watchRecentStudyLogs({int limit = 30}) =>
      (select(dailyStudyLogs)
            ..orderBy([(t) => OrderingTerm.desc(t.serialDay)])
            ..limit(limit))
          .watch();

  /// Upserts daily study totals for a `serialDay` row.
  Future<void> upsertDailyLog(DailyStudyLogsCompanion log) =>
      into(dailyStudyLogs).insertOnConflictUpdate(log);

  /// Atomically increments daily study seconds and completed items for [serialDay].
  Future<void> accumulateDailyLog({
    required int serialDay,
    required int deltaSeconds,
    required int deltaItems,
    required DateTime now,
  }) => transaction(() async {
    final existing = await (select(
      dailyStudyLogs,
    )..where((t) => t.serialDay.equals(serialDay))).getSingleOrNull();
    final nextSec = (existing?.studySeconds ?? 0) + deltaSeconds;
    final nextItems = (existing?.completedItems ?? 0) + deltaItems;
    await into(dailyStudyLogs).insertOnConflictUpdate(
      DailyStudyLogsCompanion(
        serialDay: Value(serialDay),
        studySeconds: Value(nextSec),
        completedItems: Value(nextItems),
        createdAt: Value(existing?.createdAt ?? now),
        updatedAt: Value(now),
      ),
    );
  });
}
