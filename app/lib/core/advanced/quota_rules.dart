import 'dart:math' as math;

/// Quota feature buckets for Register Shifter and Bounded Drop Anything.
enum AdvancedQuotaFeature {
  /// 3-Gear Register Shifter bucket.
  registerShifter,

  /// Drop Anything text/url/image bucket.
  dropTextImage,

  /// Bounded Drop Anything audio bucket.
  dropAudio,
}

/// Result returned by [AdvancedQuotaRules.evaluate].
class AdvancedQuotaResult {
  /// Creates an [AdvancedQuotaResult].
  const new({
    required this.allowed,
    required this.shifterRemaining,
    required this.dropsRemaining,
    required this.monthlyRemaining,
    this.reason,
  });

  /// Whether action is permitted within current quota.
  final bool allowed;

  /// Optional denial code.
  final String? reason;

  /// Remaining Register Shifter quota today.
  final int shifterRemaining;

  /// Remaining Drop Anything quota today.
  final int dropsRemaining;

  /// Remaining total AI monthly quota.
  final int monthlyRemaining;
}

/// Pure Dart mirror of `evaluateAdvancedFeatureQuota` in `@mockza/domain`.
abstract final class AdvancedQuotaRules {
  /// Pro daily speaking allowance.
  static const int proDailySpeakingQuota = 10;

  /// Pro daily Register Shifter cap.
  static const int proDailyShifterQuota = 5;

  /// Pro daily Drop Anything cap.
  static const int proDailyDropQuota = 5;

  /// Pro daily audio Drop cap.
  static const int proDailyDropAudioQuota = 3;

  /// Pro monthly cap in GLB edition.
  static const int proMonthlyGlbQuota = 150;

  /// Pro monthly cap in IRN edition.
  static const int proMonthlyIrnQuota = 120;

  /// Evaluates daily and monthly quota eligibility before invoking AI actions.
  static AdvancedQuotaResult evaluate({
    required AdvancedQuotaFeature feature,
    required bool isPro,
    required bool freeSampleUsed,
    required int speakingUsedToday,
    required int shifterUsedToday,
    required int dropsUsedToday,
    required int audioDropsUsedToday,
    required int monthlyUsed,
    required String editionCode,
  }) {
    final monthlyCap = editionCode == 'irn'
        ? proMonthlyIrnQuota
        : proMonthlyGlbQuota;
    final monthlyRemaining = math.max(0, monthlyCap - monthlyUsed);

    if (!isPro) {
      if (feature == AdvancedQuotaFeature.dropAudio) {
        return const AdvancedQuotaResult(
          allowed: false,
          reason: 'pro_required_for_audio_drop',
          shifterRemaining: 0,
          dropsRemaining: 0,
          monthlyRemaining: 0,
        );
      }
      final allowed = !freeSampleUsed;
      return AdvancedQuotaResult(
        allowed: allowed,
        reason: allowed ? null : 'free_sample_used',
        shifterRemaining:
            feature == AdvancedQuotaFeature.registerShifter && allowed ? 1 : 0,
        dropsRemaining: feature == AdvancedQuotaFeature.dropTextImage && allowed
            ? 1
            : 0,
        monthlyRemaining: allowed ? 1 : 0,
      );
    }

    final shifterRemaining = math.max(
      0,
      math.min(
        proDailyShifterQuota - shifterUsedToday,
        proDailySpeakingQuota - speakingUsedToday,
      ),
    );
    final dropsRemaining = math.max(0, proDailyDropQuota - dropsUsedToday);

    if (monthlyRemaining <= 0) {
      return AdvancedQuotaResult(
        allowed: false,
        reason: 'monthly_quota_exceeded',
        shifterRemaining: shifterRemaining,
        dropsRemaining: dropsRemaining,
        monthlyRemaining: 0,
      );
    }

    if (feature == AdvancedQuotaFeature.registerShifter) {
      if (speakingUsedToday >= proDailySpeakingQuota) {
        return AdvancedQuotaResult(
          allowed: false,
          reason: 'daily_speaking_quota_exceeded',
          shifterRemaining: 0,
          dropsRemaining: dropsRemaining,
          monthlyRemaining: monthlyRemaining,
        );
      }
      if (shifterUsedToday >= proDailyShifterQuota) {
        return AdvancedQuotaResult(
          allowed: false,
          reason: 'daily_shifter_quota_exceeded',
          shifterRemaining: 0,
          dropsRemaining: dropsRemaining,
          monthlyRemaining: monthlyRemaining,
        );
      }
      return AdvancedQuotaResult(
        allowed: true,
        shifterRemaining: shifterRemaining,
        dropsRemaining: dropsRemaining,
        monthlyRemaining: monthlyRemaining,
      );
    }

    if (dropsUsedToday >= proDailyDropQuota) {
      return AdvancedQuotaResult(
        allowed: false,
        reason: 'daily_drop_quota_exceeded',
        shifterRemaining: shifterRemaining,
        dropsRemaining: 0,
        monthlyRemaining: monthlyRemaining,
      );
    }

    if (feature == AdvancedQuotaFeature.dropAudio) {
      if (speakingUsedToday >= proDailySpeakingQuota) {
        return AdvancedQuotaResult(
          allowed: false,
          reason: 'daily_speaking_quota_exceeded',
          shifterRemaining: shifterRemaining,
          dropsRemaining: dropsRemaining,
          monthlyRemaining: monthlyRemaining,
        );
      }
      if (audioDropsUsedToday >= proDailyDropAudioQuota) {
        return AdvancedQuotaResult(
          allowed: false,
          reason: 'daily_audio_drop_quota_exceeded',
          shifterRemaining: shifterRemaining,
          dropsRemaining: dropsRemaining,
          monthlyRemaining: monthlyRemaining,
        );
      }
    }

    return AdvancedQuotaResult(
      allowed: true,
      shifterRemaining: shifterRemaining,
      dropsRemaining: dropsRemaining,
      monthlyRemaining: monthlyRemaining,
    );
  }
}
