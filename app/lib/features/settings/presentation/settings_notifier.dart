import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/auth/auth_models.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/models/user_profile.dart';
import 'package:mockza/core/personalization/topic_taxonomy.dart';
import 'package:mockza/core/preferences/appearance_settings.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/core/vocab/serial_day.dart';
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
    this.track = ExamTrack.ieltsAcademic,
    this.studyFocus = 'both',
    this.favoriteTopics = const <String>[],
    this.dailyNewVocabCap = 10,
    this.preferredTtsAccent = 'us',
    this.targetDateSerial,
    this.presetId = AppearanceSettings.defaultPresetId,
    this.appVersionLabel = 'v1.0.0',
    this.isBusy = false,
    this.isClearingCache = false,
    this.isSyncingCatalog = false,
    this.isSyncingDevices = false,
    this.isLoadingSessions = false,
    this.isManagingSession = false,
    this.accountSessions,
    this.statusMessage,
  });

  /// Active distribution edition (`global` or `iran`).
  final AppEdition edition;

  /// Active exam track across IELTS, TOEFL iBT, PTE, and DET.
  final ExamTrack track;

  /// Learner study focus preference (`exams`, `coach`, or `both`).
  final String studyFocus;

  /// Canonical favorite topic wire keys seeded in onboarding/settings.
  final List<String> favoriteTopics;

  /// Daily cap on brand-new vocabulary cards (`5 | 10 | 20`).
  final int dailyNewVocabCap;

  /// Preferred reference Kokoro voice accent (`us` or `uk`).
  final String preferredTtsAccent;

  /// Active IELTS track.
  final ExamModuleType examModule;

  /// Target overall IELTS band.
  final double targetBand;

  /// Canonical UTC [SerialDay] of the learner's target exam date, if set.
  final int? targetDateSerial;

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

  /// Whether cross-device pull/push sync is currently executing.
  final bool isSyncingDevices;

  /// Whether signed-in account devices are currently loading.
  final bool isLoadingSessions;

  /// Whether sign-out or remote device termination is in flight.
  final bool isManagingSession;

  /// Server-reported account profile and active signed-in devices list.
  final AccountSessionsSnapshot? accountSessions;

  /// Status feedback message.
  final String? statusMessage;

  /// Returns a copy with updated settings values.
  SettingsState copyWith({
    AppEdition? edition,
    ExamTrack? track,
    String? studyFocus,
    List<String>? favoriteTopics,
    int? dailyNewVocabCap,
    String? preferredTtsAccent,
    ExamModuleType? examModule,
    double? targetBand,
    int? targetDateSerial,
    bool clearTargetDateSerial = false,
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
    bool? isSyncingDevices,
    bool? isLoadingSessions,
    bool? isManagingSession,
    AccountSessionsSnapshot? accountSessions,
    bool clearAccountSessions = false,
    String? statusMessage,
    bool clearStatusMessage = false,
  }) => SettingsState(
    edition: edition ?? this.edition,
    track: track ?? this.track,
    studyFocus: studyFocus ?? this.studyFocus,
    favoriteTopics: favoriteTopics ?? this.favoriteTopics,
    dailyNewVocabCap: dailyNewVocabCap ?? this.dailyNewVocabCap,
    preferredTtsAccent: preferredTtsAccent ?? this.preferredTtsAccent,
    examModule: examModule ?? this.examModule,
    targetBand: targetBand ?? this.targetBand,
    targetDateSerial: clearTargetDateSerial
        ? null
        : (targetDateSerial ?? this.targetDateSerial),
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
    isSyncingDevices: isSyncingDevices ?? this.isSyncingDevices,
    isLoadingSessions: isLoadingSessions ?? this.isLoadingSessions,
    isManagingSession: isManagingSession ?? this.isManagingSession,
    accountSessions: clearAccountSessions
        ? null
        : (accountSessions ?? this.accountSessions),
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
                track: ExamTrack.fromId(profile.examId),
                studyFocus: profile.studyFocus,
                favoriteTopics: profile.favoriteTopics,
                dailyNewVocabCap: profile.dailyNewVocabCap,
                examModule: profile.examModule,
                targetBand: profile.targetBand,
                targetDateSerial: profile.targetDateSerial,
                clearTargetDateSerial: profile.targetDateSerial == null,
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
      final savedAccent = await ref
          .read(personalizationRepositoryProvider)
          .getPreferredTtsAccent();
      ref.read(preferredTtsAccentProvider.notifier).setAccent(savedAccent);
      if (!_isDisposed) {
        state = state.copyWith(
          track: ExamTrack.fromId(profile.examId),
          studyFocus: profile.studyFocus,
          favoriteTopics: profile.favoriteTopics,
          dailyNewVocabCap: profile.dailyNewVocabCap,
          preferredTtsAccent: savedAccent,
          examModule: profile.examModule,
          targetBand: profile.targetBand,
          targetDateSerial: profile.targetDateSerial,
          clearTargetDateSerial: profile.targetDateSerial == null,
          isPro: profile.isPro,
          appUserId: profile.appUserId ?? profile.deviceId,
        );
      }
    } on Object {
      // Ignore in isolated widget tests without database plugin.
    }

    await ref.read(authSessionServiceProvider).ensureAuthenticated();
    await Future.wait<void>(<Future<void>>[
      _refreshQuotaInternal(),
      refreshAccountSessions(),
    ]);
  }

  Future<void> _refreshQuotaInternal() async {
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

  /// Loads active signed-in devices and slot occupancy (`1 Phone + 1 Desktop Web`).
  Future<void> refreshAccountSessions() async {
    if (_isDisposed) return;
    state = state.copyWith(isLoadingSessions: true);
    final res = await ref
        .read(authSessionServiceProvider)
        .fetchAccountSessions();
    if (_isDisposed) return;

    switch (res) {
      case Ok<AccountSessionsSnapshot, Failure>(:final value):
        state = state.copyWith(
          isLoadingSessions: false,
          accountSessions: value,
          isPro: value.user?.isPro ?? state.isPro,
        );
        try {
          final profileRepo = ref.read(profileRepositoryProvider);
          final primary = await profileRepo.loadOrInitializePrimary();
          if (value.isAuthenticated && value.user != null) {
            await profileRepo.saveAuthenticatedAccount(
              deviceId: primary.deviceId,
              userId: value.user!.userId,
              email: value.user!.email,
              isPro: value.user!.isPro,
            );
          } else if (primary.appUserId != null &&
              primary.appUserId!.isNotEmpty) {
            await profileRepo.clearAuthenticatedAccount(primary.deviceId);
          }
        } on Object {
          // Ignore DB error in isolated tests.
        }
      case Err<AccountSessionsSnapshot, Failure>():
        state = state.copyWith(isLoadingSessions: false);
    }
  }

  /// Signs out ONLY the current device and clears its subscriber slot & local Pro state.
  Future<void> signOutCurrentDevice() async {
    if (state.isManagingSession) return;
    state = state.copyWith(
      isManagingSession: true,
      clearStatusMessage: true,
    );
    final res = await ref
        .read(authSessionServiceProvider)
        .signOutCurrentDevice();
    if (_isDisposed) return;

    switch (res) {
      case Ok<void, Failure>():
        try {
          final profileRepo = ref.read(profileRepositoryProvider);
          final primary = await profileRepo.loadOrInitializePrimary();
          await profileRepo.clearAuthenticatedAccount(primary.deviceId);
        } on Object {
          // Ignore in isolated tests.
        }
        if (_isDisposed) return;
        state = state.copyWith(
          isManagingSession: false,
          isPro: false,
          statusMessage: 'Signed out of this device. Its slot is now open.',
        );
        await refreshAccountSessions();
        await _refreshQuotaInternal();
      case Err<void, Failure>(:final failure):
        state = state.copyWith(
          isManagingSession: false,
          statusMessage: failure.message,
        );
    }
  }

  /// Terminates [targetDeviceId] remotely (or signs out self if matching current device).
  Future<void> terminateDeviceSession(String targetDeviceId) async {
    if (state.isManagingSession) return;
    state = state.copyWith(
      isManagingSession: true,
      clearStatusMessage: true,
    );
    final res = await ref
        .read(authSessionServiceProvider)
        .terminateDeviceSession(targetDeviceId);
    if (_isDisposed) return;

    switch (res) {
      case Ok<
        ({
          List<String> revokedDeviceIds,
          bool signedOutCurrentDevice,
          List<DeviceSessionInfo> sessions,
        }),
        Failure
      >(
        :final value,
      ):
        if (value.signedOutCurrentDevice) {
          try {
            final profileRepo = ref.read(profileRepositoryProvider);
            final primary = await profileRepo.loadOrInitializePrimary();
            await profileRepo.clearAuthenticatedAccount(primary.deviceId);
          } on Object {
            // Ignore in isolated tests.
          }
        }
        state = state.copyWith(
          isManagingSession: false,
          statusMessage: value.signedOutCurrentDevice
              ? 'Signed out of this device.'
              : 'Selected device session terminated immediately.',
        );
        await refreshAccountSessions();
        await _refreshQuotaInternal();
      case Err<
        ({
          List<String> revokedDeviceIds,
          bool signedOutCurrentDevice,
          List<DeviceSessionInfo> sessions,
        }),
        Failure
      >(
        :final failure,
      ):
        state = state.copyWith(
          isManagingSession: false,
          statusMessage: failure.message,
        );
    }
  }

  /// Signs out all other devices on the account, freeing their slots.
  Future<void> terminateOtherSessions() async {
    if (state.isManagingSession) return;
    state = state.copyWith(
      isManagingSession: true,
      clearStatusMessage: true,
    );
    final res = await ref
        .read(authSessionServiceProvider)
        .terminateOtherSessions();
    if (_isDisposed) return;

    switch (res) {
      case Ok<List<DeviceSessionInfo>, Failure>():
        state = state.copyWith(
          isManagingSession: false,
          statusMessage: 'All other device sessions terminated.',
        );
        await refreshAccountSessions();
      case Err<List<DeviceSessionInfo>, Failure>(:final failure):
        state = state.copyWith(
          isManagingSession: false,
          statusMessage: failure.message,
        );
    }
  }

  /// Updates target score inside local state and persists to SQLite.
  void setTargetBand(double band) {
    final quantized = state.track.quantizeScore(band);
    state = state.copyWith(targetBand: quantized, clearStatusMessage: true);
    unawaited(_persistPreferences(targetBand: quantized));
  }

  /// Updates active [ExamTrack] (resets target score when switching scale) and persists.
  void setTrack(ExamTrack track) {
    final module = track == ExamTrack.ieltsGeneral
        ? ExamModuleType.generalTraining
        : ExamModuleType.academic;
    final nextTarget = track.nextTargetWhenSwitchingFrom(
      state.track,
      state.targetBand,
    );
    state = state.copyWith(
      track: track,
      examModule: module,
      targetBand: nextTarget,
      clearStatusMessage: true,
    );
    unawaited(
      _persistPreferences(
        targetBand: nextTarget,
        examModule: module,
        track: track,
      ),
    );
  }

  /// Updates the canonical target exam date (`SerialDay` UTC) or clears it when `null`.
  Future<void> setTargetDateSerial(int? serial) async {
    state = state.copyWith(
      targetDateSerial: serial,
      clearTargetDateSerial: serial == null,
    );
    try {
      final profileRepo = ref.read(profileRepositoryProvider);
      final primary = await profileRepo.loadOrInitializePrimary();
      await profileRepo.saveTargetPreferences(
        deviceId: primary.deviceId,
        targetBand: state.targetBand,
        examModule: state.examModule,
        examId: state.track.id,
        targetDateSerial: serial,
        clearTargetDate: serial == null,
      );
    } on Object {
      // Ignore in isolated widget tests without database plugin.
    }
  }

  /// Returns canonical UTC [SerialDay] representing today for calendar bounds.
  SerialDay currentTodaySerialDay() =>
      SerialDay.fromUtcDateTime(ref.read(clockProvider).now());

  /// Updates IELTS exam track and persists to SQLite.
  void setExamModule(ExamModuleType module) {
    setTrack(
      module == ExamModuleType.generalTraining
          ? ExamTrack.ieltsGeneral
          : ExamTrack.ieltsAcademic,
    );
  }

  /// Updates visual theme mode and persists to secure storage & SQLite.
  void setThemeMode(String mode) {
    state = state.copyWith(themeMode: mode, clearStatusMessage: true);
    ref.read(appearanceSettingsProvider.notifier).setThemeMode(mode);
    unawaited(_persistThemeMode(mode));
  }

  /// Updates the learner's study focus (`exams`, `coach`, or `both`).
  Future<void> setStudyFocus(String focus) async {
    state = state.copyWith(studyFocus: focus, clearStatusMessage: true);
    try {
      final profileRepo = ref.read(profileRepositoryProvider);
      final primary = await profileRepo.loadOrInitializePrimary();
      await profileRepo.setStudyFocus(primary.deviceId, focus);
    } on Object {
      // Ignore in isolated widget tests without database plugin.
    }
  }

  /// Updates the Open-Closed palette preset and persists selection.
  void setThemePreset(String presetId) {
    state = state.copyWith(presetId: presetId, clearStatusMessage: true);
    ref.read(appearanceSettingsProvider.notifier).setPresetId(presetId);
  }

  Future<void> _persistPreferences({
    double? targetBand,
    ExamModuleType? examModule,
    ExamTrack? track,
  }) async {
    try {
      final profileRepo = ref.read(profileRepositoryProvider);
      final primary = await profileRepo.loadOrInitializePrimary();
      final nextTrack = track ?? state.track;
      final nextModule =
          examModule ??
          (nextTrack == ExamTrack.ieltsGeneral
              ? ExamModuleType.generalTraining
              : ExamModuleType.academic);
      await profileRepo.saveTargetPreferences(
        deviceId: primary.deviceId,
        targetBand: targetBand ?? state.targetBand,
        examModule: nextModule,
        examId: nextTrack.id,
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

  /// Toggles one of the 10 canonical favorite topics & recalibrates server roadmap.
  Future<void> toggleFavoriteTopic(String rawWireKey) async {
    final normalized = CanonicalTopicKey.normalize(rawWireKey).wireKey;
    final next = List<String>.from(state.favoriteTopics);
    if (next.contains(normalized)) {
      next.remove(normalized);
    } else {
      next.add(normalized);
    }
    state = state.copyWith(favoriteTopics: next, clearStatusMessage: true);
    try {
      final profileRepo = ref.read(profileRepositoryProvider);
      final primary = await profileRepo.loadOrInitializePrimary();
      await profileRepo.saveTargetPreferences(
        deviceId: primary.deviceId,
        targetBand: state.targetBand,
        examModule: state.examModule,
        examId: state.track.id,
        favoriteTopics: next,
        targetDateSerial: primary.targetDateSerial,
      );
      final remote = await ref
          .read(personalizationGatewayProvider)
          .updateProfile(favoriteTopics: next);
      final updated = remote.valueOrNull;
      if (updated != null) {
        await ref.read(personalizationRepositoryProvider).cacheState(updated);
      } else {
        await ref
            .read(attemptRepositoryProvider)
            .enqueueOutboxAction(
              actionType: 'profile.update',
              payloadJson: jsonEncode(<String, Object?>{
                'favoriteTopics': next,
              }),
            );
        ref.read(outboxSyncServiceProvider).notifyWorkEnqueued();
      }
    } on Object {
      // Safe offline / widget test fallback.
    }
  }

  /// Updates daily new vocab cap (`5`, `10`, `20`) locally & remotely.
  Future<void> setDailyNewVocabCap(int cap) async {
    state = state.copyWith(dailyNewVocabCap: cap, clearStatusMessage: true);
    try {
      final profileRepo = ref.read(profileRepositoryProvider);
      final primary = await profileRepo.loadOrInitializePrimary();
      await profileRepo.saveTargetPreferences(
        deviceId: primary.deviceId,
        targetBand: state.targetBand,
        examModule: state.examModule,
        examId: state.track.id,
        dailyNewVocabCap: cap,
        targetDateSerial: primary.targetDateSerial,
      );
      final remote = await ref
          .read(personalizationGatewayProvider)
          .updateProfile(dailyNewVocabCap: cap);
      final updated = remote.valueOrNull;
      if (updated != null) {
        await ref.read(personalizationRepositoryProvider).cacheState(updated);
      }
    } on Object {
      // Offline safe.
    }
  }

  /// Updates preferred Kokoro voice accent (`us` or `uk`) locally & remotely.
  Future<void> setPreferredTtsAccent(String accent) async {
    final normalized = accent == 'uk' ? 'uk' : 'us';
    ref.read(preferredTtsAccentProvider.notifier).setAccent(normalized);
    state = state.copyWith(
      preferredTtsAccent: normalized,
      clearStatusMessage: true,
    );
    try {
      await ref
          .read(personalizationRepositoryProvider)
          .savePreferredTtsAccent(normalized);
      final remote = await ref
          .read(personalizationGatewayProvider)
          .updateProfile(preferredTtsAccent: normalized);
      final updated = remote.valueOrNull;
      if (updated != null) {
        await ref.read(personalizationRepositoryProvider).cacheState(updated);
      }
    } on Object {
      // Offline safe.
    }
  }

  /// Drains local outbox and pulls cross-device state incrementally from `/v1/sync/pull`.
  Future<void> syncAcrossDevicesNow() async {
    if (state.isSyncingDevices) return;
    state = state.copyWith(isSyncingDevices: true, clearStatusMessage: true);
    try {
      await ref.read(authSessionServiceProvider).ensureAuthenticated();
      await ref.read(outboxSyncServiceProvider).processPendingQueue();
      final repo = ref.read(personalizationRepositoryProvider);
      final cursor = await repo.getSyncCursor();
      final res = await ref
          .read(personalizationGatewayProvider)
          .pullSyncRaw(sinceIso: cursor);
      if (_isDisposed) return;
      switch (res) {
        case Ok<Map<String, Object?>, Failure>(:final value):
          final summary = await ref
              .read(personalizationRepositoryProvider)
              .applyCrossDevicePull(value);
          final syncedAccent = await repo.getPreferredTtsAccent();
          ref.read(preferredTtsAccentProvider.notifier).setAccent(syncedAccent);
          if (!_isDisposed) {
            state = state.copyWith(
              isSyncingDevices: false,
              preferredTtsAccent: syncedAccent,
              statusMessage:
                  'Synced (${summary.attemptsMerged} attempts, ${summary.vocabStatesMerged} vocab, ${summary.pronunciationMerged} recordings).',
            );
          }
        case Err<Map<String, Object?>, Failure>(:final failure):
          state = state.copyWith(
            isSyncingDevices: false,
            statusMessage: 'Device sync unavailable: ${failure.message}',
          );
      }
    } on Object {
      if (!_isDisposed) {
        state = state.copyWith(
          isSyncingDevices: false,
          statusMessage: 'Device sync unavailable right now.',
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
