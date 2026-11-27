import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/personalization/topic_taxonomy.dart';

/// Pure-Dart edition-aware display copy and diagnostic/worker label localizers.
///
/// Mirrors `web/src/components/bidi/diagnostic-labels.ts` and
/// `web/src/components/bidi/topic-labels.ts` to keep Web <-> Flutter parity.
abstract final class EditionCopy {
  static const Map<String, ({String en, String fa})> _extraTopicLabels =
      <String, ({String en, String fa})>{
        'academic_linking': (
          en: 'Academic Cohesion',
          fa: 'انسجام و ربط آکادمیک',
        ),
        'reading_synonyms': (
          en: 'Reading Paraphrases',
          fa: 'مترادف‌های ریدینگ',
        ),
        'marine_biology': (
          en: 'Marine Biology',
          fa: 'زیست‌شناسی دریایی',
        ),
        'mistake_to_deck': (
          en: 'Saved Mistake',
          fa: 'از اشتباهات شما',
        ),
        'evaluation_upgrade': (
          en: 'Score Upgrade',
          fa: 'پیشنهاد ارتقای نمره',
        ),
        'register_shifter': (
          en: 'Speaking Upgrade',
          fa: 'ارتقای لحن گفتار',
        ),
        'drop_extract': (
          en: 'Personal Study',
          fa: 'محتوای شخصی',
        ),
        'drop_anything': (
          en: 'Personal Study',
          fa: 'محتوای شخصی',
        ),
        'seeded': (
          en: 'Core Academic',
          fa: 'واژه پایه آکادمیک',
        ),
        'writing_grammar': (
          en: 'Writing Grammar',
          fa: 'گرامر رایتینگ',
        ),
        'speaking_fluency': (
          en: 'Speaking Fluency',
          fa: 'روانی گفتار',
        ),
        'explicit_detail': (
          en: 'Explicit Detail',
          fa: 'جزئیات صریح متن',
        ),
        'inference': (
          en: 'Inference & Meaning',
          fa: 'استنباط و مفهوم ضمنی',
        ),
        'paraphrase': (
          en: 'Paraphrase Recognition',
          fa: 'تشخیص بازنویسی',
        ),
        'distractor_filtering': (
          en: 'Distractor Filtering',
          fa: 'تشخیص گزینه‌های انحرافی',
        ),
        'main_idea': (
          en: 'Main Idea & Purpose',
          fa: 'ایده اصلی و هدف',
        ),
        'vocabulary_in_context': (
          en: 'Vocabulary in Context',
          fa: 'واژگان در متن',
        ),
        'grammar_range': (
          en: 'Grammar Range',
          fa: 'تنوع گرامری',
        ),
        'lexical_resource': (
          en: 'Lexical Precision',
          fa: 'دقت واژگانی',
        ),
        'coherence': (
          en: 'Coherence & Linking',
          fa: 'انسجام و ربط',
        ),
        'pronunciation': (
          en: 'Pronunciation & Rhythm',
          fa: 'تلفظ و آهنگ کلام',
        ),
        'fluency': (
          en: 'Speaking Fluency',
          fa: 'روانی گفتار',
        ),
        'detail_recall': (
          en: 'Detail Recall',
          fa: 'یادآوری جزئیات',
        ),
        'core_exam_language': (
          en: 'Core Exam Language',
          fa: 'ساختارهای کلیدی آزمون',
        ),
      };

  /// Returns target-score card/row heading without duplicating "Score Score".
  static String targetScoreTitle(ExamTrack track, {required bool isIran}) {
    if (isIran) {
      return track.unitLabel == 'Band' ? 'نمره هدف (باند)' : 'نمره هدف';
    }
    return track.unitLabel == 'Band' ? 'Target Band Score' : 'Target Score';
  }

  /// Returns localized score-scale label (`Estimated Band` / `Estimated Score`).
  static String scaleLabelFor(ExamTrack track, {required bool isIran}) {
    if (!isIran) return track.scaleLabel;
    return track.unitLabel == 'Band' ? 'باند تخمینی' : 'نمره تخمینی';
  }

  /// Returns localized score unit noun (`Band` / `Score` vs `باند` / `نمره`).
  static String unitLabelFor(ExamTrack track, {required bool isIran}) {
    if (!isIran) return track.unitLabel;
    return track.unitLabel == 'Band' ? 'باند' : 'نمره';
  }

  /// Formats [score] on [track] with edition-appropriate digits.
  static String formatScoreFor(
    ExamTrack track,
    double score, {
    required bool isIran,
  }) {
    final formatted = track.formatScore(score);
    return isIran ? EdgeNumerals.toPersianDigits(formatted) : formatted;
  }

  /// Formats [score] prefixed with its localized unit.
  static String formatScoreWithUnitFor(
    ExamTrack track,
    double score, {
    required bool isIran,
  }) {
    if (!isIran) return track.formatScoreWithUnit(score);
    return '${unitLabelFor(track, isIran: true)} ${formatScoreFor(track, score, isIran: true)}';
  }

  /// Formats a human-readable skill label for [skill].
  static String skillName(String skill, {required bool isIran}) {
    final normalized = skill.trim().toLowerCase();
    return switch (normalized) {
      'reading' => isIran ? 'ریدینگ' : 'Reading',
      'listening' => isIran ? 'لیسنینگ' : 'Listening',
      'writing' => isIran ? 'رایتینگ' : 'Writing',
      'speaking' => isIran ? 'اسپیکینگ' : 'Speaking',
      'vocabulary' => isIran ? 'واژگان' : 'Vocabulary',
      'full_mock' || 'fullmock' => isIran ? 'آزمون کامل' : 'Full Mock',
      _ => skill,
    };
  }

  /// Formats canonical or extra topic/focus tag for edition display.
  static String topicLabel(String? rawKey, {required bool isIran}) {
    final trimmed = (rawKey ?? '').trim();
    if (trimmed.isEmpty) {
      return CanonicalTopicKey.academicCore.labelFor(isIran: isIran);
    }
    final lower = trimmed.toLowerCase();
    final extra = _extraTopicLabels[lower];
    if (extra != null) {
      return isIran ? extra.fa : extra.en;
    }
    final normalized = CanonicalTopicKey.normalize(trimmed);
    if (normalized != CanonicalTopicKey.academicCore ||
        lower == 'academic_core') {
      return normalized.labelFor(isIran: isIran);
    }
    return trimmed.replaceAll('_', ' ');
  }

  /// Localizes a diagnostic recommended-action title + description pair.
  static ({String title, String description}) localizeDiagnosticAction(
    String title,
    String description, {
    required bool isIran,
  }) {
    if (!isIran) {
      return (title: title, description: description);
    }
    final trimmedTitle = title.trim();
    final practiceMatch = RegExp(
      r'^Practice (Reading|Listening|Writing|Speaking):\s*(.+)$',
      caseSensitive: false,
    ).firstMatch(trimmedTitle);

    var localizedTitle = title;
    if (practiceMatch != null) {
      final rawSkill = practiceMatch.group(1)!.toLowerCase();
      final rawFocus = practiceMatch.group(2)!.trim();
      localizedTitle =
          'تمرین ${skillName(rawSkill, isIran: true)}: ${topicLabel(rawFocus, isIran: true)}';
    } else if (trimmedTitle == 'Explore starter practice across skills') {
      localizedTitle = 'شروع تمرین‌های پایه در مهارت‌های مختلف';
    }

    final trimmedDesc = description.trim();
    var localizedDescription = description;
    if (trimmedDesc ==
        'Targeted short practice based directly on what appeared in your starting check.') {
      localizedDescription =
          'تمرین کوتاه و هدفمند بر اساس عملکرد شما در ارزیابی اولیه.';
    } else if (trimmedDesc ==
        'A short starting check. Your profile improves as you complete everyday Reading, Listening, Writing, and Speaking practice.') {
      localizedDescription = 'یک ارزیابی کوتاه اولیه. با انجام تمرین‌های روزانه ریدینگ، لیسنینگ، رایتینگ و اسپیکینگ، پروفایل شما دقیق‌تر می‌شود.';
    }

    return (title: localizedTitle, description: localizedDescription);
  }

  static String _localizeBroadBandLabel(String band, {required bool isIran}) {
    if (!isIran) return band;
    return switch (band.trim()) {
      'Foundational' => 'پایه',
      'Intermediate' => 'متوسط',
      'Upper-Intermediate' => 'فوق متوسط',
      'Advanced' => 'پیشرفته',
      'Upper-Intermediate to Advanced' => 'فوق متوسط تا پیشرفته',
      _ => band,
    };
  }

  /// Localizes diagnostic summary level strings (`Suggested practice: ...`).
  static String localizeDiagnosticLevel(
    String raw, {
    required bool isIran,
  }) {
    if (!isIran) return raw;
    final match = RegExp(
      r'^Suggested practice:\s*(.+?)\s*\(([^)]+?)\s*focus\)\s*(?:—|-)\s*(provisional(?:\s*\(reduced sampling\))?)$',
      caseSensitive: false,
    ).firstMatch(raw.trim());
    if (match == null) return raw;
    final band = _localizeBroadBandLabel(match.group(1)!, isIran: true);
    final range = match.group(2)!.trim();
    final status = match.group(3)!.toLowerCase().contains('reduced sampling')
        ? 'تخمین اولیه (نمونه محدود)'
        : 'تخمین اولیه';
    return 'سطح پیشنهادی تمرین: $band (تمرکز $range) — $status';
  }

  /// Localizes diagnostic per-skill observation strings.
  static String localizeDiagnosticObservation(
    String raw, {
    required bool isIran,
  }) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return raw;
    if (trimmed.startsWith('stage.')) {
      return localizeWorkerStage(trimmed, isIran: isIran);
    }
    if (!isIran) return trimmed;

    final skippedMatch = RegExp(
      '^This (reading|listening|writing|speaking) check was skipped',
      caseSensitive: false,
    ).firstMatch(trimmed);
    if (skippedMatch != null) {
      final skill = skillName(
        skippedMatch.group(1)!.toLowerCase(),
        isIran: true,
      );
      return 'این بخش از ارزیابی $skill رد شد.';
    }

    if (trimmed ==
        'Audio playback was unavailable before usable evidence could be collected.') {
      return 'پخش صدا پیش از جمع‌آوری شواهد کافی در دسترس نبود.';
    }
    if (trimmed ==
        'Too few completed answers to suggest a practice level yet.') {
      return 'تعداد پاسخ‌های ثبت‌شده برای پیشنهاد سطح تمرین کافی نیست.';
    }

    final strongMatch = RegExp(
      r'^Answered all questions accurately on (.+?)-oriented (reading|listening|writing|speaking) tasks\.$',
      caseSensitive: false,
    ).firstMatch(trimmed);
    if (strongMatch != null) {
      final tiers = strongMatch.group(1)!;
      final skill = skillName(
        strongMatch.group(2)!.toLowerCase(),
        isIran: true,
      );
      return 'پاسخگویی دقیق به همه پرسش‌های $skill در سطح $tiers.';
    }

    final chalMatch = RegExp(
      r'^Found (.+?)-oriented (reading|listening|writing|speaking) tasks challenging\.$',
      caseSensitive: false,
    ).firstMatch(trimmed);
    if (chalMatch != null) {
      final tiers = chalMatch.group(1)!;
      final skill = skillName(
        chalMatch.group(2)!.toLowerCase(),
        isIran: true,
      );
      return 'چالش در پرسش‌های $skill در سطح $tiers.';
    }

    final partMatch = RegExp(
      r'^Showed partial accuracy on (.+?)-oriented (reading|listening|writing|speaking) tasks\.$',
      caseSensitive: false,
    ).firstMatch(trimmed);
    if (partMatch != null) {
      final tiers = partMatch.group(1)!;
      final skill = skillName(
        partMatch.group(2)!.toLowerCase(),
        isIran: true,
      );
      return 'دقت نسبی در پرسش‌های $skill در سطح $tiers.';
    }

    if (trimmed ==
        'Responses across difficulty tiers were mixed; additional practice will sharpen placement.') {
      return 'عملکرد در سطوح سختی مختلف ترکیبی بود؛ تمرین بیشتر جایگاه شما را دقیق‌تر می‌کند.';
    }
    if (trimmed == 'Collected fewer than three blocks within the time limit.') {
      return 'در زمان محدود، کمتر از سه بخش تکمیل شد.';
    }

    final moreMatch = RegExp(
      r'^More (reading|listening|writing|speaking) evidence is needed\.$',
      caseSensitive: false,
    ).firstMatch(trimmed);
    if (moreMatch != null) {
      final skill = skillName(moreMatch.group(1)!.toLowerCase(), isIran: true);
      return 'برای برآورد دقیق‌تر $skill به تمرین بیشتری نیاز است.';
    }

    final shortMatch = RegExp(
      r'^Short (reading|listening|writing|speaking) response reviewed\.$',
      caseSensitive: false,
    ).firstMatch(trimmed);
    if (shortMatch != null) {
      final skill = skillName(shortMatch.group(1)!.toLowerCase(), isIran: true);
      return 'پاسخ کوتاه $skill بررسی شد.';
    }

    if (trimmed == 'Recording was unavailable or could not be decoded.') {
      return 'فایل صوتی در دسترس نبود یا قابل رمزگشایی نیست.';
    }
    if (trimmed == 'Evaluation did not complete. Retry when ready.') {
      return 'ارزیابی کامل نشد. هر زمان آماده بودید دوباره تلاش کنید.';
    }

    final evalMatch = RegExp(
      r'^Evaluating your (reading|listening|writing|speaking) response\.\.\.$',
      caseSensitive: false,
    ).firstMatch(trimmed);
    if (evalMatch != null) {
      final skill = skillName(evalMatch.group(1)!.toLowerCase(), isIran: true);
      return 'در حال بررسی پاسخ $skill شما...';
    }

    return trimmed;
  }

  /// Localizes raw `stage.*` strings emitted by background evaluation/worker jobs.
  static String localizeWorkerStage(
    String? rawStage, {
    required bool isIran,
  }) {
    final stage = (rawStage ?? '').trim();
    if (stage.isEmpty) return '';

    if (stage == 'stage.register_shifting') {
      return isIran
          ? 'در حال بازنویسی و ارتقای سطح آکادمیک...'
          : 'Rewriting at higher academic registers...';
    }
    if (stage == 'stage.register_complete') {
      return isIran ? 'تبدیل لحن آماده است' : 'Register shift ready';
    }
    if (stage == 'stage.register_failed') {
      return isIran ? 'تبدیل لحن ناموفق بود' : 'Register shift failed';
    }
    if (stage.startsWith('stage.register_retrying:')) {
      final rawAttempt = stage.substring('stage.register_retrying:'.length);
      final attempt = isIran
          ? EdgeNumerals.toPersianDigits(rawAttempt)
          : rawAttempt;
      return isIran
          ? 'تلاش مجدد برای ارتقای متن (تلاش $attempt)...'
          : 'Retrying register shift (attempt $attempt)...';
    }

    if (stage == 'stage.drop_extracting') {
      return isIran
          ? 'در حال استخراج واژگان و عبارات کلیدی...'
          : 'Extracting high-value exam language...';
    }
    if (stage == 'stage.drop_reading_images') {
      return isIran
          ? 'در حال خواندن متن از تصاویر...'
          : 'Reading text from your images...';
    }
    if (stage == 'stage.drop_building_drill') {
      return isIran
          ? 'در حال ساخت تمرین و کارت‌های واژگان...'
          : 'Building flashcards & practice drills...';
    }
    if (stage == 'stage.drop_ready') {
      return isIran ? 'تمرین شخصی شما آماده است' : 'Custom drill pack ready';
    }
    if (stage == 'stage.drop_failed') {
      return isIran
          ? 'پردازش محتوای ورودی ناموفق بود'
          : 'Drop extraction failed';
    }
    if (stage.startsWith('stage.drop_retrying:')) {
      final rawAttempt = stage.substring('stage.drop_retrying:'.length);
      final attempt = isIran
          ? EdgeNumerals.toPersianDigits(rawAttempt)
          : rawAttempt;
      return isIran
          ? 'تلاش مجدد استخراج (تلاش $attempt)...'
          : 'Retrying extraction (attempt $attempt)...';
    }

    return stage;
  }

  /// Localizes policy/moderation rejection messages on Drop Anything items.
  static String localizeDropPolicyReason(
    String? policyCode,
    String? rawReason, {
    required bool isIran,
  }) {
    if (!isIran) {
      return rawReason ??
          'Content could not be turned into an exam study drill.';
    }
    return switch ((policyCode ?? '').trim().toLowerCase()) {
      'empty_input' => 'محتوای کافی برای ساخت تمرین یافت نشد. متن طولانی‌تری یا تصویر خواناتری ارسال کنید.',
      'unsupported_language' => 'این بخش فقط از متن‌های انگلیسی یا دوزبانه انگلیسی-فارسی پشتیبانی می‌کند.',
      'off_topic' => 'این محتوا با ساختار تمرین‌های آزمون زبان همخوانی ندارد. یک متن یا مقاله کوتاه وارد کنید.',
      'policy_blocked' =>
        'امکان ساخت تمرین از این محتوا به دلیل محدودیت‌های ایمنی وجود ندارد.',
      _ =>
        (rawReason != null && rawReason.trim().isNotEmpty)
            ? rawReason.trim()
            : 'امکان تبدیل این محتوا به تمرین آزمونی وجود نداشت.',
    };
  }

  /// Localizes micro-drill category labels.
  static String localizeMicroDrillCategory(
    String drillType, {
    required bool isIran,
  }) {
    final normalized = drillType.trim().toLowerCase();
    return switch (normalized) {
      'speed_tfng' => isIran ? 'سرعت و دقت T/F/NG' : 'Speed True / False / NG',
      'speed_ynng' => isIran ? 'سرعت و دقت Y/N/NG' : 'Speed Yes / No / NG',
      'summary_gap_fill' ||
      'gap_fill' => isIran ? 'تکمیل خلاصه متن' : 'Summary Gap Fill',
      'complex_grammar' =>
        isIran ? 'ساختارهای گرامری پیشرفته' : 'Complex Grammar',
      'pronunciation_rhythm' =>
        isIran ? 'تلفظ و آهنگ کلام' : 'Pronunciation & Rhythm',
      'coherence_linking' => isIran ? 'انسجام و ربط' : 'Coherence & Linking',
      'lexical_precision' => isIran ? 'دقت واژگانی' : 'Lexical Precision',
      'collocation_matcher' =>
        isIran ? 'کالُکیشن‌ها و همنشینی' : 'Collocation Matcher',
      'distractor_spotter' =>
        isIran ? 'تشخیص گزینه‌های انحرافی' : 'Distractor Spotter',
      'paraphrase_matcher' =>
        isIran ? 'تشخیص بازنویسی (Paraphrase)' : 'Paraphrase Matcher',
      'toefl_complete_words' =>
        isIran ? 'تکمیل واژه‌ها (TOEFL)' : 'Complete the Words',
      'pte_reorder_swt' =>
        isIran ? 'مرتب‌سازی و خلاصه (PTE)' : 'Re-order & Summarize',
      'det_read_select' => isIran ? 'تشخیص واژه واقعی (DET)' : 'Read & Select',
      _ => topicLabel(drillType, isIran: isIran),
    };
  }

  /// Localizes the instruction header inside an active micro-drill item.
  static String localizeMicroDrillHeader(
    String drillType, {
    required bool isIran,
  }) {
    final normalized = drillType.trim().toLowerCase();
    if (normalized.contains('tfng')) {
      return isIran
          ? 'صحیح / غلط / ذکر نشده (True / False / Not Given)'
          : 'True / False / Not Given';
    }
    if (normalized.contains('ynng')) {
      return isIran
          ? 'بله / خیر / ذکر نشده (Yes / No / Not Given)'
          : 'Yes / No / Not Given';
    }
    if (normalized.contains('gap') || normalized.contains('summary')) {
      return isIran ? 'خلاصه متن را کامل کنید' : 'Complete the Summary';
    }
    return isIran ? 'بهترین پاسخ را انتخاب کنید' : 'Choose the Best Answer';
  }

  /// Returns `true` when [drillId] belongs to [activeTrack].
  static bool matchesDrillTrack(String drillId, ExamTrack activeTrack) {
    final lower = drillId.trim().toLowerCase();
    if (lower.startsWith('ielts-')) return activeTrack.isIelts;
    if (lower.startsWith('toefl-')) return activeTrack == ExamTrack.toeflIbt;
    if (lower.startsWith('pte-')) return activeTrack == ExamTrack.pteAcademic;
    if (lower.startsWith('det-')) return activeTrack == ExamTrack.det;
    return true;
  }

  /// Formats a compact roadmap milestone chip label (`M1` vs `گام ۱`).
  static String milestoneChipLabel(
    int index, {
    required bool isIran,
    bool completed = false,
  }) {
    final mark = completed ? ' ✓' : '';
    if (!isIran) return 'M$index$mark';
    return 'گام ${EdgeNumerals.toPersianDigits(index)}$mark';
  }
}
