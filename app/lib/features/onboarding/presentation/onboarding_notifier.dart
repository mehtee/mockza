import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/app_router.dart';
import 'package:mockza/routing/routes.dart';

/// Immutable UI state for the 2-step onboarding wizard (23_*, 24_*).
@immutable
class OnboardingState {
  /// Creates an [OnboardingState].
  const new({
    required this.step,
    required this.selectedTrack,
    required this.targetBand,
    required this.targetDays,
    required this.wantDiagnostic,
    required this.isSaving,
    this.targetDateSerial,
    this.errorMessage,
  });

  /// Current step: `0` for Exam Selection (23_*), `1` for Goal & Date Setup (24_*).
  final int step;

  /// Selected exam track.
  final ExamTrack selectedTrack;

  /// Selected target score / band (e.g. 7.5 for IELTS, 65 for PTE).
  final double targetBand;

  /// Target study timeframe in days (e.g. 14, 30, 90, or null if unset).
  final int? targetDays;

  /// Explicit canonical UTC [SerialDay] value selected via calendar picker.
  final int? targetDateSerial;

  /// Whether the user wishes to start immediately with a free diagnostic mock.
  final bool wantDiagnostic;

  /// Whether final persistence and initial catalog sync are in progress.
  final bool isSaving;

  /// Non-fatal setup error message if persistence failed.
  final String? errorMessage;

  /// Convenience getter for legacy module type.
  ExamModuleType get examModule => selectedTrack == ExamTrack.ieltsGeneral
      ? ExamModuleType.generalTraining
      : ExamModuleType.academic;

  /// Returns whether the selected track uses the 0.0–9.0 half-band IELTS scale.
  bool get isIeltsScale =>
      selectedTrack == ExamTrack.ieltsAcademic ||
      selectedTrack == ExamTrack.ieltsGeneral;

  /// Returns a formatted display label for the selected score.
  String get formattedTargetScore =>
      selectedTrack.formatScoreWithUnit(targetBand);

  /// Returns a copy with updated onboarding selections.
  OnboardingState copyWith({
    int? step,
    ExamTrack? selectedTrack,
    double? targetBand,
    int? targetDays,
    bool? clearTargetDays = false,
    int? targetDateSerial,
    bool clearTargetDateSerial = false,
    bool? wantDiagnostic,
    bool? isSaving,
    String? errorMessage,
    bool clearError = false,
  }) => OnboardingState(
    step: step ?? this.step,
    selectedTrack: selectedTrack ?? this.selectedTrack,
    targetBand: targetBand ?? this.targetBand,
    targetDays: (clearTargetDays ?? false)
        ? null
        : (targetDays ?? this.targetDays),
    targetDateSerial: clearTargetDateSerial
        ? null
        : (targetDateSerial ?? this.targetDateSerial),
    wantDiagnostic: wantDiagnostic ?? this.wantDiagnostic,
    isSaving: isSaving ?? this.isSaving,
    errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
  );
}

/// Manages onboarding setup inputs, persistence, and initial content sync.
class OnboardingNotifier extends Notifier<OnboardingState> {
  @override
  OnboardingState build() => const OnboardingState(
    step: 0,
    selectedTrack: ExamTrack.ieltsAcademic,
    targetBand: 7.5,
    targetDays: 30,
    wantDiagnostic: true,
    isSaving: false,
  );

  /// Selects active exam track and recalibrates default target score.
  void selectTrack(ExamTrack track) {
    state = state.copyWith(
      selectedTrack: track,
      targetBand: track.targetScoreDefault,
      clearError: true,
    );
  }

  /// Updates the selected target score using track-appropriate step increments.
  void selectTargetBand(double band) {
    state = state.copyWith(targetBand: state.selectedTrack.quantizeScore(band));
  }

  /// Sets target days until exam.
  void selectTargetDays(int? days) {
    state = state.copyWith(
      targetDays: days,
      clearTargetDays: days == null,
      clearTargetDateSerial: true,
    );
  }

  /// Sets an exact canonical UTC [SerialDay] for the user's exam date.
  void selectTargetDateSerial(int? serial) {
    if (serial == null) {
      state = state.copyWith(
        clearTargetDays: true,
        clearTargetDateSerial: true,
      );
      return;
    }
    final todaySerial = SerialDay.fromUtcDateTime(
      ref.read(clockProvider).now(),
    ).value;
    final diffDays = (serial - todaySerial).clamp(1, 3650);
    state = state.copyWith(
      targetDateSerial: serial,
      targetDays: diffDays,
    );
  }

  /// Toggles diagnostic test preference.
  void toggleDiagnostic({required bool want}) {
    state = state.copyWith(wantDiagnostic: want);
  }

  /// Advances to goal setup step.
  void nextStep() {
    state = state.copyWith(step: 1, clearError: true);
  }

  /// Returns to exam selection step.
  void previousStep() {
    state = state.copyWith(step: 0, clearError: true);
  }

  /// Persists onboarding preferences, bootstraps anonymous session/catalog sync,
  /// and returns the destination route (`/diagnostic/intro` or `/home`).
  Future<String?> completeOnboarding() async {
    if (state.isSaving) return null;
    state = state.copyWith(isSaving: true, clearError: true);

    try {
      final identity = ref.read(secureIdentityServiceProvider);
      final entropy = ref.read(entropySourceProvider);
      final idRes = await identity.getOrCreateDeviceId();
      final deviceId = idRes.valueOrNull ?? entropy.nextUuidV4();

      final profileRepo = ref.read(profileRepositoryProvider);
      final primary = await profileRepo.loadOrInitializePrimary(
        fallbackDeviceId: deviceId,
      );
      final todaySerial = SerialDay.fromUtcDateTime(
        ref.read(clockProvider).now(),
      ).value;

      final resolvedTargetSerial =
          state.targetDateSerial ??
          (state.targetDays != null ? (todaySerial + state.targetDays!) : null);
      await profileRepo.saveTargetPreferences(
        deviceId: primary.deviceId,
        targetBand: state.targetBand,
        examModule: state.examModule,
        examId: state.selectedTrack.id,
        targetDateSerial: resolvedTargetSerial,
        clearTargetDate: resolvedTargetSerial == null,
      );
      await profileRepo.completeOnboarding(primary.deviceId);
      ref.read(onboardingCompletedLatchProvider.notifier).completed = true;

      // Kick off anonymous JWT + lightweight catalog sync right after navigation
      // so the UI transitions immediately without waiting on IndexedDB/SQLite writes.
      final authSession = ref.read(authSessionServiceProvider);
      final contentSync = ref.read(contentSyncServiceProvider);
      unawaited(
        Future<void>.delayed(const Duration(milliseconds: 250), () async {
          try {
            await authSession.ensureAuthenticated();
            await contentSync.syncAllCatalogData();
          } on Object {
            // Sync continues silently on home / reconnect.
          }
        }),
      );

      final destination = state.wantDiagnostic
          ? AppRoutes.buildDiagnosticIntro(examId: state.selectedTrack.id)
          : AppRoutes.home;
      state = state.copyWith(isSaving: false);
      return destination;
    } on Object {
      state = state.copyWith(
        isSaving: false,
        errorMessage: 'Could not save your setup. Please try again.',
      );
      return null;
    }
  }
}
