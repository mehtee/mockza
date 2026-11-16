import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/data/repositories/exam_catalog_repository.dart';
import 'package:mockza/features/practice_hub/presentation/practice_hub_notifier.dart';
import 'package:mockza/providers.dart';

/// Provides [PracticeHubState] via [PracticeHubNotifier].
final NotifierProvider<PracticeHubNotifier, PracticeHubState>
practiceHubNotifierProvider =
    NotifierProvider<PracticeHubNotifier, PracticeHubState>(
      PracticeHubNotifier.new,
    );

/// Streams synced & locally cached IELTS exam packs from SQLite.
final StreamProvider<List<InstalledExamPack>> installedExamPacksProvider =
    StreamProvider<List<InstalledExamPack>>(
      (ref) => ref.watch(examCatalogRepositoryProvider).watchInstalledPacks(),
    );

/// Streams set of pack IDs currently downloaded for full offline use.
final StreamProvider<Set<String>> cachedExamPackIdsProvider =
    StreamProvider<Set<String>>(
      (ref) => ref.watch(examCatalogRepositoryProvider).watchCachedPackIds(),
    );

/// Streams synced 3-minute targeted weakness drills from SQLite.
final StreamProvider<List<MicroDrillSpec>> drillsCatalogProvider =
    StreamProvider<List<MicroDrillSpec>>(
      (ref) => ref.watch(examCatalogRepositoryProvider).watchDrills(),
    );

/// Streams recent learner attempts for Full Mock stage progress reconciliation.
final StreamProvider<List<AttemptSummary>> practiceHubAttemptsProvider =
    StreamProvider<List<AttemptSummary>>(
      (ref) => ref
          .watch(attemptRepositoryProvider)
          .watchRecentAttempts(
            limit: 500,
          ),
    );
