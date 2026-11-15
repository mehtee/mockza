import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/exams/study_metrics_calculator.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/data/repositories/exam_catalog_repository.dart';
import 'package:mockza/data/repositories/progress_repository.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';

/// Immutable UI state for the Home Dashboard screen (01_*).
@immutable
class HomeState {
  /// Creates a [HomeState].
  const new({
    required this.track,
    required this.targetBand,
    required this.estimatedSummary,
    required this.skillMetrics,
    required this.streakDays,
    required this.studyWeek,
    required this.recommendedTitle,
    required this.recommendedSubtitle,
    required this.recommendedRoute,
    this.daysUntilExam,
  });

  /// Selected exam track (e.g. IELTS Academic).
  final ExamTrack track;

  /// Learner's target band (e.g. 7.5).
  final double targetBand;

  /// Honest estimated overall band calculation.
  final EstimatedBandSummary estimatedSummary;

  /// Four per-skill score summaries.
  final List<SkillScoreSummary> skillMetrics;

  /// Current consecutive days studied.
  final int streakDays;

  /// 7-day study week status tiles.
  final StudyWeekSummary studyWeek;

  /// Primary recommendation action card title.
  final String recommendedTitle;

  /// Primary recommendation description.
  final String recommendedSubtitle;

  /// Navigation route for recommendation card.
  final String recommendedRoute;

  /// Days remaining until test date, or null if unset.
  final int? daysUntilExam;

  /// Returns a copy with updated dashboard properties.
  HomeState copyWith({
    ExamTrack? track,
    double? targetBand,
    EstimatedBandSummary? estimatedSummary,
    List<SkillScoreSummary>? skillMetrics,
    int? streakDays,
    StudyWeekSummary? studyWeek,
    String? recommendedTitle,
    String? recommendedSubtitle,
    String? recommendedRoute,
    int? daysUntilExam,
    bool clearDaysUntilExam = false,
  }) => HomeState(
    track: track ?? this.track,
    targetBand: targetBand ?? this.targetBand,
    estimatedSummary: estimatedSummary ?? this.estimatedSummary,
    skillMetrics: skillMetrics ?? this.skillMetrics,
    streakDays: streakDays ?? this.streakDays,
    studyWeek: studyWeek ?? this.studyWeek,
    recommendedTitle: recommendedTitle ?? this.recommendedTitle,
    recommendedSubtitle: recommendedSubtitle ?? this.recommendedSubtitle,
    recommendedRoute: recommendedRoute ?? this.recommendedRoute,
    daysUntilExam: clearDaysUntilExam
        ? null
        : (daysUntilExam ?? this.daysUntilExam),
  );
}

/// Coordinates live Home Dashboard state from Drift streams & domain calculators.
class HomeNotifier extends Notifier<HomeState> {
  StreamSubscription<dynamic>? _attemptsSub;
  StreamSubscription<dynamic>? _profileSub;
  StreamSubscription<dynamic>? _progressSub;
  StreamSubscription<dynamic>? _packsSub;

  List<AttemptSummary> _latestAttempts = const <AttemptSummary>[];
  List<DailyStudySummary> _latestLogs = const <DailyStudySummary>[];
  List<InstalledExamPack> _latestPacks = const <InstalledExamPack>[];

  @override
  HomeState build() {
    final initial = HomeState(
      track: ExamTrack.ieltsAcademic,
      targetBand: 7.5,
      estimatedSummary: const EstimatedBandSummary.unestimated(
        targetBand: 7.5,
      ),
      skillMetrics: StudyMetricsCalculator.calculateSkillMetrics(
        attempts: const [],
      ),
      streakDays: 0,
      studyWeek: StudyMetricsCalculator.calculateStudyWeek(
        studyDays: const {},
        today: SerialDay.fromUtcDateTime(ref.read(clockProvider).now()),
        weekdayOfToday: ref.read(clockProvider).now().weekday,
      ),
      recommendedTitle: 'Speaking Part 1–3 Simulation',
      recommendedSubtitle: 'Complete a recorded Speaking test to establish your fluency baseline.',
      recommendedRoute: AppRoutes.buildSpeakingSim(),
    );

    unawaited(_loadProfile());
    _listenToStreams();
    ref.onDispose(_cancelSubs);
    return initial;
  }

  Future<void> _loadProfile() async {
    try {
      final profileRepo = ref.read(profileRepositoryProvider);
      final clock = ref.read(clockProvider);
      unawaited(_profileSub?.cancel());
      _profileSub = profileRepo.watchPrimaryProfile().listen(
        (profile) {
          if (profile == null) return;
          final track = ExamTrack.fromId(profile.examId);
          final todaySerial = SerialDay.fromUtcDateTime(clock.now()).value;
          final daysUntil = profile.targetDateSerial != null
              ? (profile.targetDateSerial! - todaySerial).clamp(0, 3650)
              : null;
          state = state.copyWith(
            track: track,
            targetBand: profile.targetBand,
            daysUntilExam: daysUntil,
            clearDaysUntilExam: profile.targetDateSerial == null,
          );
          _recomputeDashboard();
        },
        onError: (_) {},
      );
      final profile = await profileRepo.loadOrInitializePrimary();
      final track = ExamTrack.fromId(profile.examId);
      final todaySerial = SerialDay.fromUtcDateTime(clock.now()).value;
      final daysUntil = profile.targetDateSerial != null
          ? (profile.targetDateSerial! - todaySerial).clamp(0, 3650)
          : null;
      state = state.copyWith(
        track: track,
        targetBand: profile.targetBand,
        daysUntilExam: daysUntil,
        clearDaysUntilExam: profile.targetDateSerial == null,
      );
      _recomputeDashboard();
    } on Object {
      // Ignore in isolated widget tests without database plugin.
    }
  }

  void _listenToStreams() {
    final attemptRepo = ref.read(attemptRepositoryProvider);
    final progressRepo = ref.read(progressRepositoryProvider);
    final catalogRepo = ref.read(examCatalogRepositoryProvider);

    _attemptsSub = attemptRepo.watchRecentAttempts(limit: 100).listen(
      (attempts) {
        _latestAttempts = attempts;
        _recomputeDashboard();
      },
      onError: (_) {},
    );

    _progressSub = progressRepo.watchRecentActivity(limit: 90).listen(
      (logs) {
        _latestLogs = logs;
        _recomputeDashboard();
      },
      onError: (_) {},
    );

    _packsSub = catalogRepo.watchInstalledPacks().listen(
      (packs) {
        _latestPacks = packs;
        _recomputeDashboard();
      },
      onError: (_) {},
    );
  }

  void _recomputeDashboard() {
    final clock = ref.read(clockProvider);
    final now = clock.now();
    final today = SerialDay.fromUtcDateTime(now);
    final nowUtcMs = now.toUtc().millisecondsSinceEpoch;

    final scoredAttempts = _latestAttempts
        .where((a) => a.overallBand != null)
        .map(
          (a) => (
            score: a.overallBand!,
            skill: a.skill,
            completedAtUtcMs: a.updatedAt.millisecondsSinceEpoch,
          ),
        )
        .toList(growable: false);

    final estimated = StudyMetricsCalculator.calculateEstimatedOverallBand(
      scoredAttempts: scoredAttempts,
      track: state.track,
      targetBand: state.targetBand,
      currentUtcMs: nowUtcMs,
    );

    final skillList = _latestAttempts
        .where((a) => a.overallBand != null)
        .map((a) => (score: a.overallBand!, skill: a.skill))
        .toList(growable: false);
    final skillMetrics = StudyMetricsCalculator.calculateSkillMetrics(
      attempts: skillList,
      track: state.track,
    );

    final studyDays = <SerialDay>{
      for (final log in _latestLogs)
        if (log.studySeconds > 0 || log.completedItems > 0) log.serialDay,
      for (final a in _latestAttempts) SerialDay.fromUtcDateTime(a.updatedAt),
    };

    final streak = StudyMetricsCalculator.calculateCurrentStreak(
      studyDays: studyDays,
      today: today,
    );

    final studyWeek = StudyMetricsCalculator.calculateStudyWeek(
      studyDays: studyDays,
      today: today,
      weekdayOfToday: now.weekday,
    );

    final recommendation = _buildRecommendation(skillMetrics);

    state = state.copyWith(
      estimatedSummary: estimated,
      skillMetrics: skillMetrics,
      streakDays: streak,
      studyWeek: studyWeek,
      recommendedTitle: recommendation.title,
      recommendedSubtitle: recommendation.subtitle,
      recommendedRoute: recommendation.route,
    );
  }

  ({String title, String subtitle, String route}) _buildRecommendation(
    List<SkillScoreSummary> skillMetrics,
  ) {
    final coreMetrics = skillMetrics
        .where((m) => m.skill != SkillKind.vocabulary)
        .toList(growable: false);
    var targetSkill = SkillKind.speaking;
    var reason = 'Take a baseline Speaking simulation to calibrate fluency.';

    final untested = coreMetrics.where((m) => m.score == null).toList();
    if (untested.isNotEmpty) {
      targetSkill = untested.first.skill;
      reason =
          'No scored ${targetSkill.name} attempt yet — build your full baseline.';
    } else if (coreMetrics.isNotEmpty) {
      final sorted = [...coreMetrics]
        ..sort((a, b) => (a.score ?? 99).compareTo(b.score ?? 99));
      final weakest = sorted.first;
      targetSkill = weakest.skill;
      final scoreStr = weakest.score?.toStringAsFixed(1) ?? '—';
      reason =
          'Your lowest skill is ${targetSkill.name} ($scoreStr). Raise it to boost your overall band.';
    }

    final isGeneral = state.track == ExamTrack.ieltsGeneral;
    final defaultPackId = switch (targetSkill) {
      SkillKind.speaking => 'ielts-speaking-seed-01',
      SkillKind.writing =>
        isGeneral ? 'ielts-writing-gt-01' : 'ielts-writing-seed-01',
      SkillKind.reading =>
        isGeneral ? 'ielts-gt-reading-seed-01' : 'ielts-acad-reading-seed-01',
      SkillKind.listening => 'ielts-listening-seed-01',
      SkillKind.vocabulary => 'ielts-speaking-seed-01',
    };

    final matchingPack = _latestPacks.cast<InstalledExamPack?>().firstWhere(
      (p) =>
          p != null &&
          p.skill == targetSkill &&
          (!isGeneral || p.track == 'general'),
      orElse: () => null,
    );
    final packId = matchingPack?.packId ?? defaultPackId;
    final title =
        matchingPack?.title ??
        switch (targetSkill) {
          SkillKind.speaking => 'Speaking Part 1–3 Simulation',
          SkillKind.writing => 'Writing Task 1 & 2 Assessment',
          SkillKind.reading => 'Reading Passage & Evidence Drill',
          SkillKind.listening => 'Listening Audio & Comprehension',
          SkillKind.vocabulary => 'Speaking Part 1–3 Simulation',
        };
    final route = switch (targetSkill) {
      SkillKind.speaking => AppRoutes.buildSpeakingSim(packId),
      SkillKind.writing => AppRoutes.buildWritingSim(packId),
      SkillKind.reading => AppRoutes.buildReadingSim(packId),
      SkillKind.listening => AppRoutes.buildListeningSim(packId),
      SkillKind.vocabulary => AppRoutes.vocabulary,
    };

    return (title: title, subtitle: reason, route: route);
  }

  void _cancelSubs() {
    unawaited(_attemptsSub?.cancel());
    unawaited(_profileSub?.cancel());
    unawaited(_progressSub?.cancel());
    unawaited(_packsSub?.cancel());
  }

  /// Changes the active exam track from the header chip and persists to SQLite.
  void setTrack(ExamTrack track) {
    state = state.copyWith(track: track);
    _recomputeDashboard();
    unawaited(_persistTrack(track));
  }

  Future<void> _persistTrack(ExamTrack track) async {
    try {
      final profileRepo = ref.read(profileRepositoryProvider);
      final primary = await profileRepo.loadOrInitializePrimary();
      final module = track == ExamTrack.ieltsGeneral
          ? ExamModuleType.generalTraining
          : ExamModuleType.academic;
      await profileRepo.saveTargetPreferences(
        deviceId: primary.deviceId,
        targetBand: state.targetBand,
        examModule: module,
        examId: track.id,
        targetDateSerial: primary.targetDateSerial,
      );
    } on Object {
      // Ignore in isolated widget tests without database plugin.
    }
  }
}
