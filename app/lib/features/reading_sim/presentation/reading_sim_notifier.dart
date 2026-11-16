import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/exams/countdown_clock_tracker.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/exams/local_objective_scorer.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/providers.dart';

/// Selected passage text range staged for highlighting or note-taking.
@immutable
class StagedTextSelection {
  /// Creates a [StagedTextSelection].
  const new({
    required this.paragraphIndex,
    required this.startOffset,
    required this.endOffset,
    required this.selectedText,
  });

  /// 0-based paragraph index inside the active passage.
  final int paragraphIndex;

  /// Character start offset within the paragraph.
  final int startOffset;

  /// Character end offset within the paragraph.
  final int endOffset;

  /// Highlighted excerpt string.
  final String selectedText;
}

/// Immutable UI state for Reading simulator (Screens 08 & 09).
@immutable
class ReadingSimState {
  /// Creates a [ReadingSimState].
  const new({
    required this.packId,
    required this.isExamMode,
    required this.isLoadingPack,
    required this.pack,
    required this.passageIndex,
    required this.activeTab,
    required this.remainingSeconds,
    required this.totalSeconds,
    required this.isPaused,
    required this.answers,
    required this.activeHighlightColor,
    required this.annotations,
    required this.currentQuestionIndex,
    required this.isSubmitting,
    this.stagedSelection,
    this.highlightedParagraphIndex,
    this.errorMessage,
  });

  /// Postgres pack identifier.
  final String packId;

  /// Exam Mode (timer locked, no AI hint) vs Study Mode.
  final bool isExamMode;

  /// Whether pack JSON is currently loading.
  final bool isLoadingPack;

  /// Loaded Reading pack specification (`null` before load).
  final ReadingPackSpec? pack;

  /// Active passage index (`0..passages.length - 1`).
  final int passageIndex;

  /// Active phone tab: `0` for Passage, `1` for Questions.
  final int activeTab;

  /// Remaining seconds on test timer.
  final int remainingSeconds;

  /// Total pack duration in seconds.
  final int totalSeconds;

  /// Study Mode pause flag.
  final bool isPaused;

  /// Learner responses keyed by question number (`1..totalQuestions`).
  final Map<int, String> answers;

  /// Active text highlight color ('yellow', 'green', 'pink').
  final String activeHighlightColor;

  /// Persisted passage highlights & notes from Drift `ReadingAnnotations`.
  final List<ReadingAnnotationItem> annotations;

  /// Focused question number.
  final int currentQuestionIndex;

  /// Whether submission/scoring is in progress.
  final bool isSubmitting;

  /// Currently selected text range pending Highlight/Note action.
  final StagedTextSelection? stagedSelection;

  /// Paragraph index highlighted when jumping from EvidenceLink.
  final int? highlightedParagraphIndex;

  /// Non-fatal load/submit error feedback.
  final String? errorMessage;

  /// Total questions in the loaded pack.
  int get totalQuestions => pack?.totalQuestions ?? 0;

  /// Count of non-empty answered questions.
  int get answeredCount =>
      answers.values.where((v) => v.trim().isNotEmpty).length;

  /// Returns a copy with updated state.
  ReadingSimState copyWith({
    String? packId,
    bool? isExamMode,
    bool? isLoadingPack,
    ReadingPackSpec? pack,
    int? passageIndex,
    int? activeTab,
    int? remainingSeconds,
    int? totalSeconds,
    bool? isPaused,
    Map<int, String>? answers,
    String? activeHighlightColor,
    List<ReadingAnnotationItem>? annotations,
    int? currentQuestionIndex,
    bool? isSubmitting,
    StagedTextSelection? stagedSelection,
    bool clearStagedSelection = false,
    int? highlightedParagraphIndex,
    bool clearHighlightedParagraph = false,
    String? errorMessage,
    bool clearError = false,
  }) => ReadingSimState(
    packId: packId ?? this.packId,
    isExamMode: isExamMode ?? this.isExamMode,
    isLoadingPack: isLoadingPack ?? this.isLoadingPack,
    pack: pack ?? this.pack,
    passageIndex: passageIndex ?? this.passageIndex,
    activeTab: activeTab ?? this.activeTab,
    remainingSeconds: remainingSeconds ?? this.remainingSeconds,
    totalSeconds: totalSeconds ?? this.totalSeconds,
    isPaused: isPaused ?? this.isPaused,
    answers: answers ?? this.answers,
    activeHighlightColor: activeHighlightColor ?? this.activeHighlightColor,
    annotations: annotations ?? this.annotations,
    currentQuestionIndex: currentQuestionIndex ?? this.currentQuestionIndex,
    isSubmitting: isSubmitting ?? this.isSubmitting,
    stagedSelection: clearStagedSelection
        ? null
        : (stagedSelection ?? this.stagedSelection),
    highlightedParagraphIndex: clearHighlightedParagraph
        ? null
        : (highlightedParagraphIndex ?? this.highlightedParagraphIndex),
    errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
  );
}

/// Manages Reading pack loading, highlights/notes persistence, real
/// `LocalObjectiveScorer` grading, and Study Mode AI explanations.
class ReadingSimNotifier extends Notifier<ReadingSimState> {
  Timer? _timer;
  CountdownClockTracker? _clockTracker;
  StreamSubscription<List<ReadingAnnotationItem>>? _annotationsSub;
  DateTime? _sessionStartTime;
  bool _isDisposed = false;
  String? _mockSessionId;
  String? _mockStageKey;

  @override
  ReadingSimState build() {
    _isDisposed = false;
    final clock = ref.read(clockProvider);
    _sessionStartTime = clock.now();
    _clockTracker = CountdownClockTracker(clock: clock);
    ref.onDispose(() {
      _isDisposed = true;
      _timer?.cancel();
      unawaited(_annotationsSub?.cancel());
    });

    return const ReadingSimState(
      packId: 'ielts-acad-reading-seed-01',
      isExamMode: true,
      isLoadingPack: false,
      pack: null,
      passageIndex: 0,
      activeTab: 0,
      remainingSeconds: 3600,
      totalSeconds: 3600,
      isPaused: false,
      answers: {},
      activeHighlightColor: 'yellow',
      annotations: [],
      currentQuestionIndex: 1,
      isSubmitting: false,
    );
  }

  /// Fetches [packId] from Drift/Postgres, starts timer, and subscribes to highlights.
  Future<void> initialize(
    String packId, {
    bool isExamMode = true,
    String? mockSessionId,
    String? mockStageKey,
  }) async {
    _mockSessionId = mockSessionId;
    _mockStageKey = mockStageKey;
    _timer?.cancel();
    unawaited(_annotationsSub?.cancel());
    _sessionStartTime = ref.read(clockProvider).now();

    state = state.copyWith(
      packId: packId,
      isExamMode: isExamMode,
      isLoadingPack: true,
      passageIndex: 0,
      answers: const <int, String>{},
      clearStagedSelection: true,
      clearHighlightedParagraph: true,
      clearError: true,
    );

    try {
      final attemptRepo = ref.read(attemptRepositoryProvider);
      _annotationsSub = attemptRepo.watchAnnotationsForPack(packId).listen(
        (items) {
          if (!_isDisposed) {
            state = state.copyWith(annotations: items);
          }
        },
        onError: (_) {},
      );
    } on Object {
      // Ignore in isolated widget tests without database plugin.
    }

    try {
      final sync = ref.read(contentSyncServiceProvider);
      final catalog = ref.read(examCatalogRepositoryProvider);
      final bundleRes = await sync.ensureExamBundle(packId);
      if (_isDisposed) return;

      bundleRes.when(
        success: (bundle) {
          final pack = catalog.parseReadingPack(bundle);
          final dur = pack.durationSeconds > 0 ? pack.durationSeconds : 3600;
          (_clockTracker ??= CountdownClockTracker(
            clock: ref.read(clockProvider),
          )).start(remainingSeconds: dur);
          state = state.copyWith(
            isLoadingPack: false,
            pack: pack,
            remainingSeconds: dur,
            totalSeconds: dur,
            clearError: true,
          );
          _startCountdown();
        },
        failure: (f) {
          state = state.copyWith(
            isLoadingPack: false,
            errorMessage:
                'Could not load Reading pack "$packId": ${f.message}.',
          );
        },
      );
    } on Object catch (err) {
      if (_isDisposed) return;
      state = state.copyWith(
        isLoadingPack: false,
        errorMessage: 'Failed to load Reading pack: $err',
      );
    }
  }

  void _startCountdown() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(milliseconds: 500), (timer) {
      if (_isDisposed || state.isPaused) {
        timer.cancel();
        return;
      }
      reconcileTimer();
    });
  }

  /// Synchronizes countdown state against wall clock (`TD-37`).
  void reconcileTimer() {
    final tracker = _clockTracker;
    if (_isDisposed || tracker == null || state.isPaused) return;
    final rem = tracker.currentRemaining();
    if (rem != state.remainingSeconds) {
      state = state.copyWith(remainingSeconds: rem);
    }
    if (rem <= 0) {
      _timer?.cancel();
    }
  }

  /// Pauses or resumes timer in Study Mode.
  void togglePause() {
    if (state.isExamMode) return;
    final tracker = _clockTracker ??= CountdownClockTracker(
      clock: ref.read(clockProvider),
    );
    final nextPaused = !state.isPaused;
    if (nextPaused) {
      final rem = tracker.pause();
      _timer?.cancel();
      state = state.copyWith(isPaused: true, remainingSeconds: rem);
    } else {
      tracker.resume();
      state = state.copyWith(isPaused: false);
      _startCountdown();
    }
  }

  /// Records an answer for [questionNumber].
  void setAnswer(int questionNumber, String answer) {
    final nextAnswers = Map<int, String>.from(state.answers);
    if (answer.trim().isEmpty) {
      nextAnswers.remove(questionNumber);
    } else {
      nextAnswers[questionNumber] = answer;
    }
    state = state.copyWith(answers: nextAnswers);
  }

  /// Toggles an option letter for `mcqMulti` questions.
  void toggleMultiAnswer(int questionNumber, String optionLetter) {
    final existing = (state.answers[questionNumber] ?? '')
        .split(',')
        .map((e) => e.trim())
        .where((e) => e.isNotEmpty)
        .toSet();
    if (existing.contains(optionLetter)) {
      existing.remove(optionLetter);
    } else {
      existing.add(optionLetter);
    }
    final sorted = existing.toList()..sort();
    setAnswer(questionNumber, sorted.join(', '));
  }

  /// Switches active passage (`0..passages.length - 1`).
  void selectPassage(int index) {
    final maxIdx = (state.pack?.passages.length ?? 1) - 1;
    state = state.copyWith(
      passageIndex: index.clamp(0, maxIdx < 0 ? 0 : maxIdx),
      clearStagedSelection: true,
    );
  }

  /// Switches between Passage (`0`) and Questions (`1`) on compact viewports.
  void selectTab(int tab) {
    state = state.copyWith(activeTab: tab.clamp(0, 1));
  }

  /// Sets active highlight tool color (`'yellow'`, `'green'`, `'pink'`).
  void setHighlightColor(String color) {
    state = state.copyWith(activeHighlightColor: color);
  }

  /// Stores a paragraph text selection for instant Highlight or Note saving.
  void stageTextSelection({
    required int paragraphIndex,
    required TextSelection selection,
    required String paragraphText,
  }) {
    if (selection.isCollapsed) {
      if (state.stagedSelection != null) {
        state = state.copyWith(clearStagedSelection: true);
      }
      return;
    }
    final start = selection.start.clamp(0, paragraphText.length);
    final end = selection.end.clamp(start, paragraphText.length);
    if (end <= start) return;

    state = state.copyWith(
      stagedSelection: StagedTextSelection(
        paragraphIndex: paragraphIndex,
        startOffset: start,
        endOffset: end,
        selectedText: paragraphText.substring(start, end),
      ),
    );
  }

  /// Saves the staged selection into Drift `ReadingAnnotations`.
  Future<void> saveStagedAnnotation({String? noteText}) async {
    final sel = state.stagedSelection;
    if (sel == null) return;
    final entropy = ref.read(entropySourceProvider);
    final attemptRepo = ref.read(attemptRepositoryProvider);
    final packedParagraphKey = (state.passageIndex * 100) + sel.paragraphIndex;

    await attemptRepo.saveReadingAnnotation(
      annotationId: entropy.nextUuidV4(),
      packId: state.packId,
      passageIndex: packedParagraphKey,
      startOffset: sel.startOffset,
      endOffset: sel.endOffset,
      colorCode: state.activeHighlightColor,
      noteText: (noteText == null || noteText.trim().isEmpty)
          ? sel.selectedText
          : noteText.trim(),
    );
    if (!_isDisposed) {
      state = state.copyWith(clearStagedSelection: true);
    }
  }

  /// Deletes a persisted highlight or note by [annotationId].
  Future<void> removeAnnotation(String annotationId) async {
    await ref
        .read(attemptRepositoryProvider)
        .deleteReadingAnnotation(
          annotationId,
        );
  }

  /// Selects focused question number and jumps tab if needed.
  void selectQuestion(int questionNumber) {
    final maxQ = state.totalQuestions > 0 ? state.totalQuestions : 40;
    state = state.copyWith(currentQuestionIndex: questionNumber.clamp(1, maxQ));
  }

  /// Jumps UI back to passage view emphasizing [paragraphIndex] (1-based).
  void jumpToEvidenceParagraph(int paragraphIndex) {
    state = state.copyWith(
      activeTab: 0,
      highlightedParagraphIndex: (paragraphIndex - 1).clamp(0, 50),
    );
  }

  /// Calls `/v1/evaluate/explain-question` in Study Mode, falling back gracefully
  /// to stored distractor/evidence explanations when offline.
  Future<String> fetchAiExplanation(QuestionSpec question) async {
    final passage =
        (state.pack != null && state.passageIndex < state.pack!.passages.length)
        ? state.pack!.passages[state.passageIndex].fullText
        : '';
    final learnerAnswer = state.answers[question.number] ?? '(Unanswered)';
    final correctAnswer = question.acceptedVariants.isNotEmpty
        ? question.acceptedVariants.first
        : '';

    try {
      await ref.read(authSessionServiceProvider).ensureAuthenticated();
      final res = await ref
          .read(gradingGatewayProvider)
          .explainQuestion(
            questionId: question.questionId,
            learnerAnswer: learnerAnswer,
            correctAnswer: correctAnswer,
            passageContext: passage.length > 1200
                ? passage.substring(0, 1200)
                : passage,
            packId: state.packId,
            questionType: question.questionType.name,
          );
      if (res.isSuccess && (res.valueOrNull ?? '').isNotEmpty) {
        return res.valueOrNull!;
      }
    } on Object {
      // Fallback to local pack rationale below.
    }

    final buf = StringBuffer();
    if (correctAnswer.isNotEmpty) {
      buf.writeln('Accepted answer: $correctAnswer');
    }
    if (question.distractorExplanation != null &&
        question.distractorExplanation!.isNotEmpty) {
      buf.writeln(question.distractorExplanation);
    }
    if (question.evidenceSpan != null &&
        question.evidenceSpan!.exactQuote.isNotEmpty) {
      buf.writeln('Evidence quote: "${question.evidenceSpan!.exactQuote}"');
    }
    if (buf.isEmpty) {
      return 'Review the passage carefully around the keywords in this prompt.';
    }
    return buf.toString().trim();
  }

  /// Grades all pack questions deterministically using `LocalObjectiveScorer`,
  /// writes the UUIDv4 attempt & activity log, and returns the `attemptId`.
  Future<String?> submitReading() async {
    if (state.isSubmitting) return null;
    final pack = state.pack;
    if (pack == null) return null;

    _timer?.cancel();
    state = state.copyWith(isSubmitting: true, clearError: true);

    try {
      final attemptRepo = ref.read(attemptRepositoryProvider);
      final profileRepo = ref.read(profileRepositoryProvider);
      final progressRepo = ref.read(progressRepositoryProvider);
      final entropy = ref.read(entropySourceProvider);
      final clock = ref.read(clockProvider);

      final profile = await profileRepo.loadOrInitializePrimary();
      final isGeneral =
          profile.examId == 'ielts_general' || state.packId.contains('-gt-');
      final moduleType = isGeneral
          ? ExamModuleType.generalTraining
          : ExamModuleType.academic;
      final examId = isGeneral ? 'ielts_general' : 'ielts_academic';

      final allQuestions = pack.passages.expand((p) => p.questions).toList();
      final inputs = allQuestions
          .map(
            (q) => ObjectiveQuestionAnswer(
              questionId: q.questionId.isNotEmpty
                  ? q.questionId
                  : 'q_${q.number}',
              acceptedAnswers: q.acceptedVariants,
              userAnswer: state.answers[q.number],
              maxWords: q.maxWords,
            ),
          )
          .toList(growable: false);

      final report = LocalObjectiveScorer.score(
        answers: inputs,
        skill: SkillKind.reading,
        moduleType: moduleType,
      );

      final attemptId = entropy.nextUuidV4();
      final questionBreakdown = allQuestions
          .map((q) {
            final qId = q.questionId.isNotEmpty
                ? q.questionId
                : 'q_${q.number}';
            final userAns = state.answers[q.number] ?? '';
            return {
              'questionNumber': q.number,
              'questionId': qId,
              'prompt': q.prompt,
              'userAnswer': userAns,
              'acceptedAnswers': q.acceptedVariants,
              'isCorrect': report.questionCorrectness[qId] ?? false,
              'distractorExplanation': q.distractorExplanation,
              'evidenceQuote': q.evidenceSpan?.exactQuote,
              'paragraphIndex': q.evidenceSpan?.paragraphIndex,
            };
          })
          .toList(growable: false);

      final elapsedSeconds = _sessionStartTime != null
          ? clock.now().difference(_sessionStartTime!).inSeconds.clamp(5, 7200)
          : (state.totalSeconds - state.remainingSeconds).clamp(5, 7200);

      final installedPack = await ref
          .read(examCatalogRepositoryProvider)
          .getInstalledPackById(pack.packId);
      final nowUtcMs = clock.now().toUtc().millisecondsSinceEpoch;

      final submissionJson = jsonEncode({
        'packId': pack.packId,
        'title': pack.title,
        'correctCount': report.correctCount,
        'totalCount': report.totalCount,
        'overallBand': report.bandScore,
        'isCalibratedFullPack': report.isCalibratedFullPack,
        'usedStudyMode': !state.isExamMode,
        'questions': questionBreakdown,
      });

      await attemptRepo.saveLocalSubmission(
        attemptId: attemptId,
        packId: pack.packId,
        skill: SkillKind.reading,
        submissionJson: submissionJson,
        overallBand: report.bandScore,
        status: AttemptStatus.scored,
        examId: examId,
        startedAtUtcMs: _sessionStartTime?.toUtc().millisecondsSinceEpoch,
        completedAtUtcMs: nowUtcMs,
        durationSeconds: elapsedSeconds,
        usedStudyMode: !state.isExamMode,
        questionCount: report.totalCount,
        isCalibratedFullPack: report.isCalibratedFullPack,
        contentVersion: installedPack?.version,
        mockSessionId: _mockSessionId,
        mockStageKey: _mockStageKey,
      );

      if (_mockSessionId != null && _mockStageKey != null) {
        await attemptRepo.recordMockStageAttempt(
          mockId: _mockSessionId!,
          stageKey: _mockStageKey!,
          attemptId: attemptId,
        );
      }

      await progressRepo.logTodayActivity(
        studySeconds: elapsedSeconds,
        completedItems: 1,
      );

      if (!_isDisposed) {
        state = state.copyWith(isSubmitting: false);
      }
      return attemptId;
    } on Object catch (err) {
      if (!_isDisposed) {
        state = state.copyWith(
          isSubmitting: false,
          errorMessage: 'Failed to submit Reading answers: $err',
        );
      }
      return null;
    }
  }
}
