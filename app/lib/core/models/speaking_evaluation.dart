import 'package:meta/meta.dart';
import 'package:mockza/core/models/evaluation_models.dart';

/// Score breakdown for a single IELTS rubric criterion.
@immutable
class CriterionScore {
  /// Creates a [CriterionScore].
  const new({
    required this.criterionCode,
    required this.criterionLabel,
    required this.band,
    required this.evidenceExcerpt,
    required this.feedbackNote,
  });

  /// Short IELTS rubric code (`FC`, `LR`, `GRA`, `PR`, `TR`, `TA`, `CC`).
  final String criterionCode;

  /// Human-readable criterion title.
  final String criterionLabel;

  /// Band score from 0.0 to 9.0 in 0.5 increments.
  final double band;

  /// Verbatim quote from the learner's response or transcript.
  final String evidenceExcerpt;

  /// Specific diagnostic note grounded in the excerpt.
  final String feedbackNote;
}

/// Domain model for a completed AI Speaking evaluation.
@immutable
class SpeakingEvaluationResult {
  /// Creates a [SpeakingEvaluationResult].
  const new({
    required this.attemptId,
    required this.overallBand,
    required this.criteria,
    required this.transcript,
    required this.actionableNextStep,
    required this.modelId,
    required this.rubricVersion,
    this.transcriptSegments = const <SpokenTranscriptSegment>[],
    this.vocabUpgrades = const <VocabUpgrade>[],
    this.recommendedDrill,
    this.isEstimated = true,
  });

  /// Identifier linking back to the local attempt row.
  final String attemptId;

  /// Rounded IELTS Speaking band (`0.0..9.0` step `0.5`).
  final double overallBand;

  /// Four official IELTS Speaking criteria (`FC`, `LR`, `GRA`, `PR`).
  final List<CriterionScore> criteria;

  /// Verbatim transcript produced before scoring.
  final String transcript;

  /// Highest-leverage practice adjustment suggested for the next attempt.
  final String actionableNextStep;

  /// Model identifier recorded for AI evaluation provenance.
  final String modelId;

  /// Rubric version pinned at evaluation time.
  final String rubricVersion;

  /// Granular spoken segments with hesitation and grammar annotations.
  final List<SpokenTranscriptSegment> transcriptSegments;

  /// Academic vocabulary upgrades suggested for spoken responses.
  final List<VocabUpgrade> vocabUpgrades;

  /// Targeted micro-drill recommended to remedy diagnosed speaking weakness.
  final RecommendedDrill? recommendedDrill;

  /// Whether this score is an AI estimate rather than an official certified exam result.
  final bool isEstimated;
}
