import 'package:meta/meta.dart';

/// Ordered authoring tiers for adaptive diagnostic routing (`A1 -> C2`).
enum AuthoringTier {
  /// Elementary tier A1.
  a1('A1'),

  /// Pre-intermediate tier A2.
  a2('A2'),

  /// Intermediate tier B1 (default starting anchor).
  b1('B1'),

  /// Upper-intermediate tier B2.
  b2('B2'),

  /// Advanced tier C1.
  c1('C1'),

  /// Mastery tier C2.
  c2('C2');

  new(this.code);

  /// Wire code (`A1`..`C2`).
  final String code;

  /// Parses wire [code], defaulting to [AuthoringTier.b1] if unrecognized.
  static AuthoringTier fromCode(String code) {
    for (final t in values) {
      if (t.code == code) return t;
    }
    return b1;
  }
}

/// Objective block classification category.
enum RoutingCategory {
  /// 2/2 correct.
  strong('strong'),

  /// 1/2 correct.
  mixed('mixed'),

  /// 0/2 both attempted.
  low('low'),

  /// Skipped, "I don't know", playback/mic failure, or empty timeout.
  noEvidence('no_evidence');

  new(this.wire);

  /// Wire string identifier.
  final String wire;

  /// Parses wire value.
  static RoutingCategory fromWire(String value) {
    for (final c in values) {
      if (c.wire == value) return c;
    }
    return noEvidence;
  }
}

/// Non-proficiency reason for missing evidence on a block or stage.
enum NoEvidenceReason {
  /// Explicitly skipped by learner.
  skipped('skipped'),

  /// Learner selected "I don't know".
  dontKnow('dont_know'),

  /// Audio playback failed or stalled.
  playbackFailed('playback_failed'),

  /// Microphone permission denied or unavailable.
  micDenied('mic_denied'),

  /// Timer expired with incomplete answers.
  emptyTimeout('empty_timeout'),

  /// Audio clip was silent, noisy, or corrupt.
  unusableAudio('unusable_audio');

  new(this.wire);

  /// Wire identifier.
  final String wire;

  /// Parses optional wire string.
  static NoEvidenceReason? tryFromWire(String? value) {
    if (value == null) return null;
    for (final r in values) {
      if (r.wire == value) return r;
    }
    return null;
  }
}

/// Explicit stage termination reason (Sec. 5.2).
enum DiagnosticStopReason {
  /// Three valid blocks completed.
  samplingComplete('sampling_complete'),

  /// Stage deadline elapsed or next block cannot fit.
  stageTimeout('stage_timeout'),

  /// Global 540s collection deadline elapsed.
  globalTimeout('global_timeout'),

  /// Maximum presented blocks reached (`4` Reading, `3` Listening).
  presentationLimit('presentation_limit'),

  /// Eligible unused blocks exhausted.
  contentLimit('content_limit');

  new(this.wire);

  /// Wire identifier.
  final String wire;

  /// Parses optional wire string.
  static DiagnosticStopReason? tryFromWire(String? value) {
    if (value == null) return null;
    for (final r in values) {
      if (r.wire == value) return r;
    }
    return null;
  }
}

/// Diagnostic timing/accessibility mode.
enum DiagnosticMode {
  /// Default 15-minute bounded starting check.
  standard('standard'),

  /// Untimed/extended help mode (never combined with standard timing claims).
  extended('extended'),

  /// Accessibility accommodation mode (e.g. replay enabled).
  accessible('accessible');

  new(this.wire);

  /// Wire identifier.
  final String wire;

  /// Parses wire string.
  static DiagnosticMode fromWire(String value) {
    for (final m in values) {
      if (m.wire == value) return m;
    }
    return standard;
  }
}

/// Per-skill outcome status in diagnostic reporting (Sec. 6.1).
enum DiagnosticSkillStatus {
  /// Broad provisional practice suggestion available.
  provisional('provisional'),

  /// Asynchronous Writing/Speaking job still evaluating.
  pending('pending'),

  /// Sample too brief/missing to infer practice level.
  insufficientEvidence('insufficient_evidence'),

  /// Recording/input unusable (e.g. silent/corrupt mic audio).
  unscorable('unscorable'),

  /// Technical evaluation or quota failure.
  failed('failed'),

  /// Learner skipped this skill.
  skipped('skipped');

  new(this.wire);

  /// Wire identifier.
  final String wire;

  /// Parses wire string.
  static DiagnosticSkillStatus fromWire(String value) {
    for (final s in values) {
      if (s.wire == value) return s;
    }
    return insufficientEvidence;
  }
}

/// Objective comprehension item inside a diagnostic Reading or Listening block.
@immutable
class DiagnosticQuestionDef {
  /// Creates a [DiagnosticQuestionDef].
  const new({
    required this.questionId,
    required this.prompt,
    required this.options,
    required this.correctIndex,
    required this.focusTag,
  });

  /// Question identifier.
  final String questionId;

  /// Question prompt text.
  final String prompt;

  /// Exactly three concise answer choices.
  final List<String> options;

  /// Zero-based index of the keyed option (`0..2`).
  final int correctIndex;

  /// Construct focus tag (`explicit_detail`, `meaning_relationship`).
  final String focusTag;
}

/// Adaptive diagnostic block definition for Reading or Listening.
@immutable
class DiagnosticBlockDef {
  /// Creates a [DiagnosticBlockDef].
  const new({
    required this.blockId,
    required this.skill,
    required this.tier,
    required this.scenarioId,
    required this.title,
    required this.minRequiredSeconds,
    required this.questions,
    this.passageText,
    this.scriptText,
    this.mediaUrl,
    this.durationSeconds,
  });

  /// Unique block identifier.
  final String blockId;

  /// Skill (`reading` or `listening`).
  final String skill;

  /// Ordered authoring tier.
  final AuthoringTier tier;

  /// Everyday scenario family identifier.
  final String scenarioId;

  /// Short block title.
  final String title;

  /// Short Reading passage text.
  final String? passageText;

  /// Optional Listening script text (never shown during standard audio playback).
  final String? scriptText;

  /// Backend media proxy path (`/v1/media/...`).
  final String? mediaUrl;

  /// Listening clip duration in seconds.
  final int? durationSeconds;

  /// Minimum remaining seconds needed to administer this block fairly.
  final int minRequiredSeconds;

  /// Two three-option comprehension questions.
  final List<DiagnosticQuestionDef> questions;
}

/// Recorded exposure/outcome of one presented objective diagnostic block.
@immutable
class BlockAttemptRecord {
  /// Creates a [BlockAttemptRecord].
  const new({
    required this.blockId,
    required this.tier,
    required this.category,
    required this.selectedOptionIndices,
    required this.correctCount,
    this.noEvidenceReason,
    this.elapsedSeconds,
  });

  /// Block identifier.
  final String blockId;

  /// Authoring tier of [blockId].
  final AuthoringTier tier;

  /// Classified outcome category.
  final RoutingCategory category;

  /// Selected answer indices (`0..2` or `null` if unanswered).
  final List<int?> selectedOptionIndices;

  /// Number of correct answers (`0..2`).
  final int correctCount;

  /// Missing-evidence reason when [category] is [RoutingCategory.noEvidence].
  final NoEvidenceReason? noEvidenceReason;

  /// Elapsed seconds on this block.
  final int? elapsedSeconds;

  /// Serializes to wire JSON matching backend submission schema.
  Map<String, Object?> toJson() => <String, Object?>{
    'blockId': blockId,
    'tier': tier.code,
    'category': category.wire,
    'selectedOptionIndices': selectedOptionIndices,
    'correctCount': correctCount,
    if (noEvidenceReason != null) 'noEvidenceReason': noEvidenceReason!.wire,
    if (elapsedSeconds != null) 'elapsedSeconds': elapsedSeconds,
  };
}

/// Output of `DiagnosticRouter.selectNextObjectiveBlock`.
@immutable
class NextBlockSelectionResult {
  /// Creates a [NextBlockSelectionResult].
  const new({
    required this.shouldPresent,
    required this.coincidentReasons,
    required this.reducedSampling,
    required this.hasContradictoryEvidence,
    required this.consecutiveSameDirectionCount,
    required this.evidenceCheckTriggered,
    this.block,
    this.targetTier,
    this.stopReason,
  });

  /// Whether another block should be shown (`true`) or sampling should stop (`false`).
  final bool shouldPresent;

  /// Selected block when [shouldPresent] is `true`.
  final DiagnosticBlockDef? block;

  /// Chosen candidate tier.
  final AuthoringTier? targetTier;

  /// Primary stop reason when [shouldPresent] is `false`.
  final DiagnosticStopReason? stopReason;

  /// Any coincident threshold/deadline flags active at decision time.
  final List<DiagnosticStopReason> coincidentReasons;

  /// Whether fewer than 3 valid blocks were collected.
  final bool reducedSampling;

  /// Whether a harder `strong` conflicted with an easier `low`.
  final bool hasContradictoryEvidence;

  /// Length of consecutive same-direction valid streak.
  final int consecutiveSameDirectionCount;

  /// Whether two consecutive same-direction results triggered an evidence check.
  final bool evidenceCheckTriggered;
}
