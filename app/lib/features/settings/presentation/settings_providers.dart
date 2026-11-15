import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/features/settings/presentation/settings_notifier.dart';
import 'package:mockza/providers.dart';

/// Provides [SettingsState] via [SettingsNotifier].
final NotifierProvider<SettingsNotifier, SettingsState>
settingsNotifierProvider = NotifierProvider<SettingsNotifier, SettingsState>(
  SettingsNotifier.new,
);

/// Streams live total offline bundle bytes stored in Drift `ExamPayloads`.
final StreamProvider<int> totalCacheBytesProvider = StreamProvider<int>(
  (ref) => ref.watch(examCatalogRepositoryProvider).watchTotalCacheBytes(),
);

/// Streams total count of offline downloaded packs.
final StreamProvider<int> downloadedPackCountProvider = StreamProvider<int>(
  (ref) => ref
      .watch(examCatalogRepositoryProvider)
      .watchInstalledPacks()
      .map((packs) => packs.where((p) => p.isDownloaded).length),
);
