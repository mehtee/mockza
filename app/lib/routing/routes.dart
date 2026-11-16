// Route builders accept optional positional examMode flags for concise URL construction.
// ignore_for_file: avoid_positional_boolean_parameters

/// Canonical typed path constants used across `GoRouter` and screens per ADR-005.
abstract final class AppRoutes {
  /// Bottom tab branch: Home dashboard (01_*).
  static const String home = '/home';

  /// Bottom tab branch: Practice Hub (02_*, 03_*).
  static const String practice = '/practice';

  /// Bottom tab branch: Vocabulary SRS deck (16_*, 19_*).
  static const String vocabulary = '/vocabulary';

  /// Bottom tab branch: Progress & Analytics (20_*, 21_*).
  static const String progress = '/progress';

  /// Pushed setup onboarding wizard route (23_*, 24_*).
  static const String onboarding = '/onboarding';

  /// Pushed Settings & Account route.
  static const String settings = '/settings';

  /// Pushed Pro Paywall route.
  static const String paywall = '/paywall';

  // --- ADR-005 Parameterized Routes ---

  /// Practice setup parameterized by skill (`/practice/setup/:skill`).
  static const String practiceSetup = '/practice/setup/:skill';

  /// Full mock exam orchestrator (`/practice/full-mock/:mockId`).
  static const String practiceFullMock = '/practice/full-mock/:mockId';

  /// Speaking Simulator fullscreen route (`/speaking/:examId`).
  static const String speakingSim = '/speaking/:examId';

  /// Writing Simulator fullscreen route (`/writing/:taskId`).
  static const String writingSim = '/writing/:taskId';

  /// Reading Simulator fullscreen route (`/reading/:packId`).
  static const String readingSim = '/reading/:packId';

  /// Listening Simulator fullscreen route (`/listening/:packId`).
  static const String listeningSim = '/listening/:packId';

  /// Micro-drill weakness workout route (`/micro-drill/:drillId`).
  static const String microDrill = '/micro-drill/:drillId';

  /// Micro-drills hub route (`/micro-drill`).
  static const String microDrills = '/micro-drill';

  /// Evaluation review route parameterized by attemptId (`/results/:attemptId`).
  static const String attemptReview = '/results/:attemptId';

  /// Vocabulary flashcard review session (`/vocabulary/review`).
  static const String vocabReview = '/vocabulary/review';

  /// Vocabulary word lexical detail (`/vocabulary/:wordId`).
  static const String vocabWordDetail = '/vocabulary/:wordId';

  /// Progress deep dive for a specific skill (`/progress/skill/:skill`).
  static const String progressSkill = '/progress/skill/:skill';

  /// Complete paginated attempt history (`/progress/attempts`).
  static const String progressAttempts = '/progress/attempts';

  // --- Parameterized Path Builders ---

  /// Builds a practice setup path for [skill].
  static String buildPracticeSetup(String skill) => '/practice/setup/$skill';

  /// Builds a full mock exam path for [mockId].
  static String buildPracticeFullMock(String mockId) =>
      '/practice/full-mock/$mockId';

  static String _buildModePath(
    String path,
    bool examMode, {
    String? mockSessionId,
    String? mockStageKey,
    int? taskIndex,
  }) {
    final params = <String, String>{
      if (!examMode) 'mode': 'study',
      if (mockSessionId != null && mockSessionId.isNotEmpty)
        'mockSessionId': mockSessionId,
      if (mockStageKey != null && mockStageKey.isNotEmpty)
        'mockStageKey': mockStageKey,
      if (taskIndex != null) 'taskIndex': '$taskIndex',
    };
    if (params.isEmpty) return path;
    return Uri(path: path, queryParameters: params).toString();
  }

  /// Builds a Speaking simulator path for [examId].
  static String buildSpeakingSim([
    String examId = 'ielts-speaking-seed-01',
    bool examMode = true,
    String? mockSessionId,
    String? mockStageKey,
  ]) => _buildModePath(
    '/speaking/$examId',
    examMode,
    mockSessionId: mockSessionId,
    mockStageKey: mockStageKey,
  );

  /// Builds a Writing simulator path for [taskId].
  static String buildWritingSim([
    String taskId = 'ielts-writing-seed-01',
    bool examMode = true,
    String? mockSessionId,
    String? mockStageKey,
    int? taskIndex,
  ]) => _buildModePath(
    '/writing/$taskId',
    examMode,
    mockSessionId: mockSessionId,
    mockStageKey: mockStageKey,
    taskIndex: taskIndex,
  );

  /// Builds a Reading simulator path for [packId].
  static String buildReadingSim([
    String packId = 'ielts-acad-reading-seed-01',
    bool examMode = true,
    String? mockSessionId,
    String? mockStageKey,
  ]) => _buildModePath(
    '/reading/$packId',
    examMode,
    mockSessionId: mockSessionId,
    mockStageKey: mockStageKey,
  );

  /// Builds a Listening simulator path for [packId].
  static String buildListeningSim([
    String packId = 'ielts-listening-seed-01',
    bool examMode = true,
    String? mockSessionId,
    String? mockStageKey,
  ]) => _buildModePath(
    '/listening/$packId',
    examMode,
    mockSessionId: mockSessionId,
    mockStageKey: mockStageKey,
  );

  /// Builds a micro-drill path for [drillId].
  static String buildMicroDrill([String drillId = 'ielts-micro-drill-01']) =>
      '/micro-drill/$drillId';

  /// Builds a progress skill deep-dive path for [skill].
  static String buildProgressSkill(String skill) => '/progress/skill/$skill';

  /// Builds an evaluation review path for [attemptId].
  static String buildAttemptReview(String attemptId) => '/results/$attemptId';

  /// Builds a vocabulary word detail path for [wordId].
  static String buildVocabWordDetail(String wordId) => '/vocabulary/$wordId';
}
