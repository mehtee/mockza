import 'dart:async';

import 'package:clock/clock.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/preferences/appearance_settings.dart';
import 'package:mockza/data/db/app_database.dart';
import 'package:mockza/data/db/connection.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/data/repositories/exam_catalog_repository.dart';
import 'package:mockza/data/repositories/linguistic_repository.dart';
import 'package:mockza/data/repositories/personalization_repository.dart';
import 'package:mockza/data/repositories/profile_repository.dart';
import 'package:mockza/data/repositories/progress_repository.dart';
import 'package:mockza/data/repositories/vocab_repository.dart';
import 'package:mockza/services/appearance_storage_service.dart';
import 'package:mockza/services/audio_player_gateway.dart';
import 'package:mockza/services/audio_recorder_gateway.dart';
import 'package:mockza/services/auth_session_service.dart';
import 'package:mockza/services/billing_gateway.dart';
import 'package:mockza/services/cache_cleanup_service.dart';
import 'package:mockza/services/content_sync_service.dart';
import 'package:mockza/services/crash_log.dart';
import 'package:mockza/services/diagnostic_gateway.dart';
import 'package:mockza/services/entropy_source.dart';
import 'package:mockza/services/grading_gateway.dart';
import 'package:mockza/services/linguistic_gateway.dart';
import 'package:mockza/services/native/platform_audio_channel.dart';
import 'package:mockza/services/native/share_intent_bridge.dart';
import 'package:mockza/services/network/dio_client.dart';
import 'package:mockza/services/outbox_sync_service.dart';
import 'package:mockza/services/personalization_gateway.dart';
import 'package:mockza/services/secure_identity_service.dart';
import 'package:mockza/services/social_auth_gateway.dart';
import 'package:mockza/services/speech_practice_gateway.dart';

/// Active edition runtime configuration (overridden in `bootstrap`).
final Provider<EditionConfig> editionConfigProvider = Provider<EditionConfig>(
  (ref) => EditionConfig.globalDefault,
);

/// Injectable wall clock; always override with `Clock.fixed(...)` in tests.
final Provider<Clock> clockProvider = Provider<Clock>((ref) => const Clock());

/// Application diagnostic and error-boundary logger.
final Provider<CrashLog> crashLogProvider = Provider<CrashLog>(
  (ref) => DeveloperCrashLog(ref.watch(editionConfigProvider).edition),
);

/// Cryptographic randomness source for UUIDs.
final Provider<EntropySource> entropySourceProvider = Provider<EntropySource>(
  (ref) => SecureEntropySource(),
);

/// Thin OS keystore/keychain & Web localStorage adapter.
final Provider<SecureStorageGateway> secureStorageGatewayProvider =
    Provider<SecureStorageGateway>(
      (ref) => const FlutterSecureStorageGateway(),
    );

/// Pseudonymous device identity and bearer token manager.
final Provider<SecureIdentityService> secureIdentityServiceProvider =
    Provider<SecureIdentityService>(
      (ref) => SecureIdentityService(
        storage: ref.watch(secureStorageGatewayProvider),
        entropy: ref.watch(entropySourceProvider),
      ),
    );

/// Whether local SQLite had to fall back to ephemeral RAM (e.g. Web private mode) (`RR-07`).
final Provider<bool> isDatabaseEphemeralProvider = Provider<bool>(
  (ref) => isDatabaseEphemeral,
);

/// Root SQLite database instance managed by Riverpod lifecycle.
final Provider<AppDatabase> appDatabaseProvider = Provider<AppDatabase>((ref) {
  final db = openProductionDatabase();
  ref.onDispose(() {
    unawaited(db.close());
  });
  return db;
});

/// Profile repository provider.
final Provider<ProfileRepository> profileRepositoryProvider =
    Provider<ProfileRepository>(
      (ref) => ProfileRepository(
        db: ref.watch(appDatabaseProvider),
        clock: ref.watch(clockProvider),
        generateFallbackDeviceId: ref.watch(entropySourceProvider).nextUuidV4,
      ),
    );

/// Offline exam catalog & Postgres bundle repository provider.
final Provider<ExamCatalogRepository> examCatalogRepositoryProvider =
    Provider<ExamCatalogRepository>(
      (ref) => ExamCatalogRepository(
        db: ref.watch(appDatabaseProvider),
        clock: ref.watch(clockProvider),
      ),
    );

/// Exam attempt history and submission repository provider.
final Provider<AttemptRepository> attemptRepositoryProvider =
    Provider<AttemptRepository>(
      (ref) => AttemptRepository(
        db: ref.watch(appDatabaseProvider),
        clock: ref.watch(clockProvider),
      ),
    );

/// Spaced-repetition vocabulary deck repository provider.
final Provider<VocabRepository> vocabRepositoryProvider =
    Provider<VocabRepository>(
      (ref) => VocabRepository(
        db: ref.watch(appDatabaseProvider),
        clock: ref.watch(clockProvider),
      ),
    );

/// Daily study logs and streak repository provider.
final Provider<ProgressRepository> progressRepositoryProvider =
    Provider<ProgressRepository>(
      (ref) => ProgressRepository(
        db: ref.watch(appDatabaseProvider),
        clock: ref.watch(clockProvider),
      ),
    );

/// Social OIDC / Dev Sandbox credential gateway provider.
final Provider<SocialAuthGateway> socialAuthGatewayProvider =
    Provider<SocialAuthGateway>((ref) => const DefaultSocialAuthGateway());

/// Device JWT handshake, account auth & session termination coordinator.
final Provider<AuthSessionService> authSessionServiceProvider =
    Provider<AuthSessionService>(
      (ref) => AuthSessionService(
        config: ref.watch(editionConfigProvider),
        identity: ref.watch(secureIdentityServiceProvider),
        clock: ref.watch(clockProvider),
        crashLog: ref.watch(crashLogProvider),
        socialAuthGateway: ref.watch(socialAuthGatewayProvider),
        onRemoteSessionUnlinked: (deviceId) async {
          try {
            await ref
                .read(profileRepositoryProvider)
                .clearAuthenticatedAccount(deviceId);
          } on Object {
            // Ignore in isolated tests without local DB.
          }
        },
      ),
    );

/// Configured HTTP client provider with bearer auth & 401 refresh interceptor.
final Provider<Dio> dioProvider = Provider<Dio>((ref) {
  final config = ref.watch(editionConfigProvider);
  final identity = ref.watch(secureIdentityServiceProvider);
  final auth = ref.watch(authSessionServiceProvider);
  final dio = createApiDioClient(
    config: config,
    readAccessToken: identity.readAccessToken,
    refreshAccessToken: auth.refreshTokenOrNull,
  );
  ref.onDispose(dio.close);
  return dio;
});

/// Remote AI speaking & writing grading gateway provider.
final Provider<GradingGateway> gradingGatewayProvider =
    Provider<GradingGateway>(
      (ref) => HttpGradingGateway(ref.watch(dioProvider)),
    );

/// Rapid 4-skill baseline diagnostic gateway provider.
final Provider<DiagnosticGateway> diagnosticGatewayProvider =
    Provider<DiagnosticGateway>(
      (ref) => HttpDiagnosticGateway(ref.watch(dioProvider)),
    );

/// Synchronizes exam bundles, drills, and vocab cards from PostgreSQL/SeaweedFS API.
final Provider<ContentSyncService> contentSyncServiceProvider =
    Provider<ContentSyncService>(
      (ref) => ContentSyncService(
        dio: ref.watch(dioProvider),
        catalogRepository: ref.watch(examCatalogRepositoryProvider),
        vocabRepository: ref.watch(vocabRepositoryProvider),
        authSession: ref.watch(authSessionServiceProvider),
        editionConfig: ref.watch(editionConfigProvider),
        crashLog: ref.watch(crashLogProvider),
      ),
    );

/// Offline submission queue retry & 7-day local audio retention processor.
final Provider<OutboxSyncService> outboxSyncServiceProvider =
    Provider<OutboxSyncService>((ref) {
      final service = OutboxSyncService(
        attemptRepository: ref.watch(attemptRepositoryProvider),
        gradingGateway: ref.watch(gradingGatewayProvider),
        authSession: ref.watch(authSessionServiceProvider),
        crashLog: ref.watch(crashLogProvider),
        linguisticGateway: ref.watch(linguisticGatewayProvider),
        linguisticRepository: ref.watch(linguisticRepositoryProvider),
        personalizationGateway: ref.watch(personalizationGatewayProvider),
        clock: ref.watch(clockProvider),
      );
      ref.onDispose(service.dispose);
      return service;
    });

/// Local downloaded exam bundle & speaking audio cache cleanup service.
final Provider<CacheCleanupService> cacheCleanupServiceProvider =
    Provider<CacheCleanupService>(
      (ref) => CacheCleanupService(
        catalogRepository: ref.watch(examCatalogRepositoryProvider),
        attemptRepository: ref.watch(attemptRepositoryProvider),
      ),
    );

/// Microphone capture gateway provider.
final Provider<AudioRecorderGateway> audioRecorderGatewayProvider =
    Provider<AudioRecorderGateway>((ref) {
      final recorder = RecordAudioRecorderGateway();
      ref.onDispose(() {
        unawaited(recorder.dispose());
      });
      return recorder;
    });

/// Local audio playback gateway provider.
final Provider<AudioPlayerGateway> audioPlayerGatewayProvider =
    Provider<AudioPlayerGateway>((ref) {
      final player = JustAudioPlayerGateway();
      ref.onDispose(() {
        unawaited(player.dispose());
      });
      return player;
    });

/// Flavor-selected billing entitlement gateway provider.
final Provider<BillingGateway> billingGatewayProvider =
    Provider<BillingGateway>((
      ref,
    ) {
      final edition = ref.watch(editionConfigProvider).edition;
      final identity = ref.watch(secureIdentityServiceProvider);
      final profileRepo = ref.watch(profileRepositoryProvider);
      return switch (edition) {
        AppEdition.global => RevenueCatBillingGateway(
          resolveAppUserId: () async {
            try {
              final profile = await profileRepo.loadOrInitializePrimary();
              if (profile.appUserId != null && profile.appUserId!.isNotEmpty) {
                return profile.appUserId;
              }
            } on Object {
              // Fall back to deviceId when DB is unavailable.
            }
            final res = await identity.getOrCreateDeviceId();
            return res.valueOrNull;
          },
        ),
        AppEdition.iran => IranBillingGateway(dio: ref.watch(dioProvider)),
      };
    });

/// Quarantined OS audio session method channel provider.
final Provider<PlatformAudioChannel> platformAudioChannelProvider =
    Provider<PlatformAudioChannel>((ref) => const PlatformAudioChannel());

/// Quarantined OS Share Sheet bridge provider (`ADR-ADV-007`).
final Provider<ShareIntentBridge> shareIntentBridgeProvider =
    Provider<ShareIntentBridge>((ref) {
      final bridge = ShareIntentBridge();
      ref.onDispose(() => unawaited(bridge.dispose()));
      return bridge;
    });

/// Closed-Loop Linguistic Graph, Daily Mission, Register Shifter, and Drop Anything gateway.
final Provider<LinguisticGateway> linguisticGatewayProvider =
    Provider<LinguisticGateway>(
      (ref) => HttpLinguisticGateway(ref.watch(dioProvider)),
    );

/// Drift offline repository for Linguistic Graph, Daily Missions, and Drops.
final Provider<LinguisticRepository> linguisticRepositoryProvider =
    Provider<LinguisticRepository>(
      (ref) => LinguisticRepository(
        db: ref.watch(appDatabaseProvider),
        clock: ref.watch(clockProvider),
      ),
    );

/// Adaptive personalization, dynamic band & roadmap HTTP gateway provider.
final Provider<PersonalizationGateway> personalizationGatewayProvider =
    Provider<PersonalizationGateway>(
      (ref) => HttpPersonalizationGateway(ref.watch(dioProvider)),
    );

/// Drift offline repository for personalization cache, pronunciation & cross-device sync.
final Provider<PersonalizationRepository> personalizationRepositoryProvider =
    Provider<PersonalizationRepository>(
      (ref) => PersonalizationRepository(
        db: ref.watch(appDatabaseProvider),
        clock: ref.watch(clockProvider),
        profileRepository: ref.watch(profileRepositoryProvider),
      ),
    );

/// OpenRouter Kokoro TTS & Gemini Pronunciation Practice HTTP gateway provider.
final Provider<SpeechPracticeGateway> speechPracticeGatewayProvider =
    Provider<SpeechPracticeGateway>(
      (ref) => HttpSpeechPracticeGateway(ref.watch(dioProvider)),
    );

/// Preloaded [AppearanceSettings] injected during `bootstrap`.
final Provider<AppearanceSettings> initialAppearanceSettingsProvider =
    Provider<AppearanceSettings>((ref) => const AppearanceSettings());

/// Storage adapter persisting theme brightness & Open-Closed preset selection.
final Provider<AppearanceStorageService> appearanceStorageServiceProvider =
    Provider<AppearanceStorageService>(
      (ref) =>
          AppearanceStorageService(ref.watch(secureStorageGatewayProvider)),
    );

/// Manages live visual theme mode & palette preset without coupling UI to storage.
class AppearanceSettingsNotifier extends Notifier<AppearanceSettings> {
  @override
  AppearanceSettings build() => ref.watch(initialAppearanceSettingsProvider);

  /// Updates the active theme brightness mode (`dark`, `light`, or `system`).
  void setThemeMode(String modeKey) {
    state = state.copyWith(themeModeKey: modeKey);
    unawaited(
      ref.read(appearanceStorageServiceProvider).saveThemeMode(modeKey),
    );
  }

  /// Updates the active Open-Closed theme preset identifier (`presetId`).
  void setPresetId(String presetId) {
    state = state.copyWith(presetId: presetId);
    unawaited(
      ref.read(appearanceStorageServiceProvider).savePresetId(presetId),
    );
  }

  /// Resets visual theme preferences back to defaults.
  void resetToDefaults() {
    state = const AppearanceSettings();
    unawaited(ref.read(appearanceStorageServiceProvider).reset());
  }
}

/// Global reactive appearance settings provider consumed by `MockzaApp` and Settings.
final NotifierProvider<AppearanceSettingsNotifier, AppearanceSettings>
appearanceSettingsProvider =
    NotifierProvider<AppearanceSettingsNotifier, AppearanceSettings>(
      AppearanceSettingsNotifier.new,
    );

/// Holds the active global Kokoro TTS voice accent (`us` or `uk`) across all InlineListenButtons.
class PreferredTtsAccentNotifier extends Notifier<String> {
  bool _explicitlySet = false;

  @override
  String build() {
    var disposed = false;
    ref.onDispose(() => disposed = true);
    unawaited(_hydrate(() => disposed));
    return 'us';
  }

  Future<void> _hydrate(bool Function() isDisposed) async {
    try {
      final saved = await ref
          .read(personalizationRepositoryProvider)
          .getPreferredTtsAccent();
      if (!isDisposed() && !_explicitlySet && saved != state) {
        state = saved;
      }
    } on Object {
      // Safe fallback in minimal widget tests without Drift bindings.
    }
  }

  /// Updates active Kokoro voice accent (`us` or `uk`) synchronously.
  void setAccent(String accent) {
    _explicitlySet = true;
    state = accent == 'uk' ? 'uk' : 'us';
  }
}

/// Global Kokoro TTS accent provider (`us` -> `af_bella`, `uk` -> `bf_emma`).
final NotifierProvider<PreferredTtsAccentNotifier, String>
preferredTtsAccentProvider = NotifierProvider<PreferredTtsAccentNotifier, String>(
  PreferredTtsAccentNotifier.new,
);
