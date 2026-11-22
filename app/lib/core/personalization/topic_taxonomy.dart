/// Canonical 10-topic taxonomy matching `backend/packages/domain/src/personalization/topic-taxonomy.ts`.
enum CanonicalTopicKey {
  /// Technology, AI & Digital Systems.
  technologyAi('technology_ai', 'Technology & AI', 'فناوری و هوش مصنوعی'),

  /// Career, Jobs & Workplace.
  careerWorkplace('career_workplace', 'Career & Workplace', 'کار و حرفه'),

  /// Travel, Tourism & Culture.
  travelCulture('travel_culture', 'Travel & Culture', 'سفر و فرهنگ'),

  /// Health, Medicine & Sports.
  healthSports('health_sports', 'Health & Sports', 'سلامت و ورزش'),

  /// Science, Environment & Climate.
  scienceClimate('science_climate', 'Science & Climate', 'علم و محیط زیست'),

  /// Cinema, Media & Arts.
  artsMedia('arts_media', 'Cinema & Arts', 'سینما و هنر'),

  /// Business, Economy & Finance.
  businessFinance('business_finance', 'Business & Finance', 'کسب‌وکار و مالی'),

  /// Education, Campus & Research.
  educationCampus('education_campus', 'Education & Research', 'آموزش و دانشگاه'),

  /// Cities, Architecture & Society.
  urbanSociety('urban_society', 'Cities & Society', 'شهرسازی و جامعه'),

  /// Universal high-yield core exam language.
  academicCore('academic_core', 'Core Exam Language', 'ساختارهای کلیدی آزمون');

  new(this.wireKey, this.labelEn, this.labelFa);

  /// Wire format matching PostgreSQL & TS domain contracts.
  final String wireKey;

  /// English UI label (`glb` edition).
  final String labelEn;

  /// Persian UI label (`irn` edition).
  final String labelFa;

  /// Returns localized display label for edition.
  String labelFor({required bool isIran}) => isIran ? labelFa : labelEn;

  /// Parses wire key or free-form topic label deterministically.
  static CanonicalTopicKey normalize(String? raw) {
    final s = (raw ?? '').trim().toLowerCase().replaceFirst('topic:', '');
    if (s.isEmpty) return CanonicalTopicKey.academicCore;

    for (final v in CanonicalTopicKey.values) {
      if (v.wireKey == s) return v;
    }
    if (s.contains('tech') ||
        s == 'technology' ||
        s.contains('ai') ||
        s.contains('هوش') ||
        s.contains('فناوری')) {
      return CanonicalTopicKey.technologyAi;
    }
    if (s.contains('career') ||
        s.contains('work') ||
        s.contains('job') ||
        s.contains('کار') ||
        s.contains('حرفه')) {
      return CanonicalTopicKey.careerWorkplace;
    }
    if (s.contains('travel') ||
        s.contains('cultur') ||
        s.contains('سفر') ||
        s.contains('فرهنگ')) {
      return CanonicalTopicKey.travelCulture;
    }
    if (s.contains('sport') ||
        s.contains('health') ||
        s.contains('fitness') ||
        s.contains('football') ||
        s.contains('سلامت') ||
        s.contains('ورزش') ||
        s.contains('فوتبال')) {
      return CanonicalTopicKey.healthSports;
    }
    if (s.contains('science') ||
        s.contains('climate') ||
        s.contains('environ') ||
        s.contains('علم') ||
        s.contains('محیط')) {
      return CanonicalTopicKey.scienceClimate;
    }
    if (s.contains('cinema') ||
        s.contains('art') ||
        s.contains('media') ||
        s.contains('سینما') ||
        s.contains('هنر')) {
      return CanonicalTopicKey.artsMedia;
    }
    if (s.contains('business') ||
        s.contains('finance') ||
        s.contains('econ') ||
        s == 'society_economics' ||
        s.contains('کسب') ||
        s.contains('مالی')) {
      return CanonicalTopicKey.businessFinance;
    }
    if (s.contains('edu') ||
        s.contains('campus') ||
        s.contains('research') ||
        s.contains('آموزش') ||
        s.contains('دانشگاه')) {
      return CanonicalTopicKey.educationCampus;
    }
    if (s.contains('urban') ||
        s.contains('city') ||
        s.contains('cities') ||
        s.contains('infra') ||
        s.contains('شهر') ||
        s.contains('جامعه')) {
      return CanonicalTopicKey.urbanSociety;
    }
    return CanonicalTopicKey.academicCore;
  }

  /// Maps legacy vocab `topicTag` values to canonical topic keys.
  static CanonicalTopicKey fromLegacyVocabTag(String legacyTag) =>
      switch (legacyTag.trim().toLowerCase()) {
        'technology' => CanonicalTopicKey.technologyAi,
        'environment' => CanonicalTopicKey.scienceClimate,
        'education' => CanonicalTopicKey.educationCampus,
        'society_economics' => CanonicalTopicKey.businessFinance,
        'urbanization' => CanonicalTopicKey.urbanSociety,
        'academic_linking' || 'reading_synonyms' || _ => CanonicalTopicKey.academicCore,
      };

  /// Normalizes and de-duplicates a list of raw favorite topic strings.
  static List<CanonicalTopicKey> normalizeList(List<String> rawTopics) {
    final seen = <CanonicalTopicKey>{};
    final out = <CanonicalTopicKey>[];
    for (final raw in rawTopics) {
      final k = normalize(raw);
      if (seen.add(k)) out.add(k);
    }
    return out;
  }
}
