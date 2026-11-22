import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/exams/exam_descriptor.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/exams/study_metrics_calculator.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/data/repositories/exam_catalog_repository.dart';
import 'package:mockza/data/repositories/progress_repository.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/services/personalization_gateway.dart';

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
    this.studyFocus = 'both',
    this.resumeSpeakingRoute,
    this.daysUntilExam,
    this.latestDiagnosticId,
    this.latestDiagnosticStatus,
    this.personalization,
    this.bandShiftDismissed = false,
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

  /// Learner study focus from onboarding/settings (`exams`, `coach`, or `both`).
  final String studyFocus;

  /// Route to validated local Speaking recovery, when a session is pending.
  final String? resumeSpeakingRoute;

  /// Days remaining until test date, or null if unset.
  final int? daysUntilExam;

  /// Most recent rapid diagnostic session UUID, if any.
  final String? latestDiagnosticId;

  /// Status of [latestDiagnosticId] (`in_progress`, `submitted`, `completed`).
  final String? latestDiagnosticStatus;

  /// Cached + server-refreshed personalization, live band & roadmap snapshot.
  final PersonalizationStateDto? personalization;

  /// Local optimistic dismissal flag for band-shift celebration banner.
  final bool bandShiftDismissed;

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
    String? studyFocus,
    String? resumeSpeakingRoute,
    bool clearResumeSpeakingRoute = false,
    int? daysUntilExam,
    bool clearDaysUntilExam = false,
    String? latestDiagnosticId,
    String? latestDiagnosticStatus,
    PersonalizationStateDto? personalization,
    bool? bandShiftDismissed,
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
    studyFocus: studyFocus ?? this.studyFocus,
    resumeSpeakingRoute: clearResumeSpeakingRoute
        ? null
        : resumeSpeakingRoute ?? this.resumeSpeakingRoute,
    daysUntilExam: clearDaysUntilExam
        ? null
        : (daysUntilExam ?? this.daysUntilExam),
    latestDiagnosticId: latestDiagnosticId ?? this.latestDiagnosticId,
    latestDiagnosticStatus:
        latestDiagnosticStatus ?? this.latestDiagnosticStatus,
    personalization: personalization ?? this.personalization,
    bandShiftDismissed: bandShiftDismissed ?? this.bandShiftDismissed,
  );
}

/// Coordinates live Home Dashboard state from Drift streams & domain calculators.
class HomeNotifier extends Notifier<HomeState> {
  StreamSubscription<dynamic>? _attemptsSub;
  StreamSubscription<dynamic>? _profileSub;
  StreamSubscription<dynamic>? _progressSub;
  StreamSubscription<dynamic>? _packsSub;
  StreamSubscription<dynamic>? _diagSub;

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
            studyFocus: profile.studyFocus,
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
        studyFocus: profile.studyFocus,
        daysUntilExam: daysUntil,
        clearDaysUntilExam: profile.targetDateSerial == null,
      );
      _recomputeDashboard();
      unawaited(_loadPersonalization());
    } on Object {
      // Ignore in isolated widget tests without database plugin.
    }
  }

  Future<void> _loadPersonalization() async {
    try {
      final repo = ref.read(personalizationRepositoryProvider);
      final cached = await repo.getCachedState();
      if (cached != null) {
        state = state.copyWith(personalization: cached);
      }
      final remote = await ref.read(personalizationGatewayProvider).getState();
      final fresh = remote.valueOrNull;
      if (fresh != null) {
        await repo.cacheState(fresh);
        state = state.copyWith(personalization: fresh);
      }
    } on Object {
      // Safe no-op in offline/isolated tests.
    }
  }

  void _listenToStreams() {
    final attemptRepo = ref.read(attemptRepositoryProvider);
    final progressRepo = ref.read(progressRepositoryProvider);
    final catalogRepo = ref.read(examCatalogRepositoryProvider);

    _attemptsSub = attemptRepo.watchRecentAttempts(limit: 500).listen(
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

    _diagSub = attemptRepo.watchLatestDiagnosticSession().listen(
      (row) {
        if (row == null) return;
        state = state.copyWith(
          latestDiagnosticId: row.diagId,
          latestDiagnosticStatus: row.status,
        );
      },
      onError: (_) {},
    );
  }

  bool _matchesActiveScale(AttemptSummary a) {
    final attemptTrack = ExamTrack.fromId(a.examId);
    if (state.track.isIelts && attemptTrack.isIelts) return true;
    return attemptTrack == state.track;
  }

  void _recomputeDashboard() {
    final clock = ref.read(clockProvider);
    final now = clock.now();
    final today = SerialDay.fromUtcDateTime(now);
    final nowUtcMs = now.toUtc().millisecondsSinceEpoch;

    final trackAttempts = _latestAttempts
        .where((a) => a.countsTowardCalibratedBand && _matchesActiveScale(a))
        .toList(growable: false);

    final scoredAttempts = trackAttempts
        .map(
          (a) => (
            score: a.overallBand!,
            skill: a.skill,
            completedAtUtcMs: a.effectiveCompletedAtUtcMs,
          ),
        )
        .toList(growable: false);

    final estimated = StudyMetricsCalculator.calculateEstimatedOverallBand(
      scoredAttempts: scoredAttempts,
      track: state.track,
      targetBand: state.targetBand,
      currentUtcMs: nowUtcMs,
    );

    final skillList = trackAttempts
        .map((a) => (score: a.overallBand!, skill: a.skill))
        .toList(growable: false);
    final skillMetrics = StudyMetricsCalculator.calculateSkillMetrics(
      attempts: skillList,
      track: state.track,
    );

    final studyDays = <SerialDay>{
      for (final log in _latestLogs)
        if (log.studySeconds > 0 || log.completedItems > 0) log.serialDay,
      for (final a in _latestAttempts)
        SerialDay.fromUtcDateTime(
          DateTime.fromMillisecondsSinceEpoch(
            a.effectiveCompletedAtUtcMs,
            isUtc: true,
          ),
        ),
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
    final pendingSpeaking = _latestAttempts
        .where(
          (attempt) =>
              attempt.skill == SkillKind.speaking &&
              attempt.status == AttemptStatus.inProgress &&
              attempt.mockSessionId == null &&
              _matchesActiveScale(attempt) &&
              _latestPacks.any(
                (pack) => pack.packId == attempt.packId && pack.isCachedOffline,
              ),
        )
        .firstOrNull;

    state = state.copyWith(
      estimatedSummary: estimated,
      skillMetrics: skillMetrics,
      streakDays: streak,
      studyWeek: studyWeek,
      recommendedTitle: recommendation.title,
      recommendedSubtitle: recommendation.subtitle,
      recommendedRoute: recommendation.route,
      clearResumeSpeakingRoute: pendingSpeaking == null,
      resumeSpeakingRoute: pendingSpeaking == null
          ? null
          : AppRoutes.buildSpeakingSim(
              pendingSpeaking.packId,
              !pendingSpeaking.usedStudyMode,
            ),
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
      final sentinel = state.track.maxScore + 1;
      final sorted = [...coreMetrics]
        ..sort(
          (a, b) => (a.score ?? sentinel).compareTo(b.score ?? sentinel),
        );
      final weakest = sorted.first;
      targetSkill = weakest.skill;
      final scoreStr = weakest.score != null
          ? state.track.formatScore(weakest.score!)
          : '—';
      reason =
          'Your lowest skill is ${targetSkill.name} ($scoreStr). Raise it to reach your target.';
    }

    final descriptor = ExamDescriptor.forTrack(state.track);
    final defaultPackId = descriptor.defaultPackIdForSkill(targetSkill);

    final matchingPack = _latestPacks.cast<InstalledExamPack?>().firstWhere(
      (p) =>
          p != null &&
          p.skill == targetSkill &&
          p.track == state.track.catalogTrack,
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
    unawaited(_diagSub?.cancel());
  }

  /// Persists band-shift banner dismissal remotely and clears locally.
  Future<void> acknowledgeBandShift() async {
    state = state.copyWith(bandShiftDismissed: true);
    try {
      await ref.read(personalizationGatewayProvider).ackBandShift();
      await _loadPersonalization();
    } on Object {
      // Safe offline fallback.
    }
  }

  /// Changes the active exam track from the header chip and persists to SQLite.
  void setTrack(ExamTrack track) {
    final nextTarget = track.nextTargetWhenSwitchingFrom(
      state.track,
      state.targetBand,
    );
    state = state.copyWith(track: track, targetBand: nextTarget);
    _recomputeDashboard();
    unawaited(_persistTrack(track, nextTarget));
  }

  Future<void> _persistTrack(ExamTrack track, double targetBand) async {
    try {
      final profileRepo = ref.read(profileRepositoryProvider);
      final primary = await profileRepo.loadOrInitializePrimary();
      final module = track == ExamTrack.ieltsGeneral
          ? ExamModuleType.generalTraining
          : ExamModuleType.academic;
      await profileRepo.saveTargetPreferences(
        deviceId: primary.deviceId,
        targetBand: targetBand,
        examModule: module,
        examId: track.id,
        targetDateSerial: primary.targetDateSerial,
      );
    } on Object {
      // Ignore in isolated widget tests without database plugin.
    }
  }
}
