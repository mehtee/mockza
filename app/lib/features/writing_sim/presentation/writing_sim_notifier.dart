import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/exams/countdown_clock_tracker.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/exams/local_objective_scorer.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/models/writing_evaluation.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/providers.dart';

final class _WritingSaveSnapshot {
  const new({
    required this.draftKey,
    required this.packId,
    required this.taskType,
    required this.text,
    required this.wordCount,
    required this.remainingSeconds,
    required this.generation,
  });

  final String draftKey;
  final String packId;
  final String taskType;
  final String text;
  final int wordCount;
  final int remainingSeconds;
  final int generation;
}

/// Immutable UI state for Writing Task 1 / Task 2 draft editor (Screens 06 & 07).
@immutable
class WritingSimState {
  /// Creates a [WritingSimState].
  const new({
    required this.packId,
    required this.isExamMode,
    required this.isLoadingPack,
    required this.tasks,
    required this.activeTaskIndex,
    required this.taskType,
    required this.draftText,
    required this.draftSyncNonce,
    required this.remainingSeconds,
    required this.totalSeconds,
    required this.isPaused,
    required this.promptTitle,
    required this.promptDescription,
    required this.minimumWordCount,
    required this.lastSavedText,
    required this.isSubmitting,
    this.isEphemeralStorage = false,
    this.chartSvg,
    this.chartCaption,
    this.errorMessage,
  });

  /// Active Postgres writing pack identifier.
  final String packId;

  /// Exam Mode (no autocorrect/pause) vs Study Mode.
  final bool isExamMode;

  /// Whether pack tasks are loading from Drift/Postgres.
  final bool isLoadingPack;

  /// Tasks loaded from the pack (`Task 1`, `Task 2`).
  final List<WritingTaskSpec> tasks;

  /// Index of active task in [tasks].
  final int activeTaskIndex;

  /// Active IELTS Writing task type.
  final WritingTaskType taskType;

  /// Current essay draft content.
  final String draftText;

  /// Monotonically increasing counter prompting editor controller refresh.
  final int draftSyncNonce;

  /// Remaining seconds on active countdown.
  final int remainingSeconds;

  /// Total seconds for active task (1200s Task 1, 2400s Task 2).
  final int totalSeconds;

  /// Whether Study Mode countdown is paused.
  final bool isPaused;

  /// Prompt headline title.
  final String promptTitle;

  /// Full rubric prompt instructions.
  final String promptDescription;

  /// Official minimum word count (150 or 250).
  final int minimumWordCount;

  /// Relative autosave status text.
  final String lastSavedText;

  /// Whether AI evaluation enqueueing is in flight.
  final bool isSubmitting;

  /// Optional SeaweedFS SVG asset path or inline SVG markup for Task 1 Academic.
  final String? chartSvg;

  /// Optional chart figure caption.
  final String? chartCaption;

  /// Non-fatal load/submit error feedback.
  final String? errorMessage;

  /// Whether local storage degraded to volatile RAM (`RR-07`).
  final bool isEphemeralStorage;

  /// Live word count computed cleanly.
  int get wordCount => LocalObjectiveScorer.countWords(draftText);

  /// Whether word count meets official minimum.
  bool get meetsWordMinimum => wordCount >= minimumWordCount;

  /// True when strict Exam Mode countdown has expired (`TD-37`).
  bool get isTimeExpired => isExamMode && remainingSeconds <= 0;

  /// Returns a copy with updated writing state.
  WritingSimState copyWith({
    String? packId,
    bool? isExamMode,
    bool? isLoadingPack,
    List<WritingTaskSpec>? tasks,
    int? activeTaskIndex,
    WritingTaskType? taskType,
    String? draftText,
    int? draftSyncNonce,
    int? remainingSeconds,
    int? totalSeconds,
    bool? isPaused,
    String? promptTitle,
    String? promptDescription,
    int? minimumWordCount,
    String? lastSavedText,
    bool? isSubmitting,
    bool? isEphemeralStorage,
    String? chartSvg,
    bool clearChartSvg = false,
    String? chartCaption,
    bool clearChartCaption = false,
    String? errorMessage,
    bool clearError = false,
  }) => WritingSimState(
    packId: packId ?? this.packId,
    isExamMode: isExamMode ?? this.isExamMode,
    isLoadingPack: isLoadingPack ?? this.isLoadingPack,
    tasks: tasks ?? this.tasks,
    activeTaskIndex: activeTaskIndex ?? this.activeTaskIndex,
    taskType: taskType ?? this.taskType,
    draftText: draftText ?? this.draftText,
    draftSyncNonce: draftSyncNonce ?? this.draftSyncNonce,
    remainingSeconds: remainingSeconds ?? this.remainingSeconds,
    totalSeconds: totalSeconds ?? this.totalSeconds,
    isPaused: isPaused ?? this.isPaused,
    promptTitle: promptTitle ?? this.promptTitle,
    promptDescription: promptDescription ?? this.promptDescription,
    minimumWordCount: minimumWordCount ?? this.minimumWordCount,
    lastSavedText: lastSavedText ?? this.lastSavedText,
    isSubmitting: isSubmitting ?? this.isSubmitting,
    isEphemeralStorage: isEphemeralStorage ?? this.isEphemeralStorage,
    chartSvg: clearChartSvg ? null : (chartSvg ?? this.chartSvg),
    chartCaption: clearChartCaption
        ? null
        : (chartCaption ?? this.chartCaption),
    errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
  );
}

/// Manages Writing pack loading, per-task debounced Drift autosave, countdown,
/// SeaweedFS chart display, and remote AI grading submission.
class WritingSimNotifier extends Notifier<WritingSimState> {
  Timer? _countdownTimer;
  Timer? _autosaveDebounce;
  CountdownClockTracker? _clockTracker;
  DateTime? _sessionStartTime;
  bool _isDisposed = false;
  int _lastPersistedRemainingSec = -1;
  Future<void>? _pendingSave;
  late AttemptRepository _attemptRepo;
  String? _mockSessionId;
  String? _mockStageKey;

  final Map<int, String> _draftsByIndex = <int, String>{};
  final Map<int, int> _remainingByIndex = <int, int>{};
  final Map<String, int> _draftGenerationByKey = <String, int>{};
  final Map<String, int> _closedGenerationByKey = <String, int>{};

  @override
  WritingSimState build() {
    _isDisposed = false;
    final clock = ref.read(clockProvider);
    _attemptRepo = ref.read(attemptRepositoryProvider);
    _sessionStartTime = clock.now();
    _clockTracker = CountdownClockTracker(clock: clock);
    ref.onDispose(() {
      _isDisposed = true;
      _countdownTimer?.cancel();
      _autosaveDebounce?.cancel();
    });

    return WritingSimState(
      packId: 'ielts-writing-seed-01',
      isExamMode: true,
      isLoadingPack: false,
      tasks: const <WritingTaskSpec>[],
      activeTaskIndex: 0,
      taskType: WritingTaskType.task2Essay,
      draftText: '',
      draftSyncNonce: 0,
      remainingSeconds: 2400,
      totalSeconds: 2400,
      isPaused: false,
      promptTitle: 'Writing Assessment',
      promptDescription: 'Loading writing prompt...',
      minimumWordCount: 250,
      lastSavedText: 'Ready',
      isSubmitting: false,
      isEphemeralStorage: ref.read(isDatabaseEphemeralProvider),
    );
  }

  /// Fetches Writing tasks for [packId] from Drift/Postgres and restores drafts.
  Future<void> initialize(
    String packId, {
    bool isExamMode = true,
    String? mockSessionId,
    String? mockStageKey,
    int initialTaskIndex = 0,
  }) async {
    _mockSessionId = mockSessionId;
    _mockStageKey = mockStageKey;
    _countdownTimer?.cancel();
    _autosaveDebounce?.cancel();
    _draftsByIndex.clear();
    _remainingByIndex.clear();
    _draftGenerationByKey.clear();
    _closedGenerationByKey.clear();
    _sessionStartTime = ref.read(clockProvider).now();

    state = state.copyWith(
      packId: packId,
      isExamMode: isExamMode,
      isLoadingPack: true,
      isPaused: false,
      clearError: true,
    );

    try {
      final sync = ref.read(contentSyncServiceProvider);
      final catalog = ref.read(examCatalogRepositoryProvider);
      final attemptRepo = ref.read(attemptRepositoryProvider);
      final bundleRes = await sync.ensureExamBundle(packId);
      if (_isDisposed) return;

      if (bundleRes.isFailure) {
        state = state.copyWith(
          isLoadingPack: false,
          errorMessage:
              'Could not load Writing pack "$packId": ${bundleRes.failureOrNull?.message}.',
        );
        return;
      }

      final tasks = catalog.parseWritingTasks(bundleRes.valueOrNull!);
      if (tasks.isEmpty) {
        state = state.copyWith(
          isLoadingPack: false,
          errorMessage: 'No writing tasks found in pack "$packId".',
        );
        return;
      }

      for (var i = 0; i < tasks.length; i++) {
        final t = tasks[i];
        final stableKey = _draftKey(packId, t);
        var saved = await attemptRepo.getWritingDraft(stableKey);
        saved ??= await attemptRepo.getWritingDraft(
          _legacyDraftKey(packId, i),
        );
        if (_isDisposed) return;
        _draftsByIndex[i] = saved?.draftText ?? '';
        // Preserve zero remaining time across reloads (`TD-37`).
        _remainingByIndex[i] = saved != null
            ? saved.timerRemainingSec.clamp(0, t.recommendedSeconds)
            : t.recommendedSeconds;
      }

      state = state.copyWith(
        isLoadingPack: false,
        tasks: tasks,
        clearError: true,
      );
      _activateTaskIndex(initialTaskIndex.clamp(0, tasks.length - 1));
    } on Object catch (err) {
      if (_isDisposed) return;
      state = state.copyWith(
        isLoadingPack: false,
        errorMessage: 'Failed to load Writing pack: $err',
      );
    }
  }

  String _draftKey(String packId, WritingTaskSpec spec) =>
      'draft-$packId-${spec.taskId}';

  String _legacyDraftKey(String packId, int taskIndex) =>
      'draft-$packId-$taskIndex';

  String _activeDraftKey() {
    final idx = state.activeTaskIndex;
    if (idx >= 0 && idx < state.tasks.length) {
      return _draftKey(state.packId, state.tasks[idx]);
    }
    return _legacyDraftKey(state.packId, idx);
  }

  void _activateTaskIndex(int index) {
    if (index < 0 || index >= state.tasks.length) return;
    final spec = state.tasks[index];
    final taskType = _parseTaskType(spec.taskType);
    final savedText = _draftsByIndex[index] ?? '';
    final remSecs = _remainingByIndex[index] ?? spec.recommendedSeconds;
    _lastPersistedRemainingSec = remSecs;

    (_clockTracker ??= CountdownClockTracker(
      clock: ref.read(clockProvider),
    )).start(
      remainingSeconds: remSecs,
      totalSeconds: spec.recommendedSeconds,
    );
    if (state.isPaused) {
      _clockTracker?.pause();
    }

    state = state.copyWith(
      activeTaskIndex: index,
      taskType: taskType,
      draftText: savedText,
      draftSyncNonce: state.draftSyncNonce + 1,
      remainingSeconds: remSecs,
      totalSeconds: spec.recommendedSeconds,
      promptTitle: spec.title,
      promptDescription: spec.promptBody,
      minimumWordCount: spec.minWords,
      chartSvg: spec.chartSvg,
      clearChartSvg: spec.chartSvg == null || spec.chartSvg!.isEmpty,
      chartCaption: spec.chartCaption,
      clearChartCaption:
          spec.chartCaption == null || spec.chartCaption!.isEmpty,
      lastSavedText: savedText.isNotEmpty
          ? 'Restored draft'
          : (remSecs == 0 && state.isExamMode ? 'Time expired' : 'Ready'),
    );
    if (!state.isPaused && remSecs > 0) {
      _startCountdown();
    }
  }

  WritingTaskType _parseTaskType(String raw) => switch (raw) {
    'task1Academic' || 'task1_academic' => WritingTaskType.task1Academic,
    'task1General' || 'task1_general' => WritingTaskType.task1General,
    _ => WritingTaskType.task2Essay,
  };

  void _startCountdown() {
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(
      const Duration(milliseconds: 500),
      (timer) {
        if (_isDisposed || state.isPaused) {
          timer.cancel();
          return;
        }
        reconcileTimer();
      },
    );
  }

  /// Reconciles remaining exam time against wall clock on ticks and lifecycle resume (`TD-37`).
  void reconcileTimer() {
    final tracker = _clockTracker;
    if (_isDisposed || tracker == null || state.isPaused) return;
    final nextSec = tracker.currentRemaining();
    _remainingByIndex[state.activeTaskIndex] = nextSec;
    if (nextSec != state.remainingSeconds) {
      state = state.copyWith(remainingSeconds: nextSec);
    }
    if (nextSec == 0) {
      _countdownTimer?.cancel();
      unawaited(flushAutosaveNow());
    } else if (_lastPersistedRemainingSec < 0 ||
        (_lastPersistedRemainingSec - nextSec).abs() >= 10) {
      // Periodically persist remaining time even when untouched (`TD-39`).
      _lastPersistedRemainingSec = nextSec;
      unawaited(flushAutosaveNow());
    }
  }

  /// Toggles Study Mode countdown pause/resume.
  void togglePause() {
    if (state.isExamMode) return;
    final tracker = _clockTracker ??= CountdownClockTracker(
      clock: ref.read(clockProvider),
    );
    final nextPaused = !state.isPaused;
    if (nextPaused) {
      final rem = tracker.pause();
      _remainingByIndex[state.activeTaskIndex] = rem;
      _countdownTimer?.cancel();
      state = state.copyWith(isPaused: true, remainingSeconds: rem);
      unawaited(flushAutosaveNow());
    } else {
      tracker.resume();
      state = state.copyWith(isPaused: false);
      _startCountdown();
    }
  }

  /// Switches active writing task (`0` for Task 1, `1` for Task 2).
  void selectTaskIndex(int index) {
    if (index == state.activeTaskIndex) return;
    unawaited(flushAutosaveNow());
    _activateTaskIndex(index);
  }

  /// Updates the active draft text and triggers a 500ms debounced autosave.
  void updateDraft(String text) {
    if (state.isTimeExpired) return;
    final idx = state.activeTaskIndex;
    _draftsByIndex[idx] = text;
    state = state.copyWith(draftText: text, clearError: true);

    _autosaveDebounce?.cancel();
    _autosaveDebounce = Timer(const Duration(milliseconds: 500), () {
      unawaited(flushAutosaveNow());
    });
  }

  /// Serializes and flushes an immutable snapshot of the current writing draft + timer (`RR-08`).
  Future<void> flushAutosaveNow() async {
    _autosaveDebounce?.cancel();
    if (_isDisposed || state.tasks.isEmpty) return;

    final idx = state.activeTaskIndex;
    final remSec = _clockTracker?.currentRemaining() ?? state.remainingSeconds;
    _remainingByIndex[idx] = remSec;
    final draftKey = _activeDraftKey();
    final textToSave = _draftsByIndex[idx] ?? state.draftText;
    final nextGen = (_draftGenerationByKey[draftKey] ?? 0) + 1;
    _draftGenerationByKey[draftKey] = nextGen;

    // Close over immutable snapshot and repository BEFORE any await (`RR-08`).
    final snapshot = _WritingSaveSnapshot(
      draftKey: draftKey,
      packId: state.packId,
      taskType: state.taskType.name,
      text: textToSave,
      wordCount: LocalObjectiveScorer.countWords(textToSave),
      remainingSeconds: remSec,
      generation: nextGen,
    );
    final attemptRepo = _attemptRepo;
    final previous = _pendingSave;

    final future = () async {
      if (previous != null) {
        try {
          await previous;
        } on Object {
          // Proceed with captured outgoing snapshot.
        }
      }
      if (_isDisposed) return;
      if ((_closedGenerationByKey[snapshot.draftKey] ?? -1) >=
          snapshot.generation) {
        return;
      }

      try {
        await attemptRepo.saveWritingDraft(
          attemptId: snapshot.draftKey,
          packId: snapshot.packId,
          taskType: snapshot.taskType,
          draftText: snapshot.text,
          wordCount: snapshot.wordCount,
          timerRemainingSec: snapshot.remainingSeconds,
        );
        _lastPersistedRemainingSec = snapshot.remainingSeconds;
        if (!_isDisposed &&
            (_closedGenerationByKey[snapshot.draftKey] ?? -1) <
                snapshot.generation) {
          state = state.copyWith(lastSavedText: 'Autosaved locally');
        }
      } on MissingPluginException {
        // Headless widget tests without database channels.
      } on Object catch (err) {
        if (!_isDisposed) {
          state = state.copyWith(
            lastSavedText: 'Autosave failed — check storage',
            errorMessage: 'Could not save draft locally: $err',
          );
        }
      }
    }();
    _pendingSave = future;
    await future;
  }

  /// Persists the essay atomically before remote submission and returns the `attemptId`.
  Future<String?> submitWriting() async {
    if (state.isSubmitting) return null;
    final trimmed = state.draftText.trim();
    if (trimmed.isEmpty) {
      state = state.copyWith(
        errorMessage: 'Write your essay response before submitting.',
      );
      return null;
    }

    _countdownTimer?.cancel();
    _autosaveDebounce?.cancel();
    final draftKey = _activeDraftKey();
    final closedGen = (_draftGenerationByKey[draftKey] ?? 0) + 1;
    _draftGenerationByKey[draftKey] = closedGen;
    _closedGenerationByKey[draftKey] = closedGen;
    state = state.copyWith(isSubmitting: true, clearError: true);

    final attemptRepo = _attemptRepo;
    final gradingGateway = ref.read(gradingGatewayProvider);
    final profileRepo = ref.read(profileRepositoryProvider);
    final authSession = ref.read(authSessionServiceProvider);
    final progressRepo = ref.read(progressRepositoryProvider);
    final entropy = ref.read(entropySourceProvider);

    final pending = _pendingSave;
    if (pending != null) {
      try {
        await pending;
      } on Object {
        // Ignore prior save errors during final submission.
      }
    }

    final attemptId = entropy.nextUuidV4();
    final remNow = _clockTracker?.currentRemaining() ?? state.remainingSeconds;
    final durationSeconds = (state.totalSeconds - remNow).clamp(5, 7200);
    final wordCount = state.wordCount;

    try {
      final profile = await profileRepo.loadOrInitializePrimary();
      final examId = profile.examId == 'ielts_general'
          ? 'ielts_general'
          : 'ielts_academic';

      final submissionJson = jsonEncode({
        'packId': state.packId,
        'taskType': state.taskType.name,
        'promptTitle': state.promptTitle,
        'promptBody': state.promptDescription,
        'essayText': state.draftText,
        'wordCount': wordCount,
        'durationSeconds': durationSeconds,
      });

      final outboxPayload = jsonEncode({
        'attemptId': attemptId,
        'packId': state.packId,
        'taskType': state.taskType.name,
        'examId': examId,
        'promptTitle': state.promptTitle,
        'promptBody': state.promptDescription,
        'essayText': state.draftText,
        'durationSeconds': durationSeconds,
        'wordCount': wordCount,
      });

      final installedPack = await ref
          .read(examCatalogRepositoryProvider)
          .getInstalledPackById(state.packId);
      // Atomically persist attempt, delete draft, and enqueue outbox BEFORE network I/O (`TD-39`, `TD-43`).
      final outboxId = await attemptRepo.saveDurableSubmissionWithOutbox(
        attemptId: attemptId,
        packId: state.packId,
        skill: SkillKind.writing,
        submissionJson: submissionJson,
        actionType: 'submit_writing',
        outboxPayloadJson: outboxPayload,
        examId: examId,
        startedAtUtcMs: _sessionStartTime?.toUtc().millisecondsSinceEpoch,
        durationSeconds: durationSeconds,
        usedStudyMode: !state.isExamMode,
        contentVersion: installedPack?.version,
        mockSessionId: _mockSessionId,
        mockStageKey: _mockStageKey,
        deleteDraftId: draftKey,
      );

      if (_mockSessionId != null && _mockStageKey != null) {
        await attemptRepo.recordMockStageAttempt(
          mockId: _mockSessionId!,
          stageKey: _mockStageKey!,
          attemptId: attemptId,
        );
      }

      await progressRepo.logTodayActivity(
        studySeconds: durationSeconds,
        completedItems: 1,
      );

      await authSession.ensureAuthenticated();

      final enqueueRes = await gradingGateway.enqueueWritingEvaluation(
        attemptId: attemptId,
        packId: state.packId,
        taskType: state.taskType,
        essayText: state.draftText,
        examId: examId,
        promptTitle: state.promptTitle,
        promptBody: state.promptDescription,
        durationSeconds: durationSeconds,
        wordCount: wordCount,
      );

      if (enqueueRes.isSuccess) {
        await attemptRepo.updateAttemptEvaluation(
          attemptId: attemptId,
          status: AttemptStatus.queuedRemote,
          remoteJobId: enqueueRes.valueOrNull,
        );
        if (outboxId != null) {
          await attemptRepo.deleteOutboxItem(outboxId);
        }
      } else {
        ref.read(outboxSyncServiceProvider).notifyWorkEnqueued();
      }

      if (!_isDisposed) {
        state = state.copyWith(isSubmitting: false);
      }
      return attemptId;
    } on Object catch (err) {
      if (!_isDisposed) {
        state = state.copyWith(
          isSubmitting: false,
          errorMessage: 'Failed to submit essay: $err',
        );
      }
      return null;
    }
  }
}
