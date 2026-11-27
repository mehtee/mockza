import 'package:meta/meta.dart';

/// Supported exam tracks and test types.
enum ExamTrack {
  /// IELTS Academic exam (default).
  ieltsAcademic(
    id: 'ielts_academic',
    displayName: 'IELTS Academic',
    shortName: 'IELTS Academic',
    scaleLabel: 'Estimated Band',
    unitLabel: 'Band',
    catalogTrack: 'academic',
    minScore: 0,
    maxScore: 9,
    scoreStep: 0.5,
    targetScoreDefault: 7.5,
  ),

  /// IELTS General Training exam.
  ieltsGeneral(
    id: 'ielts_general',
    displayName: 'IELTS General Training',
    shortName: 'IELTS General',
    scaleLabel: 'Estimated Band',
    unitLabel: 'Band',
    catalogTrack: 'general',
    minScore: 0,
    maxScore: 9,
    scoreStep: 0.5,
    targetScoreDefault: 7,
  ),

  /// TOEFL iBT (2026 1.0–6.0 Band Scale).
  toeflIbt(
    id: 'toefl_ibt',
    displayName: 'TOEFL iBT',
    shortName: 'TOEFL iBT',
    scaleLabel: 'Estimated Band',
    unitLabel: 'Band',
    catalogTrack: 'toefl',
    minScore: 1,
    maxScore: 6,
    scoreStep: 0.5,
    targetScoreDefault: 5,
  ),

  /// Pearson Test of English Academic (10–90 GSE Scale).
  pteAcademic(
    id: 'pte_academic',
    displayName: 'PTE Academic',
    shortName: 'PTE Academic',
    scaleLabel: 'Estimated Score',
    unitLabel: 'Score',
    catalogTrack: 'pte',
    minScore: 10,
    maxScore: 90,
    scoreStep: 1,
    targetScoreDefault: 65,
  ),

  /// Duolingo English Test (10–160 Scale in 5-point increments).
  det(
    id: 'det',
    displayName: 'Duolingo English Test',
    shortName: 'Duolingo (DET)',
    scaleLabel: 'Estimated Score',
    unitLabel: 'Score',
    catalogTrack: 'det',
    minScore: 10,
    maxScore: 160,
    scoreStep: 5,
    targetScoreDefault: 125,
  );

  new({
    required this.id,
    required this.displayName,
    required this.shortName,
    required this.scaleLabel,
    required this.unitLabel,
    required this.catalogTrack,
    required this.minScore,
    required this.maxScore,
    required this.scoreStep,
    required this.targetScoreDefault,
  });

  /// Unique machine-readable identifier.
  final String id;

  /// User-facing display title.
  final String displayName;

  /// Compact badge label.
  final String shortName;

  /// Scale metric label (e.g. "Estimated Band" or "Estimated Score").
  final String scaleLabel;

  /// Score unit noun ("Band" or "Score").
  final String unitLabel;

  /// Backend catalog `track` filter value.
  final String catalogTrack;

  /// Minimum score floor.
  final double minScore;

  /// Maximum score ceiling.
  final double maxScore;

  /// Official scoring increment (`0.5`, `1`, or `5`).
  final double scoreStep;

  /// Default learner target score.
  final double targetScoreDefault;

  /// Whether this track uses the IELTS Academic or General scale.
  bool get isIelts => this == ieltsAcademic || this == ieltsGeneral;

  /// Whether scores display as whole integers rather than `.5` bands.
  bool get usesIntegerDisplay => scoreStep >= 1.0;

  /// Resolves the target score when switching from [previous] to `this` track.
  ///
  /// Preserves the learner's target only when both tracks share the IELTS 0–9
  /// band scale; otherwise resets to [targetScoreDefault].
  double nextTargetWhenSwitchingFrom(
    ExamTrack previous,
    double previousTarget,
  ) {
    if (previous.isIelts && isIelts) {
      return quantizeScore(previousTarget.clamp(minScore, maxScore));
    }
    return targetScoreDefault;
  }

  /// Quantizes a raw score to `[minScore, maxScore]` at `scoreStep` increments.
  double quantizeScore(double raw) {
    if (!raw.isFinite) return minScore;
    final clamped = raw.clamp(minScore, maxScore);
    final steps = ((clamped - minScore) / scoreStep).round();
    final snapped = (minScore + (steps * scoreStep)).clamp(minScore, maxScore);
    if (usesIntegerDisplay) {
      return snapped.roundToDouble();
    }
    return double.parse(snapped.toStringAsFixed(1));
  }

  /// Formats [score] according to this track's decimal granularity.
  String formatScore(double score) {
    final normalized = quantizeScore(score);
    return usesIntegerDisplay
        ? normalized.round().toString()
        : normalized.toStringAsFixed(1);
  }

  /// Formats [score] prefixed with this track's unit (e.g., `Band 5.0`, `Score 68`).
  String formatScoreWithUnit(double score) =>
      '$unitLabel ${formatScore(score)}';

  /// Normalizes [score] to `[0.0, 1.0]` within this track's range.
  double normalizeScoreRatio(double score) {
    final span = maxScore - minScore;
    if (span <= 0 || !score.isFinite) return 0;
    return ((score - minScore) / span).clamp(0.0, 1.0);
  }

  /// Maps a normalized quality ratio `[0.0, 1.0]` into a quantized score on this track.
  double scoreFromRatio(double ratio) {
    final r = ratio.clamp(0.0, 1.0);
    return quantizeScore(minScore + (r * (maxScore - minScore)));
  }

  /// Resolves [ExamTrack] by canonical ID or common alias.
  static ExamTrack fromId(String id) {
    final normalized = id.trim().toLowerCase();
    for (final track in values) {
      if (track.id == normalized) return track;
    }
    if (normalized == 'general' || normalized == 'ielts-general') {
      return ieltsGeneral;
    }
    if (normalized == 'toefl' || normalized == 'toefl-ibt') {
      return toeflIbt;
    }
    if (normalized == 'pte' || normalized == 'pte-academic') {
      return pteAcademic;
    }
    if (normalized == 'duolingo' || normalized == 'duolingo_english_test') {
      return det;
    }
    return ieltsAcademic;
  }

  /// Resolves effective [ExamTrack] from an explicit [packId] prefix when present,
  /// otherwise falling back to [profileExamId].
  static ExamTrack resolveForPackOrProfile({
    required String packId,
    required String profileExamId,
  }) {
    final lower = packId.trim().toLowerCase();
    if (lower.startsWith('toefl')) return toeflIbt;
    if (lower.startsWith('pte')) return pteAcademic;
    if (lower.startsWith('det')) return det;
    if (lower.contains('-gt-')) return ieltsGeneral;
    if (lower.contains('-acad-')) return ieltsAcademic;
    if (lower.startsWith('ielts-')) {
      final profileTrack = fromId(profileExamId);
      return profileTrack.isIelts ? profileTrack : ieltsAcademic;
    }
    return fromId(profileExamId);
  }
}

/// Question types supported in objective Reading and Listening tests across all tracks.
enum ObjectiveQuestionType {
  /// True / False / Not Given.
  tfng,

  /// Yes / No / Not Given.
  ynng,

  /// Multiple choice question (single answer).
  mcqSingle,

  /// Multiple choice question (multi-select).
  mcqMulti,

  /// Matching paragraph headings.
  matchingHeadings,

  /// Summary or sentence completion gap fill.
  summaryGapFill,

  /// Short answer question.
  shortAnswer,

  /// Binary vocabulary/item choice (e.g., DET Read & Select Real vs Not Real).
  binaryChoice,

  /// Stem/letter completion in context (TOEFL Complete the Words, DET Read & Complete).
  wordCompletion,

  /// Paragraph or sentence sequencing (PTE Re-order Paragraphs).
  reorderSequence,

  /// Listen & Type / Write from Dictation transcription item.
  dictation;

  /// Parses backend wire questionType into canonical [ObjectiveQuestionType].
  static ObjectiveQuestionType fromWire(String raw) {
    return switch (raw.trim().toLowerCase()) {
      'tfng' || 'true_false_not_given' => ObjectiveQuestionType.tfng,
      'ynng' || 'yes_no_not_given' => ObjectiveQuestionType.ynng,
      'mcq_single' ||
      'mcqsingle' ||
      'mcq' ||
      'multiple_choice' => ObjectiveQuestionType.mcqSingle,
      'mcq_multi' ||
      'mcqmulti' ||
      'multiple_choice_multi' => ObjectiveQuestionType.mcqMulti,
      'matching_headings' ||
      'matchingheadings' ||
      'matching' => ObjectiveQuestionType.matchingHeadings,
      'summary_gap_fill' ||
      'summarygapfill' ||
      'gap_fill' ||
      'form_completion' ||
      'sentence_completion' => ObjectiveQuestionType.summaryGapFill,
      'binary_choice' => ObjectiveQuestionType.binaryChoice,
      'word_completion' => ObjectiveQuestionType.wordCompletion,
      'reorder_sequence' => ObjectiveQuestionType.reorderSequence,
      'dictation' => ObjectiveQuestionType.dictation,
      _ => ObjectiveQuestionType.shortAnswer,
    };
  }
}

/// Evidence span reference anchoring an objective question to a passage excerpt.
@immutable
class EvidenceSpanSpec {
  /// Creates an [EvidenceSpanSpec].
  const new({
    required this.paragraphIndex,
    required this.startOffset,
    required this.endOffset,
    required this.exactQuote,
    this.notGivenOmissionReason,
  });

  /// 1-based paragraph index where evidence appears.
  final int paragraphIndex;

  /// UTF-16 character start offset in passage.
  final int startOffset;

  /// UTF-16 character end offset in passage.
  final int endOffset;

  /// Verbatim quote excerpt from passage.
  final String exactQuote;

  /// Explanatory note if answer is NOT GIVEN.
  final String? notGivenOmissionReason;
}

/// Objective question definition inside a Reading or Listening pack.
@immutable
class QuestionSpec {
  /// Creates a [QuestionSpec].
  const new({
    required this.questionId,
    required this.number,
    required this.prompt,
    required this.questionType,
    required this.acceptedVariants,
    this.options = const <String>[],
    this.maxWords = 3,
    this.evidenceSpan,
    this.distractorExplanation,
    this.cueTimestampMs,
    this.sectionId,
  });

  /// Unique question identifier.
  final String questionId;

  /// Question sequence number (1..40).
  final int number;

  /// Question prompt or incomplete sentence.
  final String prompt;

  /// Question format type.
  final ObjectiveQuestionType questionType;

  /// Accepted correct answer variants.
  final List<String> acceptedVariants;

  /// Available choices for MCQ or matching.
  final List<String> options;

  /// Maximum permitted word count in short answers / gap fills.
  final int maxWords;

  /// Associated passage evidence span.
  final EvidenceSpanSpec? evidenceSpan;

  /// Educational rationale explaining why distractors are wrong.
  final String? distractorExplanation;

  /// Authored timestamp of supporting audio, in milliseconds.
  final int? cueTimestampMs;

  /// Source section identifier in the published bundle.
  final String? sectionId;
}

/// Single passage inside a Reading pack (~750–900 words parsed into paragraphs).
@immutable
class ReadingPassageSpec {
  /// Creates a [ReadingPassageSpec].
  const new({
    required this.passageIndex,
    required this.title,
    required this.paragraphs,
    required this.questions,
  });

  /// Passage index (1, 2, or 3).
  final int passageIndex;

  /// Passage title.
  final String title;

  /// List of paragraph strings.
  final List<String> paragraphs;

  /// Questions belonging to this passage.
  final List<QuestionSpec> questions;

  /// Concatenated full passage text with double-newline paragraph separation.
  String get fullText => paragraphs.join('\n\n');
}

/// Complete Reading test pack specification.
@immutable
class ReadingPackSpec {
  /// Creates a [ReadingPackSpec].
  const new({
    required this.packId,
    required this.title,
    required this.passages,
    this.contentVersion,
    this.durationSeconds = 60 * 60,
  });

  /// Unique pack identifier.
  final String packId;

  /// Pack display title.
  final String title;

  /// Version of the bundle used for the attempt.
  final String? contentVersion;

  /// 3 reading passages.
  final List<ReadingPassageSpec> passages;

  /// Test time allowance in seconds (default 3600s / 60m).
  final int durationSeconds;

  /// Total question count across all passages.
  int get totalQuestions =>
      passages.fold(0, (sum, p) => sum + p.questions.length);
}

/// Single section inside a Listening pack.
@immutable
class ListeningSectionSpec {
  /// Creates a [ListeningSectionSpec].
  const new({
    required this.sectionIndex,
    required this.title,
    required this.accent,
    required this.preAudioReadingSeconds,
    required this.questions,
    this.transcriptText = '',
  });

  /// Section index (1, 2, 3, or 4).
  final int sectionIndex;

  /// Section topic title.
  final String title;

  /// Speaker accent metadata (`UK`, `AU`, `US`, `NZ`).
  final String accent;

  /// Countdown seconds allotted for reading questions before audio begins.
  final int preAudioReadingSeconds;

  /// Questions for this section.
  final List<QuestionSpec> questions;

  /// Script dialogue transcript for Study Mode.
  final String transcriptText;
}

/// Complete Listening test pack specification.
@immutable
class ListeningPackSpec {
  /// Creates a [ListeningPackSpec].
  const new({
    required this.packId,
    required this.title,
    required this.audioRelativePath,
    required this.sha256,
    required this.sections,
    this.contentVersion,
    this.durationSeconds = 30 * 60,
  });

  /// Unique pack identifier.
  final String packId;

  /// Pack display title.
  final String title;

  /// Version of the bundle used for the attempt.
  final String? contentVersion;

  /// Relative path to packaged `.m4a` audio file.
  final String audioRelativePath;

  /// Pinned SHA-256 hex digest for integrity verification.
  final String sha256;

  /// 4 listening sections.
  final List<ListeningSectionSpec> sections;

  /// Total duration in seconds.
  final int durationSeconds;

  /// Total questions across all sections.
  int get totalQuestions =>
      sections.fold(0, (sum, s) => sum + s.questions.length);
}

/// Writing prompt specification (Task 1 chart/diagram or Task 2 essay).
@immutable
class WritingTaskSpec {
  /// Creates a [WritingTaskSpec].
  const new({
    required this.taskId,
    required this.taskType,
    required this.title,
    required this.promptBody,
    required this.minWords,
    required this.recommendedSeconds,
    this.chartSvg,
    this.chartCaption,
  });

  /// Unique task identifier.
  final String taskId;

  /// Writing task category (`task1Academic`, `task1General`, `task2Essay`).
  final String taskType;

  /// Prompt headline title.
  final String title;

  /// Full rubric prompt instructions.
  final String promptBody;

  /// Minimum word limit (150 for Task 1, 250 for Task 2).
  final int minWords;

  /// Recommended time allowance in seconds (1200s for Task 1, 2400s for Task 2).
  final int recommendedSeconds;

  /// Interactive SVG string for Task 1 Academic charts/diagrams.
  final String? chartSvg;

  /// Explanatory chart caption.
  final String? chartCaption;
}

/// Speaking prompt turn item.
@immutable
class SpeakingPromptSpec {
  /// Creates a [SpeakingPromptSpec].
  const new({
    required this.promptId,
    required this.partIndex,
    required this.promptText,
    this.bulletPoints = const <String>[],
    this.prepSeconds = 0,
    this.speakSeconds = 60,
    this.chartSvg,
  });

  /// Unique turn identifier.
  final String promptId;

  /// Speaking part index (1, 2, or 3).
  final int partIndex;

  /// Examiner question or cue card prompt.
  final String promptText;

  /// Cue card bullet points (Part 2).
  final List<String> bulletPoints;

  /// Preparation time in seconds (60s for Part 2).
  final int prepSeconds;

  /// Speaking recording window in seconds (120s for Part 2).
  final int speakSeconds;

  /// Optional chart/diagram SVG string or media URL for visual prompts.
  final String? chartSvg;
}

/// Complete Speaking session specification.
@immutable
class SpeakingSessionSpec {
  /// Creates a [SpeakingSessionSpec].
  const new({
    required this.sessionId,
    required this.title,
    required this.prompts,
  });

  /// Unique session identifier.
  final String sessionId;

  /// Session title.
  final String title;

  /// Ordered prompts across Parts 1, 2, and 3.
  final List<SpeakingPromptSpec> prompts;
}

/// Single exercise item inside a micro-drill.
@immutable
class MicroDrillItemSpec {
  /// Creates a [MicroDrillItemSpec].
  const new({
    required this.itemId,
    required this.prompt,
    required this.acceptedAnswers,
    required this.explanation,
    this.options = const <String>[],
  });

  /// Unique exercise identifier.
  final String itemId;

  /// Exercise prompt or sentence to complete/rewrite.
  final String prompt;

  /// Accepted correct variants.
  final List<String> acceptedAnswers;

  /// Immediate educational explanation.
  final String explanation;

  /// Optional choices.
  final List<String> options;
}

/// 3-minute focused micro-drill specification targeting a specific weakness.
@immutable
class MicroDrillSpec {
  /// Creates a [MicroDrillSpec].
  const new({
    required this.drillId,
    required this.weaknessCode,
    required this.title,
    required this.subtitle,
    required this.items,
    this.durationSeconds = 180,
  });

  /// Unique drill identifier.
  final String drillId;

  /// Targeted criterion weakness code (e.g. `CC`, `LR`, `FC`, `GRA`).
  final String weaknessCode;

  /// Drill title.
  final String title;

  /// Drill description.
  final String subtitle;

  /// 5 quick-fire exercise items.
  final List<MicroDrillItemSpec> items;

  /// Time limit in seconds (default 180s / 3m).
  final int durationSeconds;

  /// Human-readable drill category label avoiding raw snake_case identifiers (`UX-17`).
  String get displayCategoryLabel =>
      switch (weaknessCode.trim().toLowerCase()) {
        'speed_tfng' => 'True / False / Not Given',
        'speed_ynng' => 'Yes / No / Not Given',
        'summary_gap_fill' || 'gap_fill' => 'Summary Completion',
        'complex_grammar' => 'Complex Grammar',
        'pronunciation_rhythm' => 'Pronunciation & Rhythm',
        'coherence_linking' => 'Coherence & Linking',
        'lexical_precision' => 'Lexical Precision',
        _ =>
          weaknessCode
              .split('_')
              .where((part) => part.isNotEmpty)
              .map(
                (part) => part.length <= 3
                    ? part.toUpperCase()
                    : '${part[0].toUpperCase()}${part.substring(1)}',
              )
              .join(' '),
      };

  /// Question prompt header tailored to question format instead of hardcoded "Complete the Sentence" (`UX-17`).
  String get itemHeaderTitle {
    final normalized = weaknessCode.trim().toLowerCase();
    if (normalized.contains('tfng')) return 'True / False / Not Given';
    if (normalized.contains('ynng')) return 'Yes / No / Not Given';
    if (normalized.contains('gap') || normalized.contains('summary')) {
      return 'Complete the Summary';
    }
    return 'Choose the Best Answer';
  }
}

/// Official IELTS timing, question count, and band rounding rules.
abstract final class ExamSpec {
  /// Minimum IELTS band score.
  static const double minBand = 0;

  /// Maximum IELTS band score.
  static const double maxBand = 9;

  /// Reading section question count in full mock mode.
  static const int readingQuestionCount = 40;

  /// Reading time allowance in seconds (60 minutes).
  static const int readingDurationSeconds = 60 * 60;

  /// Listening section question count in full mock mode.
  static const int listeningQuestionCount = 40;

  /// Writing Task 1 recommended duration in seconds (20 minutes).
  static const int writingTask1DurationSeconds = 20 * 60;

  /// Writing Task 2 recommended duration in seconds (40 minutes).
  static const int writingTask2DurationSeconds = 40 * 60;

  /// Speaking Part 2 preparation duration in seconds (1 minute).
  static const int speakingCuePrepSeconds = 60;

  /// Speaking Part 2 monologue maximum duration in seconds (2 minutes).
  static const int speakingCueTurnSeconds = 120;

  /// Rounds a raw IELTS mean score to the nearest half band (`.25` -> `.5`, `.75` -> next whole).
  static double roundIeltsBand(double rawMean) {
    final clamped = rawMean.clamp(minBand, maxBand);
    final whole = clamped.floor();
    final frac = clamped - whole;
    if (frac < 0.25) {
      return whole.toDouble();
    } else if (frac < 0.75) {
      return whole + 0.5;
    } else {
      return (whole + 1.0).clamp(minBand, maxBand);
    }
  }

  /// Computes overall IELTS Writing band weighting Task 2 twice as much as Task 1:
  /// `(task1 + 2 * task2) / 3`, rounded to the nearest half band.
  static double calculateWritingOverallBand({
    required double task1Band,
    required double task2Band,
  }) {
    final weighted = (task1Band + (2 * task2Band)) / 3.0;
    return roundIeltsBand(weighted);
  }

  static const List<(double, int)> _toeflLegacyAnchors = <(double, int)>[
    (1.0, 5),
    (1.5, 14),
    (2.0, 25),
    (2.5, 38),
    (3.0, 51),
    (3.5, 64),
    (4.0, 78),
    (4.5, 90),
    (5.0, 100),
    (5.5, 110),
    (6.0, 117),
  ];

  /// Concordance mapping from 2026 TOEFL iBT 1.0–6.0 band to comparable 0–120 score.
  static int estimateToeflLegacy120(double band) {
    final clamped = band.isFinite ? band.clamp(1.0, 6.0) : 1.0;
    for (var i = 0; i < _toeflLegacyAnchors.length - 1; i++) {
      final (b0, s0) = _toeflLegacyAnchors[i];
      final (b1, s1) = _toeflLegacyAnchors[i + 1];
      if (clamped >= b0 && clamped <= b1) {
        final t = (clamped - b0) / (b1 - b0);
        return (s0 + t * (s1 - s0)).round();
      }
    }
    return 117;
  }
}

/// Parses an MCQ or Matching Headings option string (e.g. `"ii. Heading"`, `"B. Text"`, or plain text)
/// into its pill label, clean display text, and canonical submitted value (`BF-01`).
({String label, String displayText, String value}) parseObjectiveChoiceOption(
  ObjectiveQuestionType questionType,
  String rawOption,
  int index,
  List<String> acceptedVariants,
) {
  final trimmed = rawOption.trim();
  const romanNumerals = <String>[
    'i',
    'ii',
    'iii',
    'iv',
    'v',
    'vi',
    'vii',
    'viii',
    'ix',
    'x',
    'xi',
    'xii',
  ];

  if (questionType == ObjectiveQuestionType.matchingHeadings) {
    final romanMatch = RegExp(
      r'^(i{1,3}|iv|vi{0,3}|ix|x|xi|xii)[.)]\s+(.+)$',
      caseSensitive: false,
    ).firstMatch(trimmed);
    if (romanMatch != null) {
      final roman = romanMatch.group(1)!.toLowerCase();
      final body = romanMatch.group(2)!.trim();
      return (label: roman, displayText: body, value: roman);
    }
    final fallbackRoman = index < romanNumerals.length
        ? romanNumerals[index]
        : '${index + 1}';
    return (label: fallbackRoman, displayText: trimmed, value: fallbackRoman);
  }

  final letterMatch = RegExp(
    r'^([A-Za-z])[.)]\s+(.+)$',
  ).firstMatch(trimmed);
  if (letterMatch != null) {
    final letter = letterMatch.group(1)!.toUpperCase();
    final body = letterMatch.group(2)!.trim();
    return (label: letter, displayText: body, value: letter);
  }

  final fallbackLetter = String.fromCharCode(65 + index);
  final expectsSingleLetter = acceptedVariants.any(
    (v) => v.trim().length == 1 && RegExp(r'^[A-Za-z]$').hasMatch(v.trim()),
  );
  return (
    label: fallbackLetter,
    displayText: trimmed,
    value: expectsSingleLetter ? fallbackLetter : trimmed,
  );
}
