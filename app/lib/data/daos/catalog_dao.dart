import 'package:drift/drift.dart';
import 'package:mockza/data/db/app_database.dart';
import 'package:mockza/data/db/tables/core_tables.dart';

part 'catalog_dao.g.dart';

/// Data access object for offline [ExamPacks], [ExamPayloads], and [CachedDrills] inventory.
@DriftAccessor(tables: [ExamPacks, ExamPayloads, CachedDrills])
class CatalogDao extends DatabaseAccessor<AppDatabase> with _$CatalogDaoMixin {
  /// Creates a [CatalogDao].
  new(super.attachedDatabase);

  /// Streams all backend-synced exam packs ordered by skill and ID.
  Stream<List<ExamPackRow>> watchDownloadedPacks() =>
      (select(examPacks)..orderBy([
            (t) => OrderingTerm.asc(t.skill),
            (t) => OrderingTerm.asc(t.packId),
          ]))
          .watch();

  /// Returns a single pack metadata row if present.
  Future<ExamPackRow?> getPackById(String packId) => (select(
    examPacks,
  )..where((t) => t.packId.equals(packId))).getSingleOrNull();

  /// Registers or updates metadata for a verified offline pack.
  Future<void> upsertPack(ExamPacksCompanion pack) =>
      into(examPacks).insertOnConflictUpdate(pack);

  /// Replaces catalog metadata entries inside a transaction.
  Future<void> upsertPacksBatch(List<ExamPacksCompanion> packs) => batch((b) {
    b.insertAllOnConflictUpdate(examPacks, packs);
  });

  /// Caches an exam bundle JSON payload locally for offline execution.
  Future<void> upsertExamPayload(ExamPayloadsCompanion payload) =>
      into(examPayloads).insertOnConflictUpdate(payload);

  /// Fetches a cached exam bundle JSON payload for [packId].
  Future<ExamPayloadRow?> getExamPayload(String packId) => (select(
    examPayloads,
  )..where((t) => t.packId.equals(packId))).getSingleOrNull();

  /// Deletes a single cached exam bundle payload.
  Future<int> deleteExamPayload(String packId) =>
      (delete(examPayloads)..where((t) => t.packId.equals(packId))).go();

  /// Streams all pack IDs that currently have an offline payload cached.
  Stream<List<String>> watchCachedPackIds() =>
      select(examPayloads).map((row) => row.packId).watch();

  /// Returns total cached payload bytes across [ExamPayloads].
  Stream<int> watchTotalCacheBytes() =>
      select(examPayloads)
          .map((row) => row.sizeBytes)
          .watch()
          .map((sizes) => sizes.fold<int>(0, (sum, n) => sum + n));

  /// Clears all cached exam payloads (preserving exam attempts and user profile).
  Future<void> clearCachedPayloads() => delete(examPayloads).go();

  /// Inserts or updates synced micro-drills.
  Future<void> upsertDrillsBatch(List<CachedDrillsCompanion> drills) =>
      batch((b) {
        b.insertAllOnConflictUpdate(cachedDrills, drills);
      });

  /// Streams all cached micro-drills ordered by skill and title.
  Stream<List<CachedDrillRow>> watchCachedDrills() =>
      (select(cachedDrills)..orderBy([
            (t) => OrderingTerm.asc(t.skill),
            (t) => OrderingTerm.asc(t.drillId),
          ]))
          .watch();

  /// Looks up a single cached micro-drill by [drillId].
  Future<CachedDrillRow?> getCachedDrillById(String drillId) => (select(
    cachedDrills,
  )..where((t) => t.drillId.equals(drillId))).getSingleOrNull();
}
