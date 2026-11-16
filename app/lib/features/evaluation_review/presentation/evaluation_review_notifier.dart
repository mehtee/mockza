import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/models/speaking_evaluation.dart';
import 'package:mockza/core/models/writing_evaluation.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/services/grading_gateway.dart';
import 'package:mockza/theme/components/compare_attempts.dart';

/// Per-question grading review item for Reading and Listening objective attempts.
@immutable
class ObjectiveQuestionReview {
  /// Creates an [ObjectiveQuestionReview].
  const new({
    required this.questionNumber,
    required this.questionId,
    required this.prompt,
    required this.userAnswer,
    required this.acceptedAnswers,
    required this.isCorrect,
    this.distractorExplanation = '',
    this.evidenceQuote,
    this.paragraphIndex,
  });

  /// 1-based question number.
  final int questionNumber;

  /// Canonical question ID.
  final String questionId;

  /// Question stem or gap prompt.
  final String prompt;

  /// Learner's submitted answer.
  final String userAnswer;

  /// Accepted answer variants from official key.
  final List<String> acceptedAnswers;

  /// Whether learner's response matched any accepted variant.
  final bool isCorrect;

  /// Explanation of distractor / answer rationale.
  final String distractorExplanation;

  /// Passage evidence snippet (for Reading).
  final String? evidenceQuote;

  /// Zero-based passage paragraph index when available.
  final int? paragraphIndex;
}

/// Real historical comparison against the previous scored attempt in the same skill.
@immutable
class AttemptComparisonSnapshot {
  /// Creates an [AttemptComparisonSnapshot].
  const new({
    required this.previousAttemptId,
    required this.previousTitle,
    required this.currentTitle,
    required this.previousOverallBand,
    required this.currentOverallBand,
    required this.deltas,
  });

  /// Baseline attempt identifier.
  final String previousAttemptId;

  /// Formatted label for baseline attempt.
  final String previousTitle;

  /// Formatted label for current attempt.
  final String currentTitle;

  /// Baseline overall band.
  final double previousOverallBand;

  /// Current overall band.
  final double currentOverallBand;

  /// Per-criterion or accuracy metric deltas.
  final List<CriterionDelta> deltas;
}

/// State backing the Evaluation Review screen across Speaking, Writing, Reading & Listening.
@immutable
class EvaluationReviewState {
  /// Creates an [EvaluationReviewState].
  const new({
    required this.attemptId,
    required this.packId,
    required this.packTitle,
    required this.skill,
    required this.status,
    required this.targetBandScore,
    this.isLoading = false,
    this.notFound = false,
    this.selectedTabIndex = 0,
    this.writingResult,
    this.speakingResult,
    this.objectiveQuestions = const <ObjectiveQuestionReview>[],
    this.objectiveCorrectCount = 0,
    this.objectiveTotalCount = 0,
    this.overallBand,
    this.submittedEssayText = '',
    this.promptTitle = '',
    this.remoteJobId,
    this.pollStageLabel,
    this.errorMessage,
    this.quotaRefunded = false,
    this.comparison,
    this.savedCardIds = const <String>{},
    this.flaggedQuestionIds = const <String>{},
    this.isRetrying = false,
    this.isFlagging = false,
    this.isCalibratedFullPack = true,
    this.usedStudyMode = false,
  });

  /// Reviewed attempt identifier.
  final String attemptId;

  /// Associated pack identifier.
  final String packId;

  /// Human-readable pack/exam title.
  final String packTitle;

  /// Evaluated skill category.
  final SkillKind skill;

  /// Attempt persistence & evaluation status.
  final AttemptStatus status;

  /// Learner target band score from profile.
  final double targetBandScore;

  /// Initial load indicator.
  final bool isLoading;

  /// True if `attemptId` is missing in local Drift DB.
  final bool notFound;

  /// Currently selected tab (`0=Overview`, `1=Rubric/Questions`, `2=Rewrite/Transcript/Key`, `3=Compare`).
  final int selectedTabIndex;

  /// Structured Writing AI evaluation result when available.
  final WritingEvaluationResult? writingResult;

  /// Structured Speaking AI evaluation result when available.
  final SpeakingEvaluationResult? speakingResult;

  /// Question-level breakdown for objective Reading/Listening attempts.
  final List<ObjectiveQuestionReview> objectiveQuestions;

  /// Correct answer count for Reading/Listening.
  final int objectiveCorrectCount;

  /// Total question count for Reading/Listening.
  final int objectiveTotalCount;

  /// Evaluated overall IELTS band (`0.0..9.0`) when scored.
  final double? overallBand;

  /// Submitted essay text (Writing).
  final String submittedEssayText;

  /// Prompt title recorded with submission.
  final String promptTitle;

  /// Server evaluation job UUID when queued.
  final String? remoteJobId;

  /// Current worker processing status label.
  final String? pollStageLabel;

  /// User-facing failure/retry message.
  final String? errorMessage;

  /// Whether credit/quota was refunded by the server after worker failure.
  final bool quotaRefunded;

  /// Real baseline comparison against a prior scored same-skill attempt.
  final AttemptComparisonSnapshot? comparison;

  /// Vocabulary card IDs captured during this review session.
  final Set<String> savedCardIds;

  /// Question or criterion IDs already flagged during this session.
  final Set<String> flaggedQuestionIds;

  /// Whether a manual retry / outbox flush is currently running.
  final bool isRetrying;

  /// Whether a flag submission is currently running.
  final bool isFlagging;

  /// True if the attempt used a full 40-item objective pack / full timed prompt (`RR-10`).
  final bool isCalibratedFullPack;

  /// True if completed in untimed Study Mode rather than Exam Mode (`RR-10`).
  final bool usedStudyMode;

  /// Whether the attempt is still waiting for AI scoring.
  bool get isPendingRemote =>
      (skill == SkillKind.writing || skill == SkillKind.speaking) &&
      overallBand == null &&
      status != AttemptStatus.failedRetryable &&
      !notFound;

  /// Creates an updated copy of [EvaluationReviewState].
  EvaluationReviewState copyWith({
    String? attemptId,
    String? packId,
    String? packTitle,
    SkillKind? skill,
    AttemptStatus? status,
    double? targetBandScore,
    bool? isLoading,
    bool? notFound,
    int? selectedTabIndex,
    WritingEvaluationResult? writingResult,
    bool clearWritingResult = false,
    SpeakingEvaluationResult? speakingResult,
    bool clearSpeakingResult = false,
    List<ObjectiveQuestionReview>? objectiveQuestions,
    int? objectiveCorrectCount,
    int? objectiveTotalCount,
    double? overallBand,
    bool clearOverallBand = false,
    String? submittedEssayText,
    String? promptTitle,
    String? remoteJobId,
    String? pollStageLabel,
    bool clearPollStageLabel = false,
    String? errorMessage,
    bool clearErrorMessage = false,
    bool? quotaRefunded,
    AttemptComparisonSnapshot? comparison,
    bool clearComparison = false,
    Set<String>? savedCardIds,
    Set<String>? flaggedQuestionIds,
    bool? isRetrying,
    bool? isFlagging,
    bool? isCalibratedFullPack,
    bool? usedStudyMode,
  }) => EvaluationReviewState(
    attemptId: attemptId ?? this.attemptId,
    packId: packId ?? this.packId,
    packTitle: packTitle ?? this.packTitle,
    skill: skill ?? this.skill,
    status: status ?? this.status,
    targetBandScore: targetBandScore ?? this.targetBandScore,
    isLoading: isLoading ?? this.isLoading,
    notFound: notFound ?? this.notFound,
    selectedTabIndex: selectedTabIndex ?? this.selectedTabIndex,
    writingResult: clearWritingResult
        ? null
        : (writingResult ?? this.writingResult),
    speakingResult: clearSpeakingResult
        ? null
        : (speakingResult ?? this.speakingResult),
    objectiveQuestions: objectiveQuestions ?? this.objectiveQuestions,
    objectiveCorrectCount: objectiveCorrectCount ?? this.objectiveCorrectCount,
    objectiveTotalCount: objectiveTotalCount ?? this.objectiveTotalCount,
    overallBand: clearOverallBand ? null : (overallBand ?? this.overallBand),
    submittedEssayText: submittedEssayText ?? this.submittedEssayText,
    promptTitle: promptTitle ?? this.promptTitle,
    remoteJobId: remoteJobId ?? this.remoteJobId,
    pollStageLabel: clearPollStageLabel
        ? null
        : (pollStageLabel ?? this.pollStageLabel),
    errorMessage: clearErrorMessage
        ? null
        : (errorMessage ?? this.errorMessage),
    quotaRefunded: quotaRefunded ?? this.quotaRefunded,
    comparison: clearComparison ? null : (comparison ?? this.comparison),
    savedCardIds: savedCardIds ?? this.savedCardIds,
    flaggedQuestionIds: flaggedQuestionIds ?? this.flaggedQuestionIds,
    isRetrying: isRetrying ?? this.isRetrying,
    isFlagging: isFlagging ?? this.isFlagging,
    isCalibratedFullPack: isCalibratedFullPack ?? this.isCalibratedFullPack,
    usedStudyMode: usedStudyMode ?? this.usedStudyMode,
  );
}

/// Manages real Drift loading, job status polling, vocab capture, comparison, sharing & flagging.
class EvaluationReviewNotifier extends Notifier<EvaluationReviewState> {
  Timer? _pollTimer;
  bool _isDisposed = false;
  bool _isPollingRequestInFlight = false;
  int _activeLoadGen = 0;

  @override
  EvaluationReviewState build() {
    _isDisposed = false;
    _activeLoadGen = 0;
    ref.onDispose(() {
      _isDisposed = true;
      _activeLoadGen++;
      _stopPolling();
    });
    return const EvaluationReviewState(
      attemptId: '',
      packId: '',
      packTitle: 'Evaluation Review',
      skill: SkillKind.writing,
      status: AttemptStatus.submittedLocal,
      targetBandScore: 7,
      isLoading: true,
    );
  }

  /// Switches the active detail tab.
  void selectTab(int index) {
    state = state.copyWith(selectedTabIndex: index);
  }

  /// Loads [attemptId] from Drift DB, computes real comparison, and polls AI job if needed.
  Future<void> loadAttempt(String attemptId) async {
    _stopPolling();
    _isPollingRequestInFlight = false;
    final gen = ++_activeLoadGen;
    if (_isDisposed) return;

    state = state.copyWith(
      attemptId: attemptId,
      isLoading: true,
      notFound: false,
      clearErrorMessage: true,
      clearWritingResult: true,
      clearSpeakingResult: true,
      clearComparison: true,
      clearOverallBand: true,
      objectiveQuestions: const <ObjectiveQuestionReview>[],
      savedCardIds: const <String>{},
      flaggedQuestionIds: const <String>{},
    );

    if (attemptId.trim().isEmpty) {
      state = state.copyWith(
        isLoading: false,
        notFound: true,
        errorMessage: 'No attempt ID was provided.',
      );
      return;
    }

    final attemptRepo = ref.read(attemptRepositoryProvider);
    final profileRepo = ref.read(profileRepositoryProvider);

    final row = await attemptRepo.getAttemptRow(attemptId);
    final profile = await profileRepo.loadOrInitializePrimary();

    if (_isDisposed || gen != _activeLoadGen) return;

    if (row == null) {
      state = state.copyWith(
        isLoading: false,
        notFound: true,
        targetBandScore: profile.targetBand,
        errorMessage: 'Attempt "$attemptId" was not found on this device.',
      );
      return;
    }

    final skill = SkillKind.values.byName(row.skill);
    final status = AttemptStatus.values.byName(row.status);
    final submissionMap = _decodeJsonMap(row.submissionJson);
    final evalMap = row.evaluationJson != null && row.evaluationJson!.isNotEmpty
        ? _decodeJsonMap(row.evaluationJson!)
        : null;

    final packTitle =
        (submissionMap['title'] as String?) ??
        _humanizePackId(row.packId, skill);

    WritingEvaluationResult? writingResult;
    SpeakingEvaluationResult? speakingResult;
    var objectiveQuestions = const <ObjectiveQuestionReview>[];
    var correctCount = 0;
    var totalCount = 0;
    var overallBand = row.overallBand;

    if (skill == SkillKind.writing && evalMap != null) {
      writingResult = _normalizeWritingResult(
        HttpGradingGateway.parseWritingEvaluation(evalMap),
      );
      overallBand ??= writingResult.overallBand;
    } else if (skill == SkillKind.speaking && evalMap != null) {
      speakingResult = _normalizeSpeakingResult(
        HttpGradingGateway.parseSpeakingEvaluation(evalMap),
      );
      overallBand ??= speakingResult.overallBand;
    } else if (skill == SkillKind.reading || skill == SkillKind.listening) {
      final rawQuestions =
          (submissionMap['questions'] as List<dynamic>?) ?? const [];
      objectiveQuestions = rawQuestions
          .whereType<Map<String, Object?>>()
          .map((q) {
            final accepted =
                ((q['acceptedAnswers'] as List<dynamic>?) ?? const [])
                    .whereType<String>()
                    .toList(growable: false);
            return ObjectiveQuestionReview(
              questionNumber: (q['questionNumber'] as num?)?.toInt() ?? 0,
              questionId: (q['questionId'] as String?) ?? '',
              prompt: (q['prompt'] as String?) ?? '',
              userAnswer: (q['userAnswer'] as String?) ?? '',
              acceptedAnswers: accepted,
              isCorrect: (q['isCorrect'] as bool?) ?? false,
              distractorExplanation:
                  (q['distractorExplanation'] as String?) ?? '',
              evidenceQuote: q['evidenceQuote'] as String?,
              paragraphIndex: (q['paragraphIndex'] as num?)?.toInt(),
            );
          })
          .toList(growable: false);
      correctCount =
          (submissionMap['correctCount'] as num?)?.toInt() ??
          objectiveQuestions.where((q) => q.isCorrect).length;
      totalCount =
          (submissionMap['totalCount'] as num?)?.toInt() ??
          objectiveQuestions.length;
      overallBand ??= (submissionMap['overallBand'] as num?)?.toDouble();
    }

    final comparison = await _loadBaselineComparison(
      currentAttemptId: row.attemptId,
      currentPackId: row.packId,
      currentTitle: _shortDateLabel(row.updatedAt),
      currentOverallBand: overallBand,
      skill: skill,
      currentWriting: writingResult,
      currentSpeaking: speakingResult,
      currentCorrectCount: correctCount,
      currentTotalCount: totalCount,
    );

    if (_isDisposed || gen != _activeLoadGen) return;

    state = state.copyWith(
      attemptId: row.attemptId,
      packId: row.packId,
      packTitle: packTitle,
      skill: skill,
      status: status,
      targetBandScore: profile.targetBand,
      isLoading: false,
      notFound: false,
      writingResult: writingResult,
      speakingResult: speakingResult,
      objectiveQuestions: objectiveQuestions,
      objectiveCorrectCount: correctCount,
      objectiveTotalCount: totalCount,
      overallBand: overallBand,
      submittedEssayText: (submissionMap['essayText'] as String?) ?? '',
      promptTitle: (submissionMap['promptTitle'] as String?) ?? packTitle,
      remoteJobId: row.remoteJobId,
      pollStageLabel: _defaultStageLabel(status, row.remoteJobId),
      errorMessage: row.errorCode,
      comparison: comparison,
      isCalibratedFullPack:
          row.isCalibratedFullPack &&
          (submissionMap['isCalibratedFullPack'] as bool? ?? true),
      usedStudyMode:
          row.usedStudyMode ||
          (submissionMap['usedStudyMode'] as bool? ?? false),
    );

    // If Waiting for remote AI evaluation, start polling or trigger outbox flush.
    if ((skill == SkillKind.writing || skill == SkillKind.speaking) &&
        evalMap == null &&
        status != AttemptStatus.failedRetryable) {
      final jobId = row.remoteJobId;
      if (jobId != null && jobId.isNotEmpty) {
        _startPolling(jobId, expectedAttemptId: row.attemptId, requestGen: gen);
      } else {
        unawaited(_flushOutboxAndReload(row.attemptId, requestGen: gen));
      }
    }
  }

  /// Flushes outbox queue or triggers a genuine server retry on a failed remote job (`TD-16`).
  Future<void> retryEvaluation() async {
    if (state.isRetrying || state.attemptId.isEmpty) return;
    final targetAttemptId = state.attemptId;
    final gen = _activeLoadGen;
    state = state.copyWith(
      isRetrying: true,
      clearErrorMessage: true,
      quotaRefunded: false,
    );
    try {
      await ref.read(authSessionServiceProvider).ensureAuthenticated();
      if (_isDisposed || gen != _activeLoadGen || !ref.mounted) return;
      await ref.read(outboxSyncServiceProvider).processPendingQueue();
      if (_isDisposed || gen != _activeLoadGen || !ref.mounted) return;

      final attemptRepo = ref.read(attemptRepositoryProvider);
      final row = await attemptRepo.getAttemptRow(targetAttemptId);
      if (_isDisposed || gen != _activeLoadGen || row == null) return;

      final currentStatus = AttemptStatus.values.byName(row.status);
      if (currentStatus == AttemptStatus.failedRetryable &&
          row.evaluationJson == null) {
        final retryRes = await ref
            .read(gradingGatewayProvider)
            .retryEvaluation(attemptId: targetAttemptId);
        if (_isDisposed || gen != _activeLoadGen) return;

        switch (retryRes) {
          case Ok<String, Failure>(:final value):
            await attemptRepo.updateAttemptEvaluation(
              attemptId: targetAttemptId,
              status: AttemptStatus.queuedRemote,
              remoteJobId: value,
            );
            if (_isDisposed || gen != _activeLoadGen) return;
            await loadAttempt(targetAttemptId);
            return;
          case Err<String, Failure>(:final failure):
            state = state.copyWith(
              isRetrying: false,
              errorMessage: 'Retry failed: ${failure.message}',
            );
            return;
        }
      }

      if (row.remoteJobId != null &&
          row.remoteJobId!.isNotEmpty &&
          row.evaluationJson == null) {
        await pollNow(
          row.remoteJobId!,
          expectedAttemptId: targetAttemptId,
          requestGen: gen,
        );
        if (!_isDisposed && gen == _activeLoadGen && state.isPendingRemote) {
          _startPolling(
            row.remoteJobId!,
            expectedAttemptId: targetAttemptId,
            requestGen: gen,
          );
        }
      } else {
        await loadAttempt(targetAttemptId);
      }
    } finally {
      if (!_isDisposed && gen == _activeLoadGen) {
        state = state.copyWith(isRetrying: false);
      }
    }
  }

  /// Manually checks [jobId] status once via `GET /v1/jobs/:jobId`.
  Future<void> pollNow(
    String jobId, {
    String? expectedAttemptId,
    int? requestGen,
  }) async {
    final boundAttemptId = expectedAttemptId ?? state.attemptId;
    final boundGen = requestGen ?? _activeLoadGen;
    if (_isDisposed ||
        _isPollingRequestInFlight ||
        jobId.isEmpty ||
        boundAttemptId.isEmpty) {
      return;
    }
    _isPollingRequestInFlight = true;
    try {
      final res = await ref
          .read(gradingGatewayProvider)
          .pollJobStatus(jobId: jobId);
      // Drop stale responses if user navigated to another attempt while request was in flight (`TD-17`).
      if (_isDisposed ||
          boundGen != _activeLoadGen ||
          state.attemptId != boundAttemptId) {
        return;
      }
      switch (res) {
        case Ok<JobPollSnapshot, Failure>(:final value):
          await _applyPollSnapshot(
            value,
            expectedAttemptId: boundAttemptId,
            requestGen: boundGen,
          );
        case Err<JobPollSnapshot, Failure>(:final failure):
          state = state.copyWith(
            pollStageLabel: 'Waiting for network (${failure.message})',
          );
      }
    } finally {
      _isPollingRequestInFlight = false;
    }
  }

  /// 1-tap captures a vocabulary upgrade or missed question concept into SRS deck.
  Future<void> saveMistakeToDeck({
    required String cardId,
    required String headword,
    required String definition,
    required String topicTag,
    String? ipa,
    String? contextSentence,
    String? usageNote,
  }) async {
    final cleanHeadword = headword.trim();
    if (cleanHeadword.isEmpty) return;

    await ref
        .read(vocabRepositoryProvider)
        .captureMistakeToDeck(
          cardId: cardId,
          headword: cleanHeadword,
          definition: definition.trim().isNotEmpty
              ? definition.trim()
              : 'Captured from IELTS ${state.skill.name} review',
          topicTag: topicTag,
          ipa: ipa,
          contextSentence: contextSentence,
          usageNote: usageNote,
          sourceSkill: state.skill.name,
          sourceAttemptId: state.attemptId,
          sourceRefLabel: state.packTitle,
        );
    if (_isDisposed) return;
    state = state.copyWith(
      savedCardIds: <String>{...state.savedCardIds, cardId},
    );
  }

  /// Submits a user issue flag via `/v1/flags` with offline `'flag_question'` outbox fallback.
  Future<bool> flagQuestion({
    required String questionId,
    required String reason,
    String? note,
  }) async {
    if (state.isFlagging) return false;
    state = state.copyWith(isFlagging: true);
    try {
      final gateway = ref.read(gradingGatewayProvider);
      final attemptRepo = ref.read(attemptRepositoryProvider);
      final res = await gateway.flagQuestion(
        packId: state.packId,
        questionId: questionId,
        reason: reason,
        note: note,
      );
      if (res.isErr) {
        await attemptRepo.enqueueOutboxAction(
          actionType: 'flag_question',
          payloadJson: jsonEncode({
            'packId': state.packId,
            'questionId': questionId,
            'reason': reason,
            if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
          }),
        );
      }
      if (!_isDisposed) {
        state = state.copyWith(
          flaggedQuestionIds: <String>{
            ...state.flaggedQuestionIds,
            questionId,
          },
        );
      }
      return res.isOk;
    } finally {
      if (!_isDisposed) {
        state = state.copyWith(isFlagging: false);
      }
    }
  }

  /// Builds a readable summary string for platform sharing.
  String buildShareSummary() {
    final bandText = state.overallBand != null
        ? 'Band ${state.overallBand!.toStringAsFixed(1)}'
        : 'Pending';
    final buf = StringBuffer()
      ..writeln('Mockza IELTS ${_skillLabel(state.skill)} — $bandText')
      ..writeln('Pack: ${state.packTitle}');

    if (state.writingResult != null) {
      for (final c in state.writingResult!.criteria) {
        buf.writeln(
          '${c.criterionCode} (${c.criterionLabel}): ${c.band.toStringAsFixed(1)}',
        );
      }
      if (state.writingResult!.actionableNextStep.isNotEmpty) {
        buf.writeln('Next step: ${state.writingResult!.actionableNextStep}');
      }
    } else if (state.speakingResult != null) {
      for (final c in state.speakingResult!.criteria) {
        buf.writeln(
          '${c.criterionCode} (${c.criterionLabel}): ${c.band.toStringAsFixed(1)}',
        );
      }
      if (state.speakingResult!.actionableNextStep.isNotEmpty) {
        buf.writeln('Next step: ${state.speakingResult!.actionableNextStep}');
      }
    } else if (state.objectiveTotalCount > 0) {
      buf.writeln(
        'Score: ${state.objectiveCorrectCount}/${state.objectiveTotalCount}',
      );
    }

    return buf.toString().trim();
  }

  Future<void> _flushOutboxAndReload(
    String attemptId, {
    required int requestGen,
  }) async {
    await ref.read(authSessionServiceProvider).ensureAuthenticated();
    await ref.read(outboxSyncServiceProvider).processPendingQueue();
    if (_isDisposed ||
        requestGen != _activeLoadGen ||
        state.attemptId != attemptId) {
      return;
    }
    final refreshed = await ref
        .read(attemptRepositoryProvider)
        .getAttemptRow(attemptId);
    if (_isDisposed ||
        refreshed == null ||
        requestGen != _activeLoadGen ||
        state.attemptId != attemptId) {
      return;
    }
    if (refreshed.remoteJobId != null &&
        refreshed.remoteJobId!.isNotEmpty &&
        refreshed.evaluationJson == null) {
      state = state.copyWith(
        remoteJobId: refreshed.remoteJobId,
        status: AttemptStatus.values.byName(refreshed.status),
        pollStageLabel: _defaultStageLabel(
          AttemptStatus.values.byName(refreshed.status),
          refreshed.remoteJobId,
        ),
      );
      _startPolling(
        refreshed.remoteJobId!,
        expectedAttemptId: attemptId,
        requestGen: requestGen,
      );
    }
  }

  void _startPolling(
    String jobId, {
    required String expectedAttemptId,
    required int requestGen,
  }) {
    _stopPolling();
    unawaited(
      pollNow(
        jobId,
        expectedAttemptId: expectedAttemptId,
        requestGen: requestGen,
      ),
    );
    _pollTimer = Timer.periodic(const Duration(milliseconds: 2500), (_) {
      unawaited(
        pollNow(
          jobId,
          expectedAttemptId: expectedAttemptId,
          requestGen: requestGen,
        ),
      );
    });
  }

  void _stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  Future<void> _applyPollSnapshot(
    JobPollSnapshot snapshot, {
    required String expectedAttemptId,
    required int requestGen,
  }) async {
    if (_isDisposed ||
        requestGen != _activeLoadGen ||
        state.attemptId != expectedAttemptId) {
      return;
    }
    if (snapshot.attemptId.isNotEmpty &&
        snapshot.attemptId != expectedAttemptId) {
      return;
    }
    final attemptRepo = ref.read(attemptRepositoryProvider);
    if (snapshot.status == 'completed' && snapshot.rawResultJson != null) {
      _stopPolling();
      final raw = snapshot.rawResultJson!;
      final rawBand = (raw['overallBand'] as num?)?.toDouble();

      await attemptRepo.updateAttemptEvaluation(
        attemptId: expectedAttemptId,
        status: AttemptStatus.scored,
        remoteJobId: snapshot.jobId,
        evaluationJson: jsonEncode(raw),
        overallBand: rawBand,
      );
      if (_isDisposed ||
          requestGen != _activeLoadGen ||
          state.attemptId != expectedAttemptId) {
        return;
      }
      await loadAttempt(expectedAttemptId);
      return;
    }

    if (snapshot.status == 'failed') {
      _stopPolling();
      final errorText = snapshot.errorCode ?? 'Evaluation failed on worker';
      await attemptRepo.updateAttemptEvaluation(
        attemptId: expectedAttemptId,
        status: AttemptStatus.failedRetryable,
        remoteJobId: snapshot.jobId,
        errorCode: errorText,
      );
      if (_isDisposed ||
          requestGen != _activeLoadGen ||
          state.attemptId != expectedAttemptId) {
        return;
      }
      state = state.copyWith(
        status: AttemptStatus.failedRetryable,
        errorMessage: errorText,
        quotaRefunded: snapshot.quotaRefunded,
        clearPollStageLabel: true,
      );
      return;
    }

    if (_isDisposed ||
        requestGen != _activeLoadGen ||
        state.attemptId != expectedAttemptId) {
      return;
    }
    state = state.copyWith(
      pollStageLabel: _formatWorkerStage(snapshot.status, snapshot.stage),
    );
  }

  Future<AttemptComparisonSnapshot?> _loadBaselineComparison({
    required String currentAttemptId,
    required String currentPackId,
    required String currentTitle,
    required double? currentOverallBand,
    required SkillKind skill,
    WritingEvaluationResult? currentWriting,
    SpeakingEvaluationResult? currentSpeaking,
    int currentCorrectCount = 0,
    int currentTotalCount = 0,
  }) async {
    if (currentOverallBand == null) return null;
    final attemptRepo = ref.read(attemptRepositoryProvider);
    final recent = await attemptRepo.watchRecentAttempts(limit: 50).first;
    final candidates = recent
        .where(
          (a) =>
              a.attemptId != currentAttemptId &&
              a.skill == skill &&
              a.status == AttemptStatus.scored &&
              a.overallBand != null,
        )
        .toList(growable: false);
    if (candidates.isEmpty) return null;

    final samePack = candidates
        .where((a) => a.packId == currentPackId)
        .toList(growable: false);
    final baselineSummary = samePack.isNotEmpty
        ? samePack.first
        : candidates.first;
    final baselineRow = await attemptRepo.getAttemptRow(
      baselineSummary.attemptId,
    );
    if (baselineRow == null || baselineSummary.overallBand == null) return null;

    final deltas = <CriterionDelta>[];
    if (skill == SkillKind.writing &&
        currentWriting != null &&
        baselineRow.evaluationJson != null) {
      final prev = _normalizeWritingResult(
        HttpGradingGateway.parseWritingEvaluation(
          _decodeJsonMap(baselineRow.evaluationJson!),
        ),
      );
      for (final currC in currentWriting.criteria) {
        final prevC = prev.criteria.firstWhere(
          (c) => c.criterionCode == currC.criterionCode,
          orElse: () => currC,
        );
        deltas.add(
          CriterionDelta(
            code: currC.criterionCode,
            label: currC.criterionLabel,
            previousBand: prevC.band,
            currentBand: currC.band,
          ),
        );
      }
    } else if (skill == SkillKind.speaking &&
        currentSpeaking != null &&
        baselineRow.evaluationJson != null) {
      final prev = _normalizeSpeakingResult(
        HttpGradingGateway.parseSpeakingEvaluation(
          _decodeJsonMap(baselineRow.evaluationJson!),
        ),
      );
      for (final currC in currentSpeaking.criteria) {
        final prevC = prev.criteria.firstWhere(
          (c) => c.criterionCode == currC.criterionCode,
          orElse: () => currC,
        );
        deltas.add(
          CriterionDelta(
            code: currC.criterionCode,
            label: currC.criterionLabel,
            previousBand: prevC.band,
            currentBand: currC.band,
          ),
        );
      }
    } else if (skill == SkillKind.reading || skill == SkillKind.listening) {
      final prevMap = _decodeJsonMap(baselineRow.submissionJson);
      final prevCorrect = (prevMap['correctCount'] as num?)?.toInt() ?? 0;
      final prevTotal = (prevMap['totalCount'] as num?)?.toInt() ?? 0;
      final prevPct = prevTotal > 0 ? (prevCorrect / prevTotal) * 9.0 : 0.0;
      final currPct = currentTotalCount > 0
          ? (currentCorrectCount / currentTotalCount) * 9.0
          : 0.0;
      deltas.add(
        CriterionDelta(
          code: 'ACC',
          label: 'Accuracy (normalized 0-9)',
          previousBand: double.parse(prevPct.toStringAsFixed(1)),
          currentBand: double.parse(currPct.toStringAsFixed(1)),
        ),
      );
    }

    return AttemptComparisonSnapshot(
      previousAttemptId: baselineSummary.attemptId,
      previousTitle: _shortDateLabel(baselineSummary.updatedAt),
      currentTitle: currentTitle,
      previousOverallBand: baselineSummary.overallBand!,
      currentOverallBand: currentOverallBand,
      deltas: deltas,
    );
  }

  WritingEvaluationResult _normalizeWritingResult(WritingEvaluationResult r) {
    final normalized = r.criteria
        .map(
          (c) => CriterionScore(
            criterionCode: c.criterionCode,
            criterionLabel: c.criterionLabel.isNotEmpty
                ? c.criterionLabel
                : _writingCriterionName(c.criterionCode, r.taskType),
            band: c.band,
            evidenceExcerpt: c.evidenceExcerpt,
            feedbackNote: c.feedbackNote,
          ),
        )
        .toList(growable: false);
    return WritingEvaluationResult(
      attemptId: r.attemptId,
      taskType: r.taskType,
      overallBand: r.overallBand,
      criteria: normalized,
      wordCount: r.wordCount,
      upgradedExcerpt: r.upgradedExcerpt,
      actionableNextStep: r.actionableNextStep,
      modelId: r.modelId,
      rubricVersion: r.rubricVersion,
      inlineEdits: r.inlineEdits,
      modelRewrite: r.modelRewrite,
      vocabUpgrades: r.vocabUpgrades,
      recommendedDrill: r.recommendedDrill,
      isEstimated: r.isEstimated,
    );
  }

  SpeakingEvaluationResult _normalizeSpeakingResult(
    SpeakingEvaluationResult r,
  ) {
    final normalized = r.criteria
        .map(
          (c) => CriterionScore(
            criterionCode: c.criterionCode,
            criterionLabel: c.criterionLabel.isNotEmpty
                ? c.criterionLabel
                : _speakingCriterionName(c.criterionCode),
            band: c.band,
            evidenceExcerpt: c.evidenceExcerpt,
            feedbackNote: c.feedbackNote,
          ),
        )
        .toList(growable: false);
    return SpeakingEvaluationResult(
      attemptId: r.attemptId,
      overallBand: r.overallBand,
      criteria: normalized,
      transcript: r.transcript,
      actionableNextStep: r.actionableNextStep,
      modelId: r.modelId,
      rubricVersion: r.rubricVersion,
      transcriptSegments: r.transcriptSegments,
      vocabUpgrades: r.vocabUpgrades,
      recommendedDrill: r.recommendedDrill,
      isEstimated: r.isEstimated,
    );
  }

  static String _writingCriterionName(String code, WritingTaskType taskType) {
    switch (code.toUpperCase()) {
      case 'TA':
        return 'Task Achievement';
      case 'TR':
        return taskType == WritingTaskType.task2Essay
            ? 'Task Response'
            : 'Task Achievement';
      case 'CC':
        return 'Coherence & Cohesion';
      case 'LR':
        return 'Lexical Resource';
      case 'GRA':
        return 'Grammatical Range & Accuracy';
      default:
        return code;
    }
  }

  static String _speakingCriterionName(String code) {
    switch (code.toUpperCase()) {
      case 'FC':
        return 'Fluency & Coherence';
      case 'LR':
        return 'Lexical Resource';
      case 'GRA':
        return 'Grammatical Range & Accuracy';
      case 'PR':
        return 'Pronunciation';
      default:
        return code;
    }
  }

  static String _defaultStageLabel(AttemptStatus status, String? remoteJobId) {
    if (status == AttemptStatus.uploadingAudio) {
      return 'Uploading recording to secure storage...';
    }
    if (status == AttemptStatus.queuedRemote ||
        (remoteJobId != null && remoteJobId.isNotEmpty)) {
      return 'AI examiner queued & preparing rubric evaluation...';
    }
    return 'Saved locally — syncing submission for evaluation...';
  }

  static String _formatWorkerStage(String status, String? stageDetail) {
    if (stageDetail != null && stageDetail.trim().isNotEmpty) {
      return stageDetail.trim();
    }
    switch (status) {
      case 'processing_audio':
      case 'transcoding':
        return 'Transcribing speaking response...';
      case 'evaluating':
        return 'Scoring official IELTS rubric criteria...';
      case 'repairing':
        return 'Verifying rubric quotes & schema consistency...';
      case 'queued':
      default:
        return 'Queued in AI evaluation worker...';
    }
  }

  static Map<String, Object?> _decodeJsonMap(String raw) {
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, Object?>) return decoded;
      if (decoded is Map) {
        return decoded.map(
          (k, v) => MapEntry<String, Object?>(k.toString(), v),
        );
      }
    } on Object {
      // Ignore malformed payloads gracefully.
    }
    return const <String, Object?>{};
  }

  static String _humanizePackId(String packId, SkillKind skill) {
    if (packId.isEmpty) return _skillLabel(skill);
    final parts = packId.split(RegExp('[-_]')).where((p) => p.isNotEmpty).map((
      p,
    ) {
      if (p == 'ielts') return 'IELTS';
      if (p == 'acad') return 'Academic';
      if (p == 'gt') return 'General';
      return p[0].toUpperCase() + p.substring(1);
    });
    return parts.join(' ');
  }

  static String _skillLabel(SkillKind skill) {
    switch (skill) {
      case SkillKind.speaking:
        return 'Speaking';
      case SkillKind.writing:
        return 'Writing';
      case SkillKind.reading:
        return 'Reading';
      case SkillKind.listening:
        return 'Listening';
      case SkillKind.vocabulary:
        return 'Vocabulary';
    }
  }

  String _shortDateLabel(DateTime dt) {
    final local = dt.toLocal();
    const months = <String>[
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final m = months[(local.month - 1).clamp(0, 11)];
    return '$m ${local.day}';
  }
}
