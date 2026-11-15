import 'package:meta/meta.dart';
import 'package:mockza/core/models/evaluation_models.dart';
import 'package:mockza/core/models/speaking_evaluation.dart';

/// Official IELTS Writing prompt categories.
enum WritingTaskType {
  /// Academic Writing Task 1 (chart, table, map, process).
  task1Academic,

  /// General Training Writing Task 1 (formal/semi-formal/informal letter).
  task1General,

  /// Writing Task 2 (academic/general essay).
  task2Essay,
}

/// Domain model for an AI-evaluated Writing attempt.
@immutable
class WritingEvaluationResult {
  /// Creates a [WritingEvaluationResult].
  const new({
    required this.attemptId,
    required this.taskType,
    required this.overallBand,
    required this.criteria,
    required this.wordCount,
    required this.upgradedExcerpt,
    required this.actionableNextStep,
    required this.modelId,
    required this.rubricVersion,
    this.inlineEdits = const <EssayInlineEdit>[],
    this.modelRewrite,
    this.vocabUpgrades = const <VocabUpgrade>[],
    this.recommendedDrill,
    this.isEstimated = true,
  });

  /// Attempt primary identifier.
  final String attemptId;

  /// Prompt type used for rubric weighting.
  final WritingTaskType taskType;

  /// Rounded IELTS Writing band (`0.0..9.0` step `0.5`).
  final double overallBand;

  /// Four official IELTS Writing criteria (`TA`/`TR`, `CC`, `LR`, `GRA`).
  final List<CriterionScore> criteria;

  /// Exact learner word count detected before scoring.
  final int wordCount;

  /// High-band rewrite demonstration grounded in the learner's own argument.
  final String upgradedExcerpt;

  /// Prioritized focus item for the next essay.
  final String actionableNextStep;

  /// LLM identifier used during scoring.
  final String modelId;

  /// Pinned rubric identifier.
  final String rubricVersion;

  /// Granular inline edits identifying weaknesses and suggestions in student text.
  final List<EssayInlineEdit> inlineEdits;

  /// Optional full-length model rewrite demonstrating band 8.5+ quality.
  final String? modelRewrite;

  /// High-value academic vocabulary upgrades extracted from the essay.
  final List<VocabUpgrade> vocabUpgrades;

  /// Recommended micro-drill to practice specific weakness detected.
  final RecommendedDrill? recommendedDrill;

  /// Whether this score is an AI estimate rather than an official certified exam result.
  final bool isEstimated;
}
