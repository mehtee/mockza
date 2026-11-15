import 'package:meta/meta.dart';

/// Type of speech hesitation or grammar annotation in transcripts.
enum SpeechAnnotationKind {
  /// Unnatural or prolonged silence/pause.
  pause,

  /// Filler words (e.g. um, uh, like).
  filler,

  /// Grammatical inaccuracy.
  grammar,

  /// Unnatural phrasing or awkward collocation.
  phrasing,
}

/// Single speech annotation token within a spoken transcript segment.
@immutable
class SpokenAnnotation {
  /// Creates a [SpokenAnnotation].
  const new({
    required this.kind,
    required this.startOffset,
    required this.endOffset,
    required this.originalText,
    required this.suggestion,
    required this.rationale,
  });

  /// The annotation category.
  final SpeechAnnotationKind kind;

  /// Start UTF-16 character index in the parent segment text.
  final int startOffset;

  /// End UTF-16 character index in the parent segment text.
  final int endOffset;

  /// Highlighted phrase verbatim.
  final String originalText;

  /// Suggested correction or natural upgrade.
  final String suggestion;

  /// Diagnostic rationale explaining the issue.
  final String rationale;
}

/// A timed segment of spoken dialogue or monologue in an exam response.
@immutable
class SpokenTranscriptSegment {
  /// Creates a [SpokenTranscriptSegment].
  const new({
    required this.segmentId,
    required this.speaker,
    required this.text,
    required this.startSec,
    required this.endSec,
    this.annotations = const <SpokenAnnotation>[],
  });

  /// Unique segment identifier.
  final String segmentId;

  /// Speaker label (e.g. 'Learner', 'Examiner').
  final String speaker;

  /// Full segment transcript text.
  final String text;

  /// Start timestamp in seconds from audio onset.
  final double startSec;

  /// End timestamp in seconds from audio onset.
  final double endSec;

  /// Fine-grained speech annotations within this segment.
  final List<SpokenAnnotation> annotations;
}

/// Single inline edit annotation in written essays.
@immutable
class EssayInlineEdit {
  /// Creates an [EssayInlineEdit].
  const new({
    required this.editId,
    required this.startOffset,
    required this.endOffset,
    required this.originalText,
    required this.suggestedText,
    required this.criterionCode,
    required this.rationale,
  });

  /// Unique edit identifier.
  final String editId;

  /// Start UTF-16 character offset in essay text.
  final int startOffset;

  /// End UTF-16 character offset in essay text.
  final int endOffset;

  /// Original student text.
  final String originalText;

  /// High-band suggested replacement.
  final String suggestedText;

  /// IELTS criterion code (`TA`, `TR`, `CC`, `LR`, `GRA`).
  final String criterionCode;

  /// Educational rationale for this upgrade.
  final String rationale;
}

/// Vocabulary upgrade suggestion from an essay or transcript.
@immutable
class VocabUpgrade {
  /// Creates a [VocabUpgrade].
  const new({
    required this.original,
    required this.upgraded,
    required this.definition,
    required this.collocation,
  });

  /// Student's original basic word or phrase.
  final String original;

  /// Band 8+ academic collocation or lexical upgrade.
  final String upgraded;

  /// Concise academic definition.
  final String definition;

  /// High-frequency IELTS collocation example.
  final String collocation;
}

/// Targeted micro-drill recommendation derived from evaluation weaknesses.
@immutable
class RecommendedDrill {
  /// Creates a [RecommendedDrill].
  const new({
    required this.drillId,
    required this.weaknessCode,
    required this.title,
    required this.durationMinutes,
  });

  /// Micro-drill catalog identifier.
  final String drillId;

  /// Diagnostic error tag (e.g. 'LR_COL_ADV', 'CC_LINK_OVER').
  final String weaknessCode;

  /// Short descriptive drill title.
  final String title;

  /// Estimated drill completion time in minutes.
  final int durationMinutes;
}
