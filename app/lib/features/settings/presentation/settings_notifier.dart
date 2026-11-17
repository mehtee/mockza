import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/models/user_profile.dart';
import 'package:mockza/core/preferences/appearance_settings.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/app_router.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// Immutable UI state for Settings & Account screen.
@immutable
class SettingsState {
  /// Creates a [SettingsState].
  const new({
    required this.edition,
    required this.examModule,
    required this.targetBand,
    required this.themeMode,
    required this.isPro,
    required this.speakingRemaining,
    required this.writingRemaining,
    required this.appUserId,
    this.presetId = AppearanceSettings.defaultPresetId,
    this.appVersionLabel = 'v1.0.0',
    this.isBusy = false,
    this.isClearingCache = false,
    this.isSyncingCatalog = false,
    this.statusMessage,
  });

  /// Active distribution edition (`global` or `iran`).
  final AppEdition edition;

  /// Active IELTS track.
  final ExamModuleType examModule;

  /// Target overall IELTS band.
  final double targetBand;

  /// Current visual theme mode (`system`, `dark`, `light`).
  final String themeMode;

  /// Active Open-Closed theme preset identifier in `MzThemeCatalog`.
  final String presetId;

  /// Whether active user has Pro subscription entitlement.
  final bool isPro;

  /// Daily remaining speaking evaluation quota.
  final int speakingRemaining;

  /// Daily remaining writing evaluation quota.
  final int writingRemaining;

  /// Anonymous device/account identifier.
  final String appUserId;

  /// Dynamic semantic version & build number string from [PackageInfo].
  final String appVersionLabel;

  /// Whether purchase restore or account wipe is running.
  final bool isBusy;

  /// Whether offline cache purge is currently executing.
  final bool isClearingCache;

  /// Whether catalog sync is currently executing.
  final bool isSyncingCatalog;

  /// Status feedback message.
  final String? statusMessage;

  /// Returns a copy with updated settings values.
  SettingsState copyWith({
    AppEdition? edition,
    ExamModuleType? examModule,
    double? targetBand,
    String? themeMode,
    String? presetId,
    bool? isPro,
    int? speakingRemaining,
    int? writingRemaining,
    String? appUserId,
    String? appVersionLabel,
    bool? isBusy,
    bool? isClearingCache,
    bool? isSyncingCatalog,
    String? statusMessage,
    bool clearStatusMessage = false,
  }) => SettingsState(
    edition: edition ?? this.edition,
    examModule: examModule ?? this.examModule,
    targetBand: targetBand ?? this.targetBand,
    themeMode: themeMode ?? this.themeMode,
    presetId: presetId ?? this.presetId,
    isPro: isPro ?? this.isPro,
    speakingRemaining: speakingRemaining ?? this.speakingRemaining,
    writingRemaining: writingRemaining ?? this.writingRemaining,
    appUserId: appUserId ?? this.appUserId,
    appVersionLabel: appVersionLabel ?? this.appVersionLabel,
    isBusy: isBusy ?? this.isBusy,
    isClearingCache: isClearingCache ?? this.isClearingCache,
    isSyncingCatalog: isSyncingCatalog ?? this.isSyncingCatalog,
    statusMessage: clearStatusMessage
        ? null
        : (statusMessage ?? this.statusMessage),
  );
}

/// Manages edition readout, preferences, quota, cache cleanup & full account wipe.
class SettingsNotifier extends Notifier<SettingsState> {
  bool _isDisposed = false;
  StreamSubscription<UserProfile?>? _profileSub;

  @override
  SettingsState build() {
    _isDisposed = false;
    ref.onDispose(() {
      _isDisposed = true;
      unawaited(_profileSub?.cancel());
    });
    final appearance = ref.watch(appearanceSettingsProvider);
    final initial = SettingsState(
      edition: ref.watch(editionConfigProvider).edition,
      examModule: ExamModuleType.academic,
      targetBand: 7.5,
      themeMode: appearance.themeModeKey,
      presetId: appearance.presetId,
      isPro: false,
      speakingRemaining: 1,
      writingRemaining: 1,
      appUserId: 'initializing...',
    );
    _watchPrimaryProfile();
    unawaited(_loadInitialData());
    return initial;
  }

  void _watchPrimaryProfile() {
    unawaited(_profileSub?.cancel());
    try {
      _profileSub = ref
          .read(profileRepositoryProvider)
          .watchPrimaryProfile()
          .listen(
            (profile) {
              if (profile == null || _isDisposed) return;
              state = state.copyWith(
                examModule: profile.examModule,
                targetBand: profile.targetBand,
                isPro: profile.isPro,
                appUserId: profile.appUserId ?? profile.deviceId,
              );
            },
            onError: (_) {},
          );
    } on Object {
      // Ignore in isolated widget tests without DB plugin.
    }
  }

  Future<void> _loadInitialData() async {
    try {
      final info = await PackageInfo.fromPlatform();
      if (!_isDisposed && info.version.isNotEmpty) {
        final buildSuffix = info.buildNumber.isNotEmpty
            ? ' (Build ${info.buildNumber})'
            : '';
        state = state.copyWith(
          appVersionLabel: 'v${info.version}$buildSuffix',
        );
      }
    } on Object {
      // Fallback in headless widget tests without platform plugin.
    }

    try {
      final deviceIdRes = await ref
          .read(secureIdentityServiceProvider)
          .getOrCreateDeviceId();
      final profileRepo = ref.read(profileRepositoryProvider);
      final profile = await profileRepo.loadOrInitializePrimary(
        fallbackDeviceId: deviceIdRes.valueOrNull,
      );
      if (!_isDisposed) {
        state = state.copyWith(
          examModule: profile.examModule,
          targetBand: profile.targetBand,
          isPro: profile.isPro,
          appUserId: profile.appUserId ?? profile.deviceId,
        );
      }
    } on Object {
      // Ignore in isolated widget tests without database plugin.
    }

    await ref.read(authSessionServiceProvider).ensureAuthenticated();
    final quotaResult = await ref
        .read(gradingGatewayProvider)
        .fetchQuotaStatus();
    final quota = quotaResult.valueOrNull;
    if (quota != null && !_isDisposed) {
      state = state.copyWith(
        speakingRemaining: quota.speakingRemaining,
        writingRemaining: quota.writingRemaining,
        isPro: quota.isPro,
      );
      try {
        final profileRepo = ref.read(profileRepositoryProvider);
        final primary = await profileRepo.loadOrInitializePrimary();
        if (primary.isPro != quota.isPro) {
          await profileRepo.setProEntitlement(
            primary.deviceId,
            isPro: quota.isPro,
          );
        }
      } on Object {
        // Ignore DB error in isolated tests.
      }
    }
  }

  /// Updates target band inside local state and persists to SQLite.
  void setTargetBand(double band) {
    final clamped = band.clamp(5.0, 9.0);
    state = state.copyWith(targetBand: clamped, clearStatusMessage: true);
    unawaited(_persistPreferences(targetBand: clamped));
  }

  /// Updates exam track and persists to SQLite.
  void setExamModule(ExamModuleType module) {
    state = state.copyWith(examModule: module, clearStatusMessage: true);
    unawaited(_persistPreferences(examModule: module));
  }

  /// Updates visual theme mode and persists to secure storage & SQLite.
  void setThemeMode(String mode) {
    state = state.copyWith(themeMode: mode, clearStatusMessage: true);
    ref.read(appearanceSettingsProvider.notifier).setThemeMode(mode);
    unawaited(_persistThemeMode(mode));
  }

  /// Updates the Open-Closed palette preset and persists selection.
  void setThemePreset(String presetId) {
    state = state.copyWith(presetId: presetId, clearStatusMessage: true);
    ref.read(appearanceSettingsProvider.notifier).setPresetId(presetId);
  }

  Future<void> _persistPreferences({
    double? targetBand,
    ExamModuleType? examModule,
  }) async {
    try {
      final profileRepo = ref.read(profileRepositoryProvider);
      final primary = await profileRepo.loadOrInitializePrimary();
      final nextModule = examModule ?? state.examModule;
      final nextExamId = nextModule == ExamModuleType.generalTraining
          ? 'ielts_general'
          : 'ielts_academic';
      await profileRepo.saveTargetPreferences(
        deviceId: primary.deviceId,
        targetBand: targetBand ?? state.targetBand,
        examModule: nextModule,
        examId: nextExamId,
        targetDateSerial: primary.targetDateSerial,
      );
    } on Object {
      // Ignore in isolated widget tests without database plugin.
    }
  }

  Future<void> _persistThemeMode(String mode) async {
    try {
      final profileRepo = ref.read(profileRepositoryProvider);
      final primary = await profileRepo.loadOrInitializePrimary();
      await profileRepo.setThemeMode(primary.deviceId, mode);
    } on Object {
      // Ignore in isolated widget tests without database plugin.
    }
  }

  /// Restores IAP purchases via [billingGatewayProvider] and persists Pro status.
  Future<void> restorePurchases() async {
    state = state.copyWith(isBusy: true, clearStatusMessage: true);
    final result = await ref.read(billingGatewayProvider).restorePurchases();
    if (_isDisposed) return;

    switch (result) {
      case Ok(:final value):
        try {
          final profileRepo = ref.read(profileRepositoryProvider);
          final primary = await profileRepo.loadOrInitializePrimary();
          await profileRepo.setProEntitlement(primary.deviceId, isPro: value);
        } on Object {
          // Ignore DB error in isolated tests.
        }
        if (!_isDisposed) {
          state = state.copyWith(
            isBusy: false,
            isPro: value,
            statusMessage: value
                ? 'Pro access restored and active!'
                : 'No active subscription found.',
          );
        }
      case Err(:final failure):
        state = state.copyWith(
          isBusy: false,
          statusMessage: 'Restore notice: ${failure.message}',
        );
    }
  }

  /// Clears downloaded exam bundles & expired local audio blobs via `CacheCleanupService`.
  Future<void> clearOfflineCache() async {
    if (state.isClearingCache) return;
    state = state.copyWith(isClearingCache: true, clearStatusMessage: true);
    try {
      await ref.read(cacheCleanupServiceProvider).clearDownloadedCaches();
      if (!_isDisposed) {
        state = state.copyWith(
          isClearingCache: false,
          statusMessage: 'Offline pack bundles and audio caches cleared.',
        );
      }
    } on Object catch (err) {
      if (!_isDisposed) {
        state = state.copyWith(
          isClearingCache: false,
          statusMessage: 'Failed to clear cache: $err',
        );
      }
    }
  }

  /// Forces a catalog & vocabulary sync from PostgreSQL backend.
  Future<void> syncCatalogNow() async {
    if (state.isSyncingCatalog) return;
    state = state.copyWith(isSyncingCatalog: true, clearStatusMessage: true);
    try {
      await ref.read(authSessionServiceProvider).ensureAuthenticated();
      final res = await ref
          .read(contentSyncServiceProvider)
          .syncAllCatalogData(forceRefresh: true);
      if (!_isDisposed) {
        state = state.copyWith(
          isSyncingCatalog: false,
          statusMessage: res.isOk
              ? 'Content catalog refreshed from server.'
              : 'Catalog sync unavailable offline.',
        );
      }
    } on Object {
      if (!_isDisposed) {
        state = state.copyWith(
          isSyncingCatalog: false,
          statusMessage: 'Catalog sync unavailable right now.',
        );
      }
    }
  }

  /// Exports portable learner study data JSON (`TD-47`).
  Future<String> exportStudyDataJson() =>
      ref.read(attemptRepositoryProvider).exportStudyDataJson();

  /// Deletes the remote account and local data, retaining the receipt until all cleanup succeeds.
  Future<void> wipeAllData() async {
    state = state.copyWith(isBusy: true, clearStatusMessage: true);
    final remoteResult = await ref
        .read(authSessionServiceProvider)
        .deleteRemoteAccount();

    if (remoteResult case Err<void, Failure>(:final failure)) {
      if (_isDisposed) return;
      state = state.copyWith(
        isBusy: false,
        statusMessage:
            'Could not erase server records (${failure.message}). Retry to finish deleting your data.',
      );
      return;
    }

    try {
      final mediaCleared = await ref
          .read(cacheCleanupServiceProvider)
          .eraseAllLocalMediaForAccountWipe();
      if (!mediaCleared) {
        if (!_isDisposed) {
          state = state.copyWith(
            isBusy: false,
            statusMessage: 'Server account erased. Local audio deletion failed; retry to finish deleting your data.',
          );
        }
        return;
      }
      final identity = ref.read(secureIdentityServiceProvider);
      await ref.read(profileRepositoryProvider).resetAllLocalData();
      final cleared = await identity.clearPendingErasureReceipt();
      if (cleared case Err<void, Failure>(:final failure)) {
        if (!_isDisposed) {
          state = state.copyWith(
            isBusy: false,
            statusMessage:
                'Data erased, but deletion confirmation could not be saved: ${failure.message}. Retry to finish.',
          );
        }
        return;
      }
      if (_isDisposed) return;
      ref.read(onboardingCompletedLatchProvider.notifier).completed = false;
    } on Object {
      if (!_isDisposed) {
        state = state.copyWith(
          isBusy: false,
          statusMessage: 'Local data deletion could not finish. Retry to complete deletion.',
        );
      }
      return;
    }

    if (_isDisposed) return;
    ref.read(appearanceSettingsProvider.notifier).resetToDefaults();
    state = SettingsState(
      edition: state.edition,
      examModule: ExamModuleType.academic,
      targetBand: 7.5,
      themeMode: AppearanceSettings.defaultThemeModeKey,
      isPro: false,
      speakingRemaining: 1,
      writingRemaining: 1,
      appUserId: 'reset',
      appVersionLabel: state.appVersionLabel,
      statusMessage: 'Account and all local data wiped successfully.',
    );
  }
}
