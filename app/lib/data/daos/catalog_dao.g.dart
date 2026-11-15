// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'catalog_dao.dart';

// ignore_for_file: type=lint
mixin _$CatalogDaoMixin on DatabaseAccessor<AppDatabase> {
  $ExamPacksTable get examPacks => attachedDatabase.examPacks;
  $ExamPayloadsTable get examPayloads => attachedDatabase.examPayloads;
  $CachedDrillsTable get cachedDrills => attachedDatabase.cachedDrills;
  CatalogDaoManager get managers => CatalogDaoManager(this);
}

class CatalogDaoManager {
  final _$CatalogDaoMixin _db;
  CatalogDaoManager(this._db);
  $$ExamPacksTableTableManager get examPacks =>
      $$ExamPacksTableTableManager(_db.attachedDatabase, _db.examPacks);
  $$ExamPayloadsTableTableManager get examPayloads =>
      $$ExamPayloadsTableTableManager(_db.attachedDatabase, _db.examPayloads);
  $$CachedDrillsTableTableManager get cachedDrills =>
      $$CachedDrillsTableTableManager(_db.attachedDatabase, _db.cachedDrills);
}
