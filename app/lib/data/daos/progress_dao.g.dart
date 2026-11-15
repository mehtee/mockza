// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'progress_dao.dart';

// ignore_for_file: type=lint
mixin _$ProgressDaoMixin on DatabaseAccessor<AppDatabase> {
  $UserProfilesTable get userProfiles => attachedDatabase.userProfiles;
  $DailyStudyLogsTable get dailyStudyLogs => attachedDatabase.dailyStudyLogs;
  ProgressDaoManager get managers => ProgressDaoManager(this);
}

class ProgressDaoManager {
  final _$ProgressDaoMixin _db;
  ProgressDaoManager(this._db);
  $$UserProfilesTableTableManager get userProfiles =>
      $$UserProfilesTableTableManager(_db.attachedDatabase, _db.userProfiles);
  $$DailyStudyLogsTableTableManager get dailyStudyLogs =>
      $$DailyStudyLogsTableTableManager(
        _db.attachedDatabase,
        _db.dailyStudyLogs,
      );
}
