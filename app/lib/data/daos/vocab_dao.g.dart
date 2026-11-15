// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'vocab_dao.dart';

// ignore_for_file: type=lint
mixin _$VocabDaoMixin on DatabaseAccessor<AppDatabase> {
  $VocabCardsTable get vocabCards => attachedDatabase.vocabCards;
  $VocabReviewLogsTable get vocabReviewLogs => attachedDatabase.vocabReviewLogs;
  VocabDaoManager get managers => VocabDaoManager(this);
}

class VocabDaoManager {
  final _$VocabDaoMixin _db;
  VocabDaoManager(this._db);
  $$VocabCardsTableTableManager get vocabCards =>
      $$VocabCardsTableTableManager(_db.attachedDatabase, _db.vocabCards);
  $$VocabReviewLogsTableTableManager get vocabReviewLogs =>
      $$VocabReviewLogsTableTableManager(
        _db.attachedDatabase,
        _db.vocabReviewLogs,
      );
}
