import 'package:clock/clock.dart';
import 'package:mockza/core/diagnostic/diagnostic_models.dart';

/// Standard realistic rapid starting-level budget constants aligned with `@mockza/domain`.
abstract final class DiagnosticBudget {
  /// Intro & device-check guidance window (`60s`, unscored & never deducted).
  static const int introMaxSeconds = 60;

  /// Live Reading stage allocation (`210s` = 3:30 across 3–4 short passages).
  static const int readingMaxSeconds = 210;

  /// Live Listening answering window (`210s` = 3:30 across 3 clips, paused during playback).
  static const int listeningMaxSeconds = 210;

  /// Base Writing prompt allocation (`240s` = 4:00 for 35–55 words).
  static const int writingMaxSeconds = 240;

  /// Optional Writing follow-up allocation (`75s` = 1:15).
  static const int writingFollowUpMaxSeconds = 75;

  /// Speaking cue-card preparation allocation (`35s`).
  static const int speakingPrepMaxSeconds = 35;

  /// Main Speaking response turn cap (`60s`).
  static const int speakingMainMaxSeconds = 60;

  /// Optional Speaking follow-up turn cap (`35s`).
  static const int speakingFollowUpMaxSeconds = 35;

  /// Combined Speaking stage budget (`150s`).
  static const int speakingMaxSeconds = 150;

  /// Three inter-stage transition caps (`5s` each, skippable immediately).
  static const int transitionMaxSeconds = 5;

  /// Total standard response-collection ceiling (`900s` = 15:00).
  static const int collectionTotalSeconds = 900;

  /// Post-collection results/status polling window (`90s` = 1:30).
  static const int resultsWindowSeconds = 90;

  /// Combined session ceiling (`990s` = 16:30).
  static const int totalSessionSeconds = 990;

  /// Computes remaining whole seconds before [deadlineUtcMs], clamped at zero.
  static int remainingSeconds({
    required int deadlineUtcMs,
    required Clock clock,
  }) {
    final diffMs = deadlineUtcMs - clock.now().toUtc().millisecondsSinceEpoch;
    if (diffMs <= 0) return 0;
    return (diffMs / 1000).ceil();
  }

  /// Computes the bounded stage deadline (`min(now + stageCapSeconds, globalCollectionDeadlineUtcMs)`).
  static int computeBoundedStageDeadlineUtcMs({
    required int stageCapSeconds,
    required int globalCollectionDeadlineUtcMs,
    required DiagnosticMode mode,
    required Clock clock,
  }) {
    final nowMs = clock.now().toUtc().millisecondsSinceEpoch;
    if (mode == DiagnosticMode.extended) {
      return nowMs + (stageCapSeconds * 3 * 1000);
    }
    final stageEnd = nowMs + (stageCapSeconds * 1000);
    return stageEnd < globalCollectionDeadlineUtcMs
        ? stageEnd
        : globalCollectionDeadlineUtcMs;
  }
}
