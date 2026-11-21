import 'package:clock/clock.dart';
import 'package:drift/drift.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/models/user_profile.dart';
import 'package:mockza/data/db/app_database.dart';
import 'package:mockza/data/db/tables/core_tables.dart' show UserProfiles;

/// Repository encapsulating local [UserProfiles] reads and writes without leaking Drift.
final class ProfileRepository {
  /// Creates a [ProfileRepository].
  const new({
    required this._db,
    required this._clock,
    this.generateFallbackDeviceId,
  });

  final AppDatabase _db;
  final Clock _clock;

  /// Optional UUID generator used if `loadOrInitializePrimary` is called without an explicit ID.
  final String Function()? generateFallbackDeviceId;

  /// Loads or initializes the default local [UserProfile] for [deviceId].
  Future<UserProfile> loadOrInitialize(String deviceId) async {
    final row = await _db.progressDao.getProfile(deviceId);
    if (row != null) {
      return UserProfile(
        deviceId: row.deviceId,
        targetBand: row.targetBand,
        examModule: row.examModule == ExamModuleType.generalTraining.name
            ? ExamModuleType.generalTraining
            : ExamModuleType.academic,
        isPro: row.isPro,
        examId: row.examId,
        targetDateSerial: row.targetDateSerial,
        onboardingCompleted: row.onboardingCompleted,
        freeDiagnosticUsed: row.freeDiagnosticUsed,
        themeMode: row.themeMode,
        linkedEmail: row.linkedEmail,
        appUserId: row.appUserId,
      );
    }

    final now = _clock.now().toUtc();
    const initial = ExamModuleType.academic;
    await _db.progressDao.upsertProfile(
      UserProfilesCompanion.insert(
        deviceId: deviceId,
        targetBand: const Value(7),
        examModule: Value(initial.name),
        isPro: const Value(false),
        examId: const Value('ielts_academic'),
        onboardingCompleted: const Value(false),
        freeDiagnosticUsed: const Value(false),
        themeMode: const Value('system'),
        createdAt: now,
        updatedAt: now,
      ),
    );
    return UserProfile(
      deviceId: deviceId,
      targetBand: 7,
      examModule: initial,
      isPro: false,
    );
  }

  /// Persists updated target band and track preference for [deviceId].
  Future<void> saveTargetPreferences({
    required String deviceId,
    required double targetBand,
    required ExamModuleType examModule,
    String? examId,
    int? targetDateSerial,
    bool clearTargetDate = false,
  }) async {
    final now = _clock.now().toUtc();
    final existing = await _db.progressDao.getProfile(deviceId);
    await _db.progressDao.upsertProfile(
      UserProfilesCompanion.insert(
        deviceId: deviceId,
        targetBand: Value(targetBand),
        examModule: Value(examModule.name),
        isPro: Value(existing?.isPro ?? false),
        examId: Value(examId ?? existing?.examId ?? 'ielts_academic'),
        targetDateSerial: Value(
          clearTargetDate
              ? null
              : (targetDateSerial ?? existing?.targetDateSerial),
        ),
        onboardingCompleted: Value(existing?.onboardingCompleted ?? false),
        freeDiagnosticUsed: Value(existing?.freeDiagnosticUsed ?? false),
        themeMode: Value(existing?.themeMode ?? 'system'),
        linkedEmail: Value(existing?.linkedEmail),
        appUserId: Value(existing?.appUserId),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      ),
    );
  }

  /// Loads the primary persisted learner profile if any exists, or initializes
  /// a default profile using [fallbackDeviceId] or generated UUID (`BF-10`).
  Future<UserProfile> loadOrInitializePrimary({
    String? fallbackDeviceId,
  }) async {
    final existingList = await (_db.select(_db.userProfiles)..limit(1)).get();
    if (existingList.isNotEmpty) {
      return await loadOrInitialize(existingList.first.deviceId);
    }
    final resolvedId =
        (fallbackDeviceId != null && fallbackDeviceId.trim().isNotEmpty)
        ? fallbackDeviceId
        : (generateFallbackDeviceId?.call() ??
              'device-${_clock.now().toUtc().millisecondsSinceEpoch}');
    return await loadOrInitialize(resolvedId);
  }

  /// Streams the primary persisted learner profile whenever it changes in SQLite.
  Stream<UserProfile?> watchPrimaryProfile() {
    return (_db.select(_db.userProfiles)..limit(1)).watch().map((rows) {
      if (rows.isEmpty) return null;
      final row = rows.first;
      final module = ExamModuleType.values.firstWhere(
        (e) => e.name == row.examModule,
        orElse: () => ExamModuleType.academic,
      );
      return UserProfile(
        deviceId: row.deviceId,
        targetBand: row.targetBand,
        examModule: module,
        isPro: row.isPro,
        examId: row.examId,
        targetDateSerial: row.targetDateSerial,
        onboardingCompleted: row.onboardingCompleted,
        freeDiagnosticUsed: row.freeDiagnosticUsed,
        themeMode: row.themeMode,
        linkedEmail: row.linkedEmail,
        appUserId: row.appUserId,
      );
    });
  }

  Future<void> _patchProfile(
    String deviceId, {
    bool? onboardingCompleted,
    String? themeMode,
    bool? isPro,
    String? appUserId,
    String? linkedEmail,
    bool? freeDiagnosticUsed,
  }) async {
    final now = _clock.now().toUtc();
    final existing = await _db.progressDao.getProfile(deviceId);
    if (existing == null) return;
    await _db.progressDao.upsertProfile(
      UserProfilesCompanion.insert(
        deviceId: existing.deviceId,
        targetBand: Value(existing.targetBand),
        examModule: Value(existing.examModule),
        isPro: Value(isPro ?? existing.isPro),
        examId: Value(existing.examId),
        targetDateSerial: Value(existing.targetDateSerial),
        onboardingCompleted: Value(
          onboardingCompleted ?? existing.onboardingCompleted,
        ),
        freeDiagnosticUsed: Value(
          freeDiagnosticUsed ?? existing.freeDiagnosticUsed,
        ),
        themeMode: Value(themeMode ?? existing.themeMode),
        linkedEmail: Value(linkedEmail ?? existing.linkedEmail),
        appUserId: Value(appUserId ?? existing.appUserId),
        createdAt: existing.createdAt,
        updatedAt: now,
      ),
    );
  }

  /// Marks the onboarding flow as completed.
  Future<void> completeOnboarding(String deviceId) =>
      _patchProfile(deviceId, onboardingCompleted: true);

  /// Sets the user's theme mode ('system', 'dark', 'light').
  Future<void> setThemeMode(String deviceId, String themeMode) =>
      _patchProfile(deviceId, themeMode: themeMode);

  /// Persists the Pro subscription entitlement flag on the learner profile.
  Future<void> setProEntitlement(String deviceId, {required bool isPro}) =>
      _patchProfile(deviceId, isPro: isPro);

  /// Stores the server-issued `appUserId` on the learner profile.
  Future<void> setAppUserId(String deviceId, String appUserId) =>
      _patchProfile(deviceId, appUserId: appUserId);

  /// Binds an authenticated account (`userId`, [email], [isPro]) to [deviceId].
  Future<void> saveAuthenticatedAccount({
    required String deviceId,
    required String userId,
    String? email,
    bool? isPro,
    bool markOnboardingCompleted = false,
  }) async {
    final now = _clock.now().toUtc();
    final existing = await _db.progressDao.getProfile(deviceId);
    await _db.progressDao.upsertProfile(
      UserProfilesCompanion.insert(
        deviceId: existing?.deviceId ?? deviceId,
        targetBand: Value(existing?.targetBand ?? 7),
        examModule: Value(existing?.examModule ?? ExamModuleType.academic.name),
        isPro: Value(isPro ?? existing?.isPro ?? false),
        examId: Value(existing?.examId ?? 'ielts_academic'),
        targetDateSerial: Value(existing?.targetDateSerial),
        onboardingCompleted: Value(
          markOnboardingCompleted || (existing?.onboardingCompleted ?? false),
        ),
        freeDiagnosticUsed: Value(existing?.freeDiagnosticUsed ?? false),
        themeMode: Value(existing?.themeMode ?? 'system'),
        linkedEmail: Value(email ?? existing?.linkedEmail),
        appUserId: Value(userId),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      ),
    );
  }

  /// Unlinks the authenticated account and clears subscriber privileges on sign-out or revocation.
  Future<void> clearAuthenticatedAccount(String deviceId) async {
    final now = _clock.now().toUtc();
    final existing = await _db.progressDao.getProfile(deviceId);
    if (existing == null) return;
    await _db.progressDao.upsertProfile(
      UserProfilesCompanion.insert(
        deviceId: existing.deviceId,
        targetBand: Value(existing.targetBand),
        examModule: Value(existing.examModule),
        isPro: const Value(false),
        examId: Value(existing.examId),
        targetDateSerial: Value(existing.targetDateSerial),
        onboardingCompleted: Value(existing.onboardingCompleted),
        freeDiagnosticUsed: Value(existing.freeDiagnosticUsed),
        themeMode: Value(existing.themeMode),
        linkedEmail: const Value<String?>(null),
        appUserId: const Value<String?>(null),
        createdAt: existing.createdAt,
        updatedAt: now,
      ),
    );
  }

  /// Clears all persisted learner, attempt, vocab, and cache rows in SQLite.
  Future<void> resetAllLocalData() => _db.wipeAllData();
}
