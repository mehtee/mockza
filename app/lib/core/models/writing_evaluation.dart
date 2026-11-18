import 'package:meta/meta.dart';
import 'package:mockza/core/models/evaluation_models.dart';
import 'package:mockza/core/models/speaking_evaluation.dart';

/// Official Writing prompt categories across IELTS, TOEFL iBT 2026, PTE, and DET.
enum WritingTaskType {
  /// Academic Writing Task 1 (chart, table, map, process).
  task1Academic,

  /// General Training Writing Task 1 (formal/semi-formal/informal letter).
  task1General,

  /// Writing Task 2 (academic/general essay).
  task2Essay,

  /// TOEFL iBT 2026 Build a Sentence.
  toeflSentenceBuild,

  /// TOEFL iBT 2026 Write an Email.
  toeflEmail,

  /// TOEFL iBT 2026 Write for an Academic Discussion.
  toeflAcademicDiscussion,

  /// PTE Academic Summarize Written Text (single sentence, 5–75 words).
  pteSummarizeWrittenText,

  /// PTE Academic Write Essay (200–300 words).
  pteEssay,

  /// DET Write About the Photo (1m).
  detWriteAboutPhoto,

  /// DET Interactive Writing (5m + 3m follow-up).
  detInteractiveWriting,

  /// DET Writing Sample (5m).
  detWritingSample;

  /// Parses wire taskType string into [WritingTaskType].
  static WritingTaskType fromWire(String raw) {
    return switch (raw.trim()) {
      'task1Academic' || 'task1_academic' => task1Academic,
      'task1General' || 'task1_general' => task1General,
      'toeflSentenceBuild' || 'toefl_sentence_build' => toeflSentenceBuild,
      'toeflEmail' || 'toefl_email' => toeflEmail,
      'toeflAcademicDiscussion' ||
      'toefl_academic_discussion' => toeflAcademicDiscussion,
      'pteSummarizeWrittenText' ||
      'pte_summarize_written_text' => pteSummarizeWrittenText,
      'pteEssay' || 'pte_essay' => pteEssay,
      'detWriteAboutPhoto' || 'det_write_about_photo' => detWriteAboutPhoto,
      'detInteractiveWriting' ||
      'det_interactive_writing' => detInteractiveWriting,
      'detWritingSample' || 'det_writing_sample' => detWritingSample,
      _ => task2Essay,
    };
  }

  /// Concise segmented tab label (preserves `'Task 1'` / `'Task 2'` prefixes).
  String get shortTabLabel => switch (this) {
    task1Academic || task1General => 'Task 1',
    task2Essay => 'Task 2',
    toeflSentenceBuild => 'Task 1 · Build',
    toeflEmail => 'Task 2 · Email',
    toeflAcademicDiscussion => 'Task 3 · Discuss',
    pteSummarizeWrittenText => 'Task 1 · Summary',
    pteEssay => 'Task 2 · Essay',
    detWriteAboutPhoto => 'Task 1 · Photo',
    detInteractiveWriting => 'Task 2 · Interact',
    detWritingSample => 'Task 3 · Sample',
  };

  /// Full human-readable header title.
  String get fullTitle => switch (this) {
    task1Academic => 'Academic Writing Task 1 (Chart/Diagram)',
    task1General => 'General Training Writing Task 1 (Letter)',
    task2Essay => 'IELTS Writing Task 2 (Essay)',
    toeflSentenceBuild => 'TOEFL Task 1 (Build a Sentence)',
    toeflEmail => 'TOEFL Task 2 (Write an Email)',
    toeflAcademicDiscussion => 'TOEFL Task 3 (Academic Discussion)',
    pteSummarizeWrittenText => 'PTE Task 1 (Summarize Written Text)',
    pteEssay => 'PTE Task 2 (Write Essay)',
    detWriteAboutPhoto => 'DET Task 1 (Write About the Photo)',
    detInteractiveWriting => 'DET Task 2 (Interactive Writing)',
    detWritingSample => 'DET Task 3 (Writing Sample)',
  };

  /// Minimum recommended word count for live word counter & checks.
  int get defaultMinWords => switch (this) {
    task1Academic || task1General => 150,
    task2Essay => 250,
    toeflSentenceBuild => 15,
    toeflEmail => 85,
    toeflAcademicDiscussion => 100,
    pteSummarizeWrittenText => 5,
    pteEssay => 200,
    detWriteAboutPhoto => 25,
    detInteractiveWriting => 60,
    detWritingSample => 100,
  };

  /// Optional maximum recommended word ceiling (`null` if uncapped).
  int? get defaultMaxWords => switch (this) {
    pteSummarizeWrittenText => 75,
    pteEssay => 300,
    _ => null,
  };

  /// Default recommended timer duration in seconds.
  int get defaultDurationSeconds => switch (this) {
    task1Academic || task1General => 1200,
    task2Essay => 2400,
    toeflSentenceBuild => 360,
    toeflEmail => 420,
    toeflAcademicDiscussion => 600,
    pteSummarizeWrittenText => 600,
    pteEssay => 1200,
    detWriteAboutPhoto => 60,
    detInteractiveWriting => 480,
    detWritingSample => 300,
  };

  /// Whether task requires a single grammatically complete sentence.
  bool get requiresSingleSentence => this == pteSummarizeWrittenText;
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
