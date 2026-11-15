import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/data/repositories/exam_catalog_repository.dart';
import 'package:mockza/providers.dart';

/// Filter and offline download state for the Practice Hub catalog.
@immutable
class PracticeHubState {
  /// Creates a [PracticeHubState].
  const new({
    this.selectedSkill,
    this.selectedTrack = 'all',
    this.downloadingPackIds = const <String>{},
    this.isSyncingCatalog = false,
    this.statusMessage,
  });

  /// Optional active skill filter (`null` shows all four IELTS modules + drills).
  final SkillKind? selectedSkill;

  /// Active track filter (`'all'`, `'academic'`, or `'general'`).
  final String selectedTrack;

  /// Set of pack IDs currently downloading offline payloads.
  final Set<String> downloadingPackIds;

  /// Whether a manual catalog sync is currently running.
  final bool isSyncingCatalog;

  /// Optional transient status or error feedback.
  final String? statusMessage;

  /// Returns a copy with updated Practice Hub filters or download progress.
  PracticeHubState copyWith({
    SkillKind? selectedSkill,
    bool clearSkill = false,
    String? selectedTrack,
    Set<String>? downloadingPackIds,
    bool? isSyncingCatalog,
    String? statusMessage,
    bool clearStatus = false,
  }) => PracticeHubState(
    selectedSkill: clearSkill ? null : (selectedSkill ?? this.selectedSkill),
    selectedTrack: selectedTrack ?? this.selectedTrack,
    downloadingPackIds: downloadingPackIds ?? this.downloadingPackIds,
    isSyncingCatalog: isSyncingCatalog ?? this.isSyncingCatalog,
    statusMessage: clearStatus ? null : (statusMessage ?? this.statusMessage),
  );
}

/// Controls Practice Hub filter selection, Postgres catalog refresh, and offline pack caching.
class PracticeHubNotifier extends Notifier<PracticeHubState> {
  @override
  PracticeHubState build() => const PracticeHubState();

  /// Applies or clears a [SkillKind] filter chip.
  void setFilter(SkillKind? skill) {
    state = state.copyWith(
      selectedSkill: skill,
      clearSkill: skill == null,
      clearStatus: true,
    );
  }

  /// Selects an exam track filter (`'all'`, `'academic'`, or `'general'`).
  void setTrackFilter(String track) {
    state = state.copyWith(selectedTrack: track, clearStatus: true);
  }

  /// Refreshes the exam catalog, drills, and vocabulary deck from PostgreSQL.
  Future<void> refreshCatalog() async {
    if (state.isSyncingCatalog) return;
    state = state.copyWith(isSyncingCatalog: true, clearStatus: true);
    try {
      final sync = ref.read(contentSyncServiceProvider);
      final res = await sync.syncAllCatalogData(forceRefresh: true);
      state = res.when(
        success: (count) => state.copyWith(
          isSyncingCatalog: false,
          statusMessage: 'Synced $count catalog items.',
        ),
        failure: (f) => state.copyWith(
          isSyncingCatalog: false,
          statusMessage: 'Sync failed: ${f.message}',
        ),
      );
    } on Object catch (err) {
      state = state.copyWith(
        isSyncingCatalog: false,
        statusMessage: 'Sync error: $err',
      );
    }
  }

  /// Downloads or removes an exam pack bundle for offline simulator access.
  Future<void> toggleOfflineDownload(InstalledExamPack pack) async {
    if (state.downloadingPackIds.contains(pack.packId)) return;

    if (pack.isCachedOffline) {
      await ref
          .read(examCatalogRepositoryProvider)
          .deleteCachedExamBundle(pack.packId);
      state = state.copyWith(
        statusMessage: 'Removed offline cache for ${pack.title}.',
      );
      return;
    }

    final nextDownloading = Set<String>.from(state.downloadingPackIds)
      ..add(pack.packId);
    state = state.copyWith(
      downloadingPackIds: nextDownloading,
      clearStatus: true,
    );

    try {
      final res = await ref
          .read(contentSyncServiceProvider)
          .downloadExamPack(pack.packId);
      final doneSet = Set<String>.from(state.downloadingPackIds)
        ..remove(pack.packId);
      state = res.when(
        success: (_) => state.copyWith(
          downloadingPackIds: doneSet,
          statusMessage: '${pack.title} saved for offline practice.',
        ),
        failure: (f) => state.copyWith(
          downloadingPackIds: doneSet,
          statusMessage: 'Download failed: ${f.message}',
        ),
      );
    } on Object catch (err) {
      final doneSet = Set<String>.from(state.downloadingPackIds)
        ..remove(pack.packId);
      state = state.copyWith(
        downloadingPackIds: doneSet,
        statusMessage: 'Download error: $err',
      );
    }
  }
}
