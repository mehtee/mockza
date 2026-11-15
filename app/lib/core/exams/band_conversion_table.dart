import 'package:mockza/core/models/attempt_status.dart';

/// Deterministic raw-score (0..40) to IELTS Band mapping for Reading & Listening.
abstract final class BandConversionTable {
  /// Converts [correctCount] out of 40 into a Listening band score.
  static double listeningBandFor(int correctCount) {
    if (correctCount >= 39) return 9;
    if (correctCount >= 37) return 8.5;
    if (correctCount >= 35) return 8;
    if (correctCount >= 32) return 7.5;
    if (correctCount >= 30) return 7;
    if (correctCount >= 26) return 6.5;
    if (correctCount >= 23) return 6;
    if (correctCount >= 18) return 5.5;
    if (correctCount >= 16) return 5;
    if (correctCount >= 13) return 4.5;
    if (correctCount >= 10) return 4;
    if (correctCount >= 6) return 3.5;
    if (correctCount >= 4) return 3;
    return correctCount >= 1 ? 2.5 : 0;
  }

  /// Converts [correctCount] out of 40 into a Reading band for [moduleType].
  static double readingBandFor(
    int correctCount, {
    required ExamModuleType moduleType,
  }) {
    if (moduleType == ExamModuleType.generalTraining) {
      if (correctCount >= 40) return 9;
      if (correctCount >= 39) return 8.5;
      if (correctCount >= 37) return 8;
      if (correctCount >= 36) return 7.5;
      if (correctCount >= 34) return 7;
      if (correctCount >= 32) return 6.5;
      if (correctCount >= 30) return 6;
      if (correctCount >= 27) return 5.5;
      if (correctCount >= 23) return 5;
      if (correctCount >= 19) return 4.5;
      if (correctCount >= 15) return 4;
      if (correctCount >= 12) return 3.5;
      if (correctCount >= 9) return 3;
      return correctCount >= 1 ? 2.5 : 0;
    }

    if (correctCount >= 39) return 9;
    if (correctCount >= 37) return 8.5;
    if (correctCount >= 35) return 8;
    if (correctCount >= 33) return 7.5;
    if (correctCount >= 30) return 7;
    if (correctCount >= 27) return 6.5;
    if (correctCount >= 23) return 6;
    if (correctCount >= 19) return 5.5;
    if (correctCount >= 15) return 5;
    if (correctCount >= 13) return 4.5;
    if (correctCount >= 10) return 4;
    if (correctCount >= 8) return 3.5;
    if (correctCount >= 6) return 3;
    return correctCount >= 1 ? 2.5 : 0;
  }
}
