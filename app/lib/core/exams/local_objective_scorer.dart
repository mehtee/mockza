import 'dart:math' as math;

import 'package:meta/meta.dart';
import 'package:mockza/core/exams/exam_descriptor.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/models/attempt_status.dart';

/// Common UK to US spelling normalization map for IELTS answers.
const Map<String, String> ukToUsSpellings = <String, String>{
  'colour': 'color',
  'colours': 'colors',
  'flavour': 'flavor',
  'flavours': 'flavors',
  'humour': 'humor',
  'neighbour': 'neighbor',
  'neighbours': 'neighbors',
  'organisation': 'organization',
  'organisations': 'organizations',
  'organise': 'organize',
  'organised': 'organized',
  'recognise': 'recognize',
  'recognised': 'recognized',
  'centre': 'center',
  'centres': 'centers',
  'theatre': 'theater',
  'theatres': 'theaters',
  'metre': 'meter',
  'metres': 'meters',
  'litre': 'liter',
  'litres': 'liters',
  'travelling': 'traveling',
  'travelled': 'traveled',
  'cancelling': 'canceling',
  'cancelled': 'canceled',
  'favourite': 'favorite',
  'defence': 'defense',
  'licence': 'license',
  'programme': 'program',
  'programmes': 'programs',
  'grey': 'gray',
};

/// Common small English numeral words mapped to numeric digits.
const Map<String, String> wordToDigits = <String, String>{
  'zero': '0',
  'one': '1',
  'two': '2',
  'three': '3',
  'four': '4',
  'five': '5',
  'six': '6',
  'seven': '7',
  'eight': '8',
  'nine': '9',
  'ten': '10',
};

/// Input item pairing a user's submitted response against accepted answer keys.
@immutable
class ObjectiveQuestionAnswer {
  /// Creates an [ObjectiveQuestionAnswer].
  const new({
    required this.questionId,
    required this.acceptedAnswers,
    required this.userAnswer,
    this.maxWords = 3,
    this.questionType = ObjectiveQuestionType.shortAnswer,
  });

  /// Stable question identifier inside the test pack.
  final String questionId;

  /// Accepted canonical variants (case-insensitive normalized comparison).
  final List<String> acceptedAnswers;

  /// Raw learner submission (`null` when unanswered).
  final String? userAnswer;

  /// Maximum words permitted (strict limit in IELTS instructions).
  final int maxWords;

  /// Objective question type used for sequence/dictation normalization.
  final ObjectiveQuestionType questionType;
}

/// Result of deterministic offline objective scoring.
@immutable
class ObjectiveScoreReport {
  /// Creates an [ObjectiveScoreReport].
  const new({
    required this.correctCount,
    required this.totalCount,
    required this.bandScore,
    required this.questionCorrectness,
    this.isCalibratedFullPack = true,
  });

  /// Total exact/variant matches.
  final int correctCount;

  /// Total questions evaluated.
  final int totalCount;

  /// Mapped IELTS band (`0.0..9.0`, or accuracy-scaled estimate when [isCalibratedFullPack] is false).
  final double bandScore;

  /// True when evaluated against a full 40-question IELTS table (`TD-33`).
  final bool isCalibratedFullPack;

  /// Percentage accuracy (`0..100`).
  int get accuracyPercent =>
      totalCount == 0 ? 0 : ((correctCount / totalCount) * 100).round();

  /// Per-question correctness map keyed by question ID.
  final Map<String, bool> questionCorrectness;
}

/// Offline scorer for Reading and Listening objective questions.
abstract final class LocalObjectiveScorer {
  /// Normalizes whitespace, hyphens, apostrophes, UK/US spellings, and small numerals
  /// while preserving decimals, currency symbols, percent signs, and time colons (`TD-33`).
  static String normalize(String raw) {
    var text = raw.trim().toLowerCase();

    // Standardize apostrophes and hyphens (preserving numeric decimals & currency)
    text = text.replaceAll(RegExp("['’`]"), "'");
    text = text.replaceAll(RegExp('[-—–]'), ' ');

    // Normalize multiple whitespace to single space
    text = text.replaceAll(RegExp(r'\s+'), ' ').trim();
    if (text.isEmpty) return '';

    // Token-level normalization preserving decimals (3.5), currency ($12.50, £5), % (25%), and times (10:30)
    final tokens = text
        .split(' ')
        .map((token) {
          var cleanToken = token;
          // Strip leading/trailing punctuation EXCEPT leading currency ($ £ €) or trailing %
          cleanToken = cleanToken.replaceFirst(RegExp(r"^[^\w$£€']+"), '');
          cleanToken = cleanToken.replaceFirst(RegExp(r'[^\w%]+$'), '');
          // Strip internal commas in formatted numbers (e.g. 1,250 -> 1250)
          cleanToken = cleanToken.replaceAllMapped(
            RegExp(r'(\d),(\d)'),
            (m) => '${m.group(1)}${m.group(2)}',
          );
          final usEquivalent = ukToUsSpellings[cleanToken];
          if (usEquivalent != null) return usEquivalent;
          final digitEquivalent = wordToDigits[cleanToken];
          if (digitEquivalent != null) return digitEquivalent;
          return cleanToken;
        })
        .where((t) => t.isNotEmpty)
        .toList();

    return tokens.join(' ').trim();
  }

  /// Counts words in an answer string.
  static int countWords(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return 0;
    return trimmed.split(RegExp(r'\s+')).length;
  }

  /// Normalizes ordered sequence answers (`A|B|C|D`, `A, B, C, D`, `ABCD`)
  /// into a canonical pipe-delimited uppercase token string.
  static String normalizeSequence(String raw) {
    final trimmed = raw.trim().toUpperCase();
    if (trimmed.isEmpty) return '';
    if (RegExp(r'^[A-Z]{2,8}$').hasMatch(trimmed)) {
      return trimmed.split('').join('|');
    }
    final tokens = trimmed
        .split(RegExp(r'[\s|,;]+'))
        .map((t) => t.replaceAll(RegExp('[^A-Z0-9]'), ''))
        .where((t) => t.isNotEmpty)
        .toList();
    return tokens.join('|');
  }

  /// Scores [answers] locally and computes the corresponding exam-scaled score.
  static ObjectiveScoreReport score({
    required List<ObjectiveQuestionAnswer> answers,
    required SkillKind skill,
    ExamModuleType moduleType = ExamModuleType.academic,
    ExamTrack? track,
  }) {
    var correct = 0;
    final perQuestion = <String, bool>{};

    for (final item in answers) {
      final candidate = item.userAnswer;
      var isMatch = false;

      if (candidate != null && candidate.trim().isNotEmpty) {
        if (item.questionType == ObjectiveQuestionType.reorderSequence) {
          final normalizedSeq = normalizeSequence(candidate);
          isMatch = item.acceptedAnswers.any(
            (key) => normalizeSequence(key) == normalizedSeq,
          );
        } else {
          final effectiveMaxWords =
              (item.questionType == ObjectiveQuestionType.dictation ||
                  item.questionType == ObjectiveQuestionType.binaryChoice)
              ? math.max(item.maxWords, 25)
              : item.maxWords;
          final wordCount = countWords(candidate);
          if (wordCount <= effectiveMaxWords) {
            final normalizedCandidate = normalize(candidate);

            isMatch = item.acceptedAnswers.any((key) {
              final normalizedKey = normalize(key);
              if (normalizedKey == normalizedCandidate) return true;

              if (key.trim().toLowerCase() == candidate.trim().toLowerCase()) {
                return true;
              }
              return false;
            });
          }
        }
      }

      perQuestion[item.questionId] = isMatch;
      if (isMatch) correct += 1;
    }

    final resolvedTrack =
        track ??
        (moduleType == ExamModuleType.generalTraining
            ? ExamTrack.ieltsGeneral
            : ExamTrack.ieltsAcademic);
    final descriptor = ExamDescriptor.forTrack(resolvedTrack);
    final isFullLength =
        answers.length >= descriptor.minCalibratedObjectiveCount;
    final scoreValue = descriptor.scoreObjective(
      skill: skill,
      correctCount: correct,
      totalCount: answers.length,
      isFullLength: isFullLength,
    );

    return ObjectiveScoreReport(
      correctCount: correct,
      totalCount: answers.length,
      bandScore: scoreValue,
      questionCorrectness: perQuestion,
      isCalibratedFullPack: isFullLength,
    );
  }
}
