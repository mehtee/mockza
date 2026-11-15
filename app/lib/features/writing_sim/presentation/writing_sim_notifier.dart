import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/exams/local_objective_scorer.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/models/writing_evaluation.dart';
import 'package:mockza/providers.dart';

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

  /// Live word count computed cleanly.
  int get wordCount => LocalObjectiveScorer.countWords(draftText);

  /// Whether word count meets official minimum.
  bool get meetsWordMinimum => wordCount >= minimumWordCount;

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
  DateTime? _sessionStartTime;
  bool _isDisposed = false;

  final Map<int, String> _draftsByIndex = <int, String>{};
  final Map<int, int> _remainingByIndex = <int, int>{};

  @override
  WritingSimState build() {
    _isDisposed = false;
    _sessionStartTime = ref.read(clockProvider).now();
    ref.onDispose(() {
      _isDisposed = true;
      _countdownTimer?.cancel();
      _autosaveDebounce?.cancel();
    });

    return const WritingSimState(
      packId: 'ielts-writing-seed-01',
      isExamMode: true,
      isLoadingPack: false,
      tasks: <WritingTaskSpec>[],
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
    );
  }

  /// Fetches Writing tasks for [packId] from Drift/Postgres and restores drafts.
  Future<void> initialize(
    String packId, {
    bool isExamMode = true,
  }) async {
    _countdownTimer?.cancel();
    _autosaveDebounce?.cancel();
    _draftsByIndex.clear();
    _remainingByIndex.clear();
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
        final draftKey = _draftKey(packId, i);
        final saved = await attemptRepo.getWritingDraft(draftKey);
        if (_isDisposed) return;
        _draftsByIndex[i] = saved?.draftText ?? '';
        _remainingByIndex[i] = (saved != null && saved.timerRemainingSec > 0)
            ? saved.timerRemainingSec
            : t.recommendedSeconds;
      }

      state = state.copyWith(
        isLoadingPack: false,
        tasks: tasks,
        clearError: true,
      );
      _activateTaskIndex(0);
    } on Object catch (err) {
      if (_isDisposed) return;
      state = state.copyWith(
        isLoadingPack: false,
        errorMessage: 'Failed to load Writing pack: $err',
      );
    }
  }

  String _draftKey(String packId, int taskIndex) => 'draft-$packId-$taskIndex';

  void _activateTaskIndex(int index) {
    if (index < 0 || index >= state.tasks.length) return;
    final spec = state.tasks[index];
    final taskType = _parseTaskType(spec.taskType);
    final savedText = _draftsByIndex[index] ?? '';
    final remSecs = _remainingByIndex[index] ?? spec.recommendedSeconds;

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
      lastSavedText: savedText.isNotEmpty ? 'Restored draft' : 'Ready',
    );
    if (!state.isPaused) {
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
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_isDisposed || state.isPaused) {
        timer.cancel();
        return;
      }
      if (state.remainingSeconds > 0) {
        final nextSec = state.remainingSeconds - 1;
        _remainingByIndex[state.activeTaskIndex] = nextSec;
        state = state.copyWith(remainingSeconds: nextSec);
      } else {
        timer.cancel();
      }
    });
  }

  /// Toggles Study Mode countdown pause/resume.
  void togglePause() {
    if (state.isExamMode) return;
    final nextPaused = !state.isPaused;
    state = state.copyWith(isPaused: nextPaused);
    if (nextPaused) {
      _countdownTimer?.cancel();
    } else {
      _startCountdown();
    }
  }

  /// Switches active writing task (`0` for Task 1, `1` for Task 2).
  void selectTaskIndex(int index) {
    if (index == state.activeTaskIndex) return;
    unawaited(_flushAutosaveNow());
    _activateTaskIndex(index);
  }

  /// Updates the active draft text and triggers a 500ms debounced autosave.
  void updateDraft(String text) {
    final idx = state.activeTaskIndex;
    _draftsByIndex[idx] = text;
    state = state.copyWith(draftText: text, clearError: true);

    _autosaveDebounce?.cancel();
    _autosaveDebounce = Timer(const Duration(milliseconds: 500), () {
      unawaited(_flushAutosaveNow());
    });
  }

  Future<void> _flushAutosaveNow() async {
    try {
      final attemptRepo = ref.read(attemptRepositoryProvider);
      final idx = state.activeTaskIndex;
      await attemptRepo.saveWritingDraft(
        attemptId: _draftKey(state.packId, idx),
        packId: state.packId,
        taskType: state.taskType.name,
        draftText: _draftsByIndex[idx] ?? state.draftText,
        wordCount: state.wordCount,
        timerRemainingSec: state.remainingSeconds,
      );
      if (!_isDisposed) {
        state = state.copyWith(lastSavedText: 'Autosaved locally');
      }
    } on Object {
      // Ignore in isolated widget tests without database plugin.
    }
  }

  /// Submits the active essay draft to `/v1/evaluate/writing` (or outbox when offline)
  /// and returns the real UUIDv4 `attemptId`.
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
    state = state.copyWith(isSubmitting: true, clearError: true);

    final attemptRepo = ref.read(attemptRepositoryProvider);
    final gradingGateway = ref.read(gradingGatewayProvider);
    final profileRepo = ref.read(profileRepositoryProvider);
    final authSession = ref.read(authSessionServiceProvider);
    final progressRepo = ref.read(progressRepositoryProvider);
    final entropy = ref.read(entropySourceProvider);

    final attemptId = entropy.nextUuidV4();
    final draftKey = _draftKey(state.packId, state.activeTaskIndex);
    final durationSeconds = (state.totalSeconds - state.remainingSeconds).clamp(
      5,
      7200,
    );
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

      await attemptRepo.saveLocalSubmission(
        attemptId: attemptId,
        packId: state.packId,
        skill: SkillKind.writing,
        submissionJson: submissionJson,
        examId: examId,
        startedAtUtcMs: _sessionStartTime?.toUtc().millisecondsSinceEpoch,
      );
      await attemptRepo.deleteWritingDraft(draftKey);
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
      } else {
        await attemptRepo.enqueueOutboxAction(
          actionType: 'submit_writing',
          payloadJson: jsonEncode({
            'attemptId': attemptId,
            'packId': state.packId,
            'taskType': state.taskType.name,
            'examId': examId,
            'promptTitle': state.promptTitle,
            'promptBody': state.promptDescription,
            'essayText': state.draftText,
            'durationSeconds': durationSeconds,
            'wordCount': wordCount,
          }),
        );
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
