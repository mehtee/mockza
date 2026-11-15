import 'package:meta/meta.dart';
import 'package:mockza/core/models/attempt_status.dart';

/// Learner preferences, target band, and local entitlement cache.
@immutable
class UserProfile {
  /// Creates a [UserProfile].
  const new({
    required this.deviceId,
    required this.targetBand,
    required this.examModule,
    required this.isPro,
    this.examId = 'ielts_academic',
    this.targetDateSerial,
    this.onboardingCompleted = false,
    this.freeDiagnosticUsed = false,
    this.themeMode = 'system',
    this.linkedEmail,
    this.appUserId,
  });

  /// Stable hardware/keystore-backed pseudonymous device identifier.
  final String deviceId;

  /// Learner target overall IELTS band (e.g., `7.5`).
  final double targetBand;

  /// Selected IELTS track (`academic` or `generalTraining`).
  final ExamModuleType examModule;

  /// Cached pro subscription flag; authoritative check remains server-side.
  final bool isPro;

  /// Active exam identifier (`ielts_academic`, `ielts_general`, `pte_academic`, etc.).
  final String examId;

  /// Optional exam target date serial.
  final int? targetDateSerial;

  /// Whether onboarding has been completed.
  final bool onboardingCompleted;

  /// Whether free diagnostic evaluation has been used.
  final bool freeDiagnosticUsed;

  /// Visual theme mode preference ('system', 'dark', 'light').
  final String themeMode;

  /// Optional linked email address.
  final String? linkedEmail;

  /// Optional server account user ID.
  final String? appUserId;
}

/// Server-reported AI evaluation quota counters.
@immutable
class QuotaSnapshot {
  /// Creates a [QuotaSnapshot].
  const new({
    required this.speakingRemaining,
    required this.writingRemaining,
    required this.isPro,
    this.freeDiagnosticUsed = false,
    this.monthlyUsed = 0,
    this.monthlyLimit = 1,
  });

  /// Remaining speaking AI evaluations in the active window.
  final int speakingRemaining;

  /// Remaining writing AI evaluations in the active window.
  final int writingRemaining;

  /// Whether subscriber limits are currently unlocked.
  final bool isPro;

  /// Whether the single free diagnostic credit has already been used.
  final bool freeDiagnosticUsed;

  /// Total AI evaluations used in the current calendar month.
  final int monthlyUsed;

  /// Monthly AI evaluation cap.
  final int monthlyLimit;
}
