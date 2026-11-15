import 'package:meta/meta.dart';
import 'package:mockza/core/exams/band_conversion_table.dart';
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
  });

  /// Stable question identifier inside the test pack.
  final String questionId;

  /// Accepted canonical variants (case-insensitive normalized comparison).
  final List<String> acceptedAnswers;

  /// Raw learner submission (`null` when unanswered).
  final String? userAnswer;

  /// Maximum words permitted (strict limit in IELTS instructions).
  final int maxWords;
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
  });

  /// Total exact/variant matches.
  final int correctCount;

  /// Total questions evaluated.
  final int totalCount;

  /// Mapped IELTS band (`0.0..9.0`).
  final double bandScore;

  /// Per-question correctness map keyed by question ID.
  final Map<String, bool> questionCorrectness;
}

/// Offline scorer for Reading and Listening objective questions.
abstract final class LocalObjectiveScorer {
  /// Normalizes whitespace, hyphens, apostrophes, UK/US spellings, and small numerals.
  static String normalize(String raw) {
    var text = raw.trim().toLowerCase();

    // Standardize apostrophes and hyphens
    text = text.replaceAll(RegExp("['’`]"), "'");
    text = text.replaceAll(RegExp('[-—–]'), ' ');

    // Normalize multiple whitespace to single space
    text = text.replaceAll(RegExp(r'\s+'), ' ').trim();

    // Token-level normalization for UK/US spellings and numeral words
    final tokens = text.split(' ').map((token) {
      final cleanToken = token.replaceAll(RegExp(r"[^\w']"), '');
      final usEquivalent = ukToUsSpellings[cleanToken];
      if (usEquivalent != null) return usEquivalent;
      final digitEquivalent = wordToDigits[cleanToken];
      if (digitEquivalent != null) return digitEquivalent;
      return cleanToken;
    }).toList();

    return tokens.join(' ').trim();
  }

  /// Counts words in an answer string.
  static int countWords(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return 0;
    return trimmed.split(RegExp(r'\s+')).length;
  }

  /// Scores [answers] locally and computes the corresponding IELTS band.
  static ObjectiveScoreReport score({
    required List<ObjectiveQuestionAnswer> answers,
    required SkillKind skill,
    ExamModuleType moduleType = ExamModuleType.academic,
  }) {
    var correct = 0;
    final perQuestion = <String, bool>{};

    for (final item in answers) {
      final candidate = item.userAnswer;
      var isMatch = false;

      if (candidate != null && candidate.trim().isNotEmpty) {
        // Strict word count limit enforcement (IELTS standard rule)
        final wordCount = countWords(candidate);
        if (wordCount <= item.maxWords) {
          final normalizedCandidate = normalize(candidate);

          isMatch = item.acceptedAnswers.any((key) {
            final normalizedKey = normalize(key);
            if (normalizedKey == normalizedCandidate) return true;

            // Direct match without tokenization if identical after trim/lower
            if (key.trim().toLowerCase() == candidate.trim().toLowerCase()) {
              return true;
            }
            return false;
          });
        }
      }

      perQuestion[item.questionId] = isMatch;
      if (isMatch) correct += 1;
    }

    // Scale short practice packs (<40 items) proportionally to 40-item IELTS table.
    final scaledCorrect = (answers.isNotEmpty && answers.length != 40)
        ? ((correct / answers.length) * 40).round().clamp(0, 40)
        : correct;

    final band = switch (skill) {
      SkillKind.listening => BandConversionTable.listeningBandFor(
        scaledCorrect,
      ),
      SkillKind.reading => BandConversionTable.readingBandFor(
        scaledCorrect,
        moduleType: moduleType,
      ),
      SkillKind.speaking || SkillKind.writing || SkillKind.vocabulary => 0.0,
    };

    return ObjectiveScoreReport(
      correctCount: correct,
      totalCount: answers.length,
      bandScore: band,
      questionCorrectness: perQuestion,
    );
  }
}
