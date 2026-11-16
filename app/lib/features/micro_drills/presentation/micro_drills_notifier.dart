import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/exams/countdown_clock_tracker.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/exams/local_objective_scorer.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/providers.dart';

/// Immutable UI state for Postgres-synced IELTS micro-drills.
@immutable
class MicroDrillsState {
  /// Creates a [MicroDrillsState].
  const new({
    required this.availableDrills,
    required this.drillSpec,
    required this.currentIndex,
    required this.selectedOption,
    required this.isSubmitted,
    required this.isCorrect,
    required this.remainingSeconds,
    required this.score,
    required this.isFinished,
    this.isLoading = false,
    this.hasSelectedDrill = false,
    this.errorMessage,
  });

  /// All drills currently synced in Drift `CachedDrills`.
  final List<MicroDrillSpec> availableDrills;

  /// Active micro-drill specification when running/completed.
  final MicroDrillSpec? drillSpec;

  /// Current exercise index (`0..items.length - 1`).
  final int currentIndex;

  /// Learner's selected option for the active item.
  final String? selectedOption;

  /// Whether the active answer was submitted for feedback.
  final bool isSubmitted;

  /// Whether the submitted answer matched an accepted answer.
  final bool isCorrect;

  /// Remaining seconds on the drill timer.
  final int remainingSeconds;

  /// Total correct items scored in this drill.
  final int score;

  /// Whether all exercises or timer completed.
  final bool isFinished;

  /// Async catalog fetch/sync indicator.
  final bool isLoading;

  /// True once a specific drill is running (false shows the hub chooser when no ID given).
  final bool hasSelectedDrill;

  /// Non-fatal sync/catalog error notice.
  final String? errorMessage;

  /// Active exercise item when a drill with items is loaded.
  MicroDrillItemSpec? get currentItem {
    final spec = drillSpec;
    if (spec == null ||
        spec.items.isEmpty ||
        currentIndex < 0 ||
        currentIndex >= spec.items.length) {
      return null;
    }
    return spec.items[currentIndex];
  }

  /// Normalized workout progress (`0.0..1.0`).
  double get progress {
    final spec = drillSpec;
    if (spec == null || spec.items.isEmpty) return 0;
    return ((currentIndex + (isFinished ? 1 : 0)) / spec.items.length).clamp(
      0.0,
      1.0,
    );
  }

  /// Copies state with selective overrides.
  MicroDrillsState copyWith({
    List<MicroDrillSpec>? availableDrills,
    MicroDrillSpec? drillSpec,
    bool clearDrillSpec = false,
    int? currentIndex,
    String? selectedOption,
    bool clearSelected = false,
    bool? isSubmitted,
    bool? isCorrect,
    int? remainingSeconds,
    int? score,
    bool? isFinished,
    bool? isLoading,
    bool? hasSelectedDrill,
    String? errorMessage,
    bool clearErrorMessage = false,
  }) => MicroDrillsState(
    availableDrills: availableDrills ?? this.availableDrills,
    drillSpec: clearDrillSpec ? null : (drillSpec ?? this.drillSpec),
    currentIndex: currentIndex ?? this.currentIndex,
    selectedOption: clearSelected
        ? null
        : (selectedOption ?? this.selectedOption),
    isSubmitted: isSubmitted ?? this.isSubmitted,
    isCorrect: isCorrect ?? this.isCorrect,
    remainingSeconds: remainingSeconds ?? this.remainingSeconds,
    score: score ?? this.score,
    isFinished: isFinished ?? this.isFinished,
    isLoading: isLoading ?? this.isLoading,
    hasSelectedDrill: hasSelectedDrill ?? this.hasSelectedDrill,
    errorMessage: clearErrorMessage
        ? null
        : (errorMessage ?? this.errorMessage),
  );
}

/// Coordinates IELTS micro-drills synced from PostgreSQL `drills` table.
class MicroDrillsNotifier extends Notifier<MicroDrillsState> {
  Timer? _timer;
  CountdownClockTracker? _clockTracker;
  bool _isDisposed = false;
  bool _attemptRecorded = false;

  @override
  MicroDrillsState build() {
    _isDisposed = false;
    _clockTracker = CountdownClockTracker(clock: ref.read(clockProvider));
    ref.onDispose(() {
      _isDisposed = true;
      _timer?.cancel();
    });
    return const MicroDrillsState(
      availableDrills: <MicroDrillSpec>[],
      drillSpec: null,
      currentIndex: 0,
      selectedOption: null,
      isSubmitted: false,
      isCorrect: false,
      remainingSeconds: 180,
      score: 0,
      isFinished: false,
      isLoading: true,
    );
  }

  /// Loads synced drills from Drift (syncing from backend if cache empty or [forceSync] set).
  Future<void> loadDrill(String drillId, {bool forceSync = false}) async {
    _timer?.cancel();
    _attemptRecorded = false;
    if (_isDisposed) return;

    state = state.copyWith(
      isLoading: true,
      clearErrorMessage: true,
    );

    final catalogRepo = ref.read(examCatalogRepositoryProvider);
    var drills = await catalogRepo.watchDrills().first;

    if (drills.isEmpty || forceSync) {
      await ref.read(authSessionServiceProvider).ensureAuthenticated();
      await ref
          .read(contentSyncServiceProvider)
          .syncAllCatalogData(forceRefresh: forceSync);
      drills = await catalogRepo.watchDrills().first;
    }

    if (_isDisposed) return;

    if (drills.isEmpty) {
      state = state.copyWith(
        availableDrills: const <MicroDrillSpec>[],
        clearDrillSpec: true,
        isLoading: false,
        hasSelectedDrill: false,
        errorMessage: 'No micro-drills cached yet. Connect to internet and tap Sync Drills.',
      );
      return;
    }

    final cleanId = drillId.trim();
    if (cleanId.isEmpty) {
      // Hub route (`/micro-drill`): let learner choose any synced drill.
      state = state.copyWith(
        availableDrills: drills,
        clearDrillSpec: true,
        isLoading: false,
        hasSelectedDrill: false,
        clearSelected: true,
        currentIndex: 0,
        isSubmitted: false,
        isCorrect: false,
        score: 0,
        isFinished: false,
      );
      return;
    }

    final byId = await catalogRepo.getDrillById(cleanId);
    var matched = byId;
    if (matched == null) {
      final cleanLower = cleanId.toLowerCase();
      for (final d in drills) {
        if (d.drillId == cleanId ||
            d.weaknessCode.toLowerCase() == cleanLower) {
          matched = d;
          break;
        }
      }
    }

    if (_isDisposed) return;
    if (matched == null) {
      state = state.copyWith(
        availableDrills: drills,
        clearDrillSpec: true,
        isLoading: false,
        hasSelectedDrill: false,
        clearSelected: true,
        currentIndex: 0,
        isSubmitted: false,
        isCorrect: false,
        score: 0,
        isFinished: false,
        errorMessage:
            'Micro-drill "$cleanId" was not found. Choose a drill below.',
      );
      return;
    }
    _activateDrill(drills: drills, spec: matched);
  }

  /// Starts a specific drill chosen from the Micro-Drills selector list.
  void startSelectedDrill(MicroDrillSpec spec) {
    _activateDrill(available: state.availableDrills, spec: spec);
  }

  void _activateDrill({
    required MicroDrillSpec spec,
    List<MicroDrillSpec>? drills,
    List<MicroDrillSpec>? available,
  }) {
    _timer?.cancel();
    _attemptRecorded = false;
    final list = drills ?? available ?? state.availableDrills;
    state = MicroDrillsState(
      availableDrills: list,
      drillSpec: spec,
      currentIndex: 0,
      selectedOption: null,
      isSubmitted: false,
      isCorrect: false,
      remainingSeconds: spec.durationSeconds,
      score: 0,
      isFinished: spec.items.isEmpty,
      hasSelectedDrill: true,
    );
    if (spec.items.isNotEmpty) {
      (_clockTracker ??= CountdownClockTracker(
        clock: ref.read(clockProvider),
      )).start(remainingSeconds: spec.durationSeconds);
      _startTimer();
    }
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(milliseconds: 500), (timer) {
      if (_isDisposed) {
        timer.cancel();
        return;
      }
      reconcileTimer();
    });
  }

  /// Synchronizes drill countdown against wall clock (`TD-37`).
  void reconcileTimer() {
    final tracker = _clockTracker;
    if (_isDisposed || tracker == null || state.isFinished) return;
    final rem = tracker.currentRemaining();
    if (rem <= 0) {
      _timer?.cancel();
      state = state.copyWith(remainingSeconds: 0, isFinished: true);
      unawaited(_recordAttempt());
    } else if (rem != state.remainingSeconds) {
      state = state.copyWith(remainingSeconds: rem);
    }
  }

  /// Selects an answer choice.
  void selectOption(String option) {
    if (state.isSubmitted || state.isFinished) return;
    state = state.copyWith(selectedOption: option);
  }

  /// Grades the current option immediately.
  void submitAnswer() {
    final option = state.selectedOption;
    final item = state.currentItem;
    if (option == null ||
        item == null ||
        state.isSubmitted ||
        state.isFinished) {
      return;
    }

    final normalized = LocalObjectiveScorer.normalize(option);
    final isCorrect = item.acceptedAnswers.any(
      (accepted) => LocalObjectiveScorer.normalize(accepted) == normalized,
    );

    state = state.copyWith(
      isSubmitted: true,
      isCorrect: isCorrect,
      score: isCorrect ? state.score + 1 : state.score,
    );
  }

  /// Advances to the next exercise or finishes and persists the workout.
  void nextItem() {
    final spec = state.drillSpec;
    if (spec == null) return;
    if (state.currentIndex + 1 < spec.items.length) {
      state = state.copyWith(
        currentIndex: state.currentIndex + 1,
        clearSelected: true,
        isSubmitted: false,
        isCorrect: false,
      );
    } else {
      _timer?.cancel();
      state = state.copyWith(isFinished: true);
      unawaited(_recordAttempt());
    }
  }

  Future<void> _recordAttempt() async {
    final spec = state.drillSpec;
    if (spec == null || spec.items.isEmpty || _attemptRecorded) return;
    _attemptRecorded = true;

    final attemptRepo = ref.read(attemptRepositoryProvider);
    final progressRepo = ref.read(progressRepositoryProvider);
    final entropy = ref.read(entropySourceProvider);
    final clock = ref.read(clockProvider);

    final now = clock.now().toUtc();
    final elapsedSeconds = (spec.durationSeconds - state.remainingSeconds)
        .clamp(5, 1800);
    final attemptId = entropy.nextUuidV4();

    final normalizedBand = ((state.score / spec.items.length) * 9.0).clamp(
      0.0,
      9.0,
    );

    await attemptRepo.saveLocalSubmission(
      attemptId: attemptId,
      packId: spec.drillId,
      skill: SkillKind.vocabulary,
      submissionJson: jsonEncode(<String, dynamic>{
        'title': spec.title,
        'weaknessCode': spec.weaknessCode,
        'score': state.score,
        'total': spec.items.length,
      }),
      overallBand: double.parse(normalizedBand.toStringAsFixed(1)),
      status: AttemptStatus.scored,
      startedAtUtcMs: now.millisecondsSinceEpoch - (elapsedSeconds * 1000),
      completedAtUtcMs: now.millisecondsSinceEpoch,
      durationSeconds: elapsedSeconds,
      usedStudyMode: true,
    );

    await progressRepo.logTodayActivity(
      studySeconds: elapsedSeconds,
      completedItems: 1,
    );
  }
}
