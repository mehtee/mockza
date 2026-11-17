/// Pure-Dart progress contract for any indexed exam or diagnostic question (`ISP` / `DIP`).
abstract interface class QuestionProgressItem {
  /// 1-based display question number.
  int get number;

  /// Whether the learner has provided a non-empty answer for this question.
  bool get isAnswered;
}

/// Immutable default implementation of [QuestionProgressItem].
final class QuestionProgressSnapshot implements QuestionProgressItem {
  /// Creates a [QuestionProgressSnapshot].
  const new({
    required this.number,
    required this.isAnswered,
  });

  @override
  final int number;

  @override
  final bool isAnswered;
}
