import 'package:mockza/core/advanced/linguistic_graph_math.dart';

/// Question-type accuracy tuple for objective weakness extraction.
class QuestionTypeStatInput {
  /// Creates a [QuestionTypeStatInput].
  const new({
    required this.questionType,
    required this.correct,
    required this.total,
  });

  /// Question type key.
  final String questionType;

  /// Number of correct responses.
  final int correct;

  /// Total items evaluated.
  final int total;
}

/// Extracted deterministic weakness signal.
class ExtractedWeaknessSignal {
  /// Creates an [ExtractedWeaknessSignal].
  const new({
    required this.canonicalKey,
    required this.skillScope,
    required this.displayLabelEn,
    required this.displayLabelFa,
    required this.coachNoteEn,
    required this.coachNoteFa,
    required this.observedPolarity,
  });

  /// Canonical bottleneck key.
  final String canonicalKey;

  /// Owning skill scope.
  final String skillScope;

  /// English label.
  final String displayLabelEn;

  /// Persian label.
  final String displayLabelFa;

  /// English coach note.
  final String coachNoteEn;

  /// Persian coach note.
  final String coachNoteFa;

  /// Gap or positive mastery polarity.
  final EvidencePolarity observedPolarity;
}

class _WeaknessTemplate {
  const new({
    required this.canonicalKey,
    required this.skillScope,
    required this.displayLabelEn,
    required this.displayLabelFa,
    required this.coachNoteEn,
    required this.coachNoteFa,
  });

  final String canonicalKey;
  final String skillScope;
  final String displayLabelEn;
  final String displayLabelFa;
  final String coachNoteEn;
  final String coachNoteFa;
}

/// Deterministic objective weakness extractor matching `objective-weakness-extractor.ts`.
abstract final class ObjectiveWeaknessExtractor {
  static const Map<String, _WeaknessTemplate> _catalog =
      <String, _WeaknessTemplate>{
        'reading:tfng_trap': _WeaknessTemplate(
          canonicalKey: 'reading:tfng_trap',
          skillScope: 'reading',
          displayLabelEn: 'True / False / Not Given Traps',
          displayLabelFa: 'تله‌های True / False / Not Given در ریدینگ',
          coachNoteEn:
              'Distinguish contradictions (False) from unstated details (Not Given).',
          coachNoteFa:
              'تفاوت میان اطلاعات متضاد (False) و ذکرنشده (Not Given) را دقیق‌تر بررسی کنید.',
        ),
        'reading:matching_headings': _WeaknessTemplate(
          canonicalKey: 'reading:matching_headings',
          skillScope: 'reading',
          displayLabelEn: 'Paragraph Headings & Main Idea',
          displayLabelFa: 'انتخاب عنوان پاراگراف و ایده اصلی',
          coachNoteEn:
              'Identify topic sentences and overall paragraph function rather than single keywords.',
          coachNoteFa:
              'به جای تکیه بر تک‌واژه، جمله موضوعی و پیام کلی پاراگراف را بیابید.',
        ),
        'reading:summary_completion': _WeaknessTemplate(
          canonicalKey: 'reading:summary_completion',
          skillScope: 'reading',
          displayLabelEn: 'Summary & Gap-Fill Precision',
          displayLabelFa: 'دقت در تکمیل خلاصه و جای‌خالی ریدینگ',
          coachNoteEn:
              'Check grammar fit, word limit, and exact synonym clues around each blank.',
          coachNoteFa:
              'تناسب گرامری، سقف تعداد کلمه و مترادف‌های اطراف جای‌خالی را بررسی کنید.',
        ),
        'reading:paraphrase_matching': _WeaknessTemplate(
          canonicalKey: 'reading:paraphrase_matching',
          skillScope: 'reading',
          displayLabelEn: 'Academic Paraphrase Recognition',
          displayLabelFa: 'تشخیص بازنویسی و مترادف‌های آکادمیک',
          coachNoteEn:
              'Practice spotting paraphrased verbs and abstract noun equivalents quickly.',
          coachNoteFa:
              'تشخیص سریع مترادف‌ها و بازنویسی مفاهیم در متن را تمرین کنید.',
        ),
        'listening:distractor_traps': _WeaknessTemplate(
          canonicalKey: 'listening:distractor_traps',
          skillScope: 'listening',
          displayLabelEn: 'Listening Self-Correction & Distractors',
          displayLabelFa: 'تله‌های اصلاح نظر و انحرافی در لیسنینگ',
          coachNoteEn:
              'Wait for speaker corrections ("actually", "Wait—let’s change...") before locking an answer.',
          coachNoteFa:
              'پیش از نهایی‌کردن پاسخ، منتظر اصلاح جمله توسط گوینده (مثل actually) بمانید.',
        ),
        'listening:detail_capture': _WeaknessTemplate(
          canonicalKey: 'listening:detail_capture',
          skillScope: 'listening',
          displayLabelEn: 'Specific Numbers, Names & Note Completion',
          displayLabelFa: 'ثبت دقیق اعداد، نام‌ها و تکمیل یادداشت لیسنینگ',
          coachNoteEn:
              'Predict part-of-speech before the recording starts and track signpost words.',
          coachNoteFa:
              'پیش از پخش صدا، نوع کلمه مورد نیاز جای‌خالی را حدس بزنید.',
        ),
        'listening:multiple_choice_attitude': _WeaknessTemplate(
          canonicalKey: 'listening:multiple_choice_attitude',
          skillScope: 'listening',
          displayLabelEn: 'Speaker Attitude & Inference',
          displayLabelFa: 'درک لحن و نتیجه‌گیری غیرمستقیم گوینده',
          coachNoteEn:
              'Listen for hedging, agreement/disagreement markers, and implied stance.',
          coachNoteFa:
              'به نشانه‌های موافقت، تردید و دیدگاه نهایی گوینده دقت کنید.',
        ),
        'vocab:academic_collocation': _WeaknessTemplate(
          canonicalKey: 'vocab:academic_collocation',
          skillScope: 'vocabulary',
          displayLabelEn: 'Academic Collocations & Word Form',
          displayLabelFa: 'هم‌آواهای آکادمیک و فرم درست واژه',
          coachNoteEn:
              'Pair verbs and nouns naturally (e.g., mitigate risk, foster innovation).',
          coachNoteFa:
              'واژگان را در قالب ترکیب‌های طبیعی (Collocation) حفظ و استفاده کنید.',
        ),
      };

  static String _mapQuestionType(String skill, String questionType) {
    final qt = questionType.trim().toLowerCase();
    if (skill == 'reading') {
      if (qt.contains('tfng') ||
          qt.contains('ynng') ||
          qt.contains('true_false')) {
        return 'reading:tfng_trap';
      }
      if (qt.contains('heading') || qt.contains('matching')) {
        return 'reading:matching_headings';
      }
      if (qt.contains('summary') ||
          qt.contains('fill') ||
          qt.contains('short') ||
          qt.contains('complete')) {
        return 'reading:summary_completion';
      }
      return 'reading:paraphrase_matching';
    }
    if (skill == 'listening') {
      if (qt.contains('mcq') ||
          qt.contains('multiple') ||
          qt.contains('choose')) {
        return 'listening:multiple_choice_attitude';
      }
      if (qt.contains('form') ||
          qt.contains('note') ||
          qt.contains('gap') ||
          qt.contains('dictation')) {
        return 'listening:detail_capture';
      }
      return 'listening:distractor_traps';
    }
    return 'vocab:academic_collocation';
  }

  static String _mapDrillType(String drillType, String skill) {
    final dt = drillType.trim().toLowerCase();
    if (dt.contains('tfng')) return 'reading:tfng_trap';
    if (dt.contains('collocation') || dt.contains('lexical')) {
      return 'vocab:academic_collocation';
    }
    if (dt.contains('distractor')) return 'listening:distractor_traps';
    if (dt.contains('paraphrase') || dt.contains('complete_words')) {
      return 'reading:paraphrase_matching';
    }
    if (dt.contains('reorder')) return 'reading:matching_headings';
    return skill == 'listening'
        ? 'listening:detail_capture'
        : 'reading:paraphrase_matching';
  }

  /// Extracts weakness/mastery deltas from objective test stats or a micro-drill.
  static List<ExtractedWeaknessSignal> extract({
    required String skill,
    List<QuestionTypeStatInput>? questionTypeStats,
    String? drillType,
    int correctCount = 0,
    int totalCount = 0,
  }) {
    final aggregated = <String, ({int correct, int total})>{};

    if (questionTypeStats != null && questionTypeStats.isNotEmpty) {
      for (final stat in questionTypeStats) {
        if (stat.total <= 0) continue;
        final key = _mapQuestionType(skill, stat.questionType);
        final prev = aggregated[key] ?? (correct: 0, total: 0);
        aggregated[key] = (
          correct: prev.correct + (stat.correct < 0 ? 0 : stat.correct),
          total: prev.total + stat.total,
        );
      }
    } else if (drillType != null && drillType.isNotEmpty && totalCount > 0) {
      final key = _mapDrillType(drillType, skill);
      aggregated[key] = (
        correct: correctCount < 0 ? 0 : correctCount,
        total: totalCount < 1 ? 1 : totalCount,
      );
    }

    final out = <ExtractedWeaknessSignal>[];
    for (final entry in aggregated.entries) {
      if (entry.value.total <= 0) continue;
      final ratio = entry.value.correct / entry.value.total;
      if (ratio < 0.65 || ratio >= 0.85) {
        final tpl =
            _catalog[entry.key] ?? _catalog['reading:paraphrase_matching']!;
        out.add(
          ExtractedWeaknessSignal(
            canonicalKey: tpl.canonicalKey,
            skillScope: tpl.skillScope,
            displayLabelEn: tpl.displayLabelEn,
            displayLabelFa: tpl.displayLabelFa,
            coachNoteEn: tpl.coachNoteEn,
            coachNoteFa: tpl.coachNoteFa,
            observedPolarity: ratio >= 0.85
                ? EvidencePolarity.targetUsed
                : EvidencePolarity.gapObserved,
          ),
        );
      }
    }
    return out;
  }
}
