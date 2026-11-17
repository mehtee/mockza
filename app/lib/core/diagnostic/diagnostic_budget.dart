import 'package:clock/clock.dart';
import 'package:mockza/core/diagnostic/diagnostic_models.dart';

/// Standard 10-minute rapid starting-level budget constants (Sec. 2).
abstract final class DiagnosticBudget {
  /// Intro & device-check allocation (`45s`).
  static const int introMaxSeconds = 45;

  /// Reading stage allocation (`120s`).
  static const int readingMaxSeconds = 120;

  /// Listening stage allocation (`120s`).
  static const int listeningMaxSeconds = 120;

  /// Writing stage allocation (`135s`).
  static const int writingMaxSeconds = 135;

  /// Speaking stage allocation (`105s`).
  static const int speakingMaxSeconds = 105;

  /// Three inter-stage transition caps (`5s` each).
  static const int transitionMaxSeconds = 5;

  /// Total standard response-collection budget (`540s` = 9:00).
  static const int collectionTotalSeconds = 540;

  /// Post-collection results/status window (`60s` = 1:00).
  static const int resultsWindowSeconds = 60;

  /// Combined 10-minute session ceiling (`600s` = 10:00).
  static const int totalSessionSeconds = 600;

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
