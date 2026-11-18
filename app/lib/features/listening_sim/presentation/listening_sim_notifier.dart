import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/exams/countdown_clock_tracker.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/exams/local_objective_scorer.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/services/audio_player_gateway.dart';
import 'package:mockza/services/media_bytes_platform.dart';

/// Parsed Listening dialogue segment for interactive synced transcript.
@immutable
class ListeningTranscriptEntry {
  /// Creates a [ListeningTranscriptEntry].
  const new({
    required this.speaker,
    required this.text,
    required this.startMs,
    required this.endMs,
  });

  /// Speaker label (e.g. "Receptionist").
  final String speaker;

  /// Dialogue line text.
  final String text;

  /// Start offset in milliseconds.
  final int startMs;

  /// End offset in milliseconds.
  final int endMs;
}

/// Immutable UI state for Listening audio playback & answer sheet (Screens 10 & 11).
@immutable
class ListeningSimState {
  /// Creates a [ListeningSimState].
  const new({
    required this.packId,
    required this.isLoadingPack,
    required this.pack,
    required this.sectionIndex,
    required this.playbackSpeed,
    required this.isPlaying,
    required this.isAudioReady,
    required this.isExamMode,
    required this.currentPosition,
    required this.totalDuration,
    required this.answers,
    required this.showTranscript,
    required this.isSubmitting,
    this.remainingSeconds = 1800,
    this.totalSeconds = 1800,
    this.isPaused = false,
    this.errorMessage,
  });

  /// Postgres Listening pack identifier.
  final String packId;

  /// Whether pack metadata & audio are loading.
  final bool isLoadingPack;

  /// Loaded Listening pack specification.
  final ListeningPackSpec? pack;

  /// Active IELTS Listening section (`1..sections.length`).
  final int sectionIndex;

  /// Audio playback rate (`0.85`, `1.0`, `1.25`).
  final double playbackSpeed;

  /// Whether track playback is currently active.
  final bool isPlaying;

  /// Whether SeaweedFS `.m4a` audio stream is loaded and ready.
  final bool isAudioReady;

  /// Whether strict exam mode linear playback lock is enforced.
  final bool isExamMode;

  /// Current audio track playback position.
  final Duration currentPosition;

  /// Total track duration.
  final Duration totalDuration;

  /// Learner responses keyed by question number (`1..totalQuestions`).
  final Map<int, String> answers;

  /// Whether the synced transcript is displayed (Study Mode only).
  final bool showTranscript;

  /// Whether submission/grading is running.
  final bool isSubmitting;

  /// Exam mode remaining session seconds (`30:00` standard IELTS Listening).
  final int remainingSeconds;

  /// Total exam session budget in seconds.
  final int totalSeconds;

  /// Whether Study Mode countdown timer is paused.
  final bool isPaused;

  /// Non-fatal load/audio/submit error feedback.
  final String? errorMessage;

  /// Active [ListeningSectionSpec], or null before load.
  ListeningSectionSpec? get activeSection {
    final secs = pack?.sections ?? const <ListeningSectionSpec>[];
    if (secs.isEmpty) return null;
    for (final s in secs) {
      if (s.sectionIndex == sectionIndex) return s;
    }
    return secs.first;
  }

  /// Parses active section transcript lines with timestamps.
  List<ListeningTranscriptEntry> get transcriptEntries {
    final raw = activeSection?.transcriptText.trim() ?? '';
    if (raw.isEmpty) return const <ListeningTranscriptEntry>[];
    if (raw.startsWith('[')) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          final entries = <ListeningTranscriptEntry>[];
          var idx = 0;
          for (final item in decoded.whereType<Map<String, dynamic>>()) {
            final start = (item['startMs'] as num?)?.toInt() ?? (idx * 20000);
            final end = (item['endMs'] as num?)?.toInt() ?? (start + 20000);
            entries.add(
              ListeningTranscriptEntry(
                speaker: (item['speaker'] as String?) ?? 'Speaker',
                text: (item['text'] as String?) ?? '',
                startMs: start,
                endMs: end,
              ),
            );
            idx++;
          }
          return entries;
        }
      } on Object {
        // Fall through to plain-line splitter.
      }
    }
    final lines = raw
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();
    return List.generate(lines.length, (i) {
      return ListeningTranscriptEntry(
        speaker: 'Audio ${i + 1}',
        text: lines[i],
        startMs: i * 20000,
        endMs: (i + 1) * 20000,
      );
    });
  }

  /// Total questions in loaded pack.
  int get totalQuestions => pack?.totalQuestions ?? 0;

  /// Count of answered questions.
  int get answeredCount =>
      answers.values.where((v) => v.trim().isNotEmpty).length;

  /// Returns a copy with updated playback state.
  ListeningSimState copyWith({
    String? packId,
    bool? isLoadingPack,
    ListeningPackSpec? pack,
    int? sectionIndex,
    double? playbackSpeed,
    bool? isPlaying,
    bool? isAudioReady,
    bool? isExamMode,
    Duration? currentPosition,
    Duration? totalDuration,
    Map<int, String>? answers,
    bool? showTranscript,
    bool? isSubmitting,
    int? remainingSeconds,
    int? totalSeconds,
    bool? isPaused,
    String? errorMessage,
    bool clearError = false,
  }) => ListeningSimState(
    packId: packId ?? this.packId,
    isLoadingPack: isLoadingPack ?? this.isLoadingPack,
    pack: pack ?? this.pack,
    sectionIndex: sectionIndex ?? this.sectionIndex,
    playbackSpeed: playbackSpeed ?? this.playbackSpeed,
    isPlaying: isPlaying ?? this.isPlaying,
    isAudioReady: isAudioReady ?? this.isAudioReady,
    isExamMode: isExamMode ?? this.isExamMode,
    currentPosition: currentPosition ?? this.currentPosition,
    totalDuration: totalDuration ?? this.totalDuration,
    answers: answers ?? this.answers,
    showTranscript: showTranscript ?? this.showTranscript,
    isSubmitting: isSubmitting ?? this.isSubmitting,
    remainingSeconds: remainingSeconds ?? this.remainingSeconds,
    totalSeconds: totalSeconds ?? this.totalSeconds,
    isPaused: isPaused ?? this.isPaused,
    errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
  );
}

/// Manages Listening section progression, real `AudioPlayerGateway` playback of
/// SeaweedFS `.m4a` tracks, Exam Linear Lock vs Study Interactive controls, and
/// deterministic [LocalObjectiveScorer] grading.
class ListeningSimNotifier extends Notifier<ListeningSimState> {
  StreamSubscription<Duration>? _posSub;
  StreamSubscription<Duration?>? _durSub;
  StreamSubscription<bool>? _playSub;
  Timer? _countdownTimer;
  CountdownClockTracker? _clockTracker;
  DateTime? _sessionStartTime;
  bool _isDisposed = false;
  AudioPlayerGateway? _player;
  String? _activeAudioBlobUrl;
  String? _mockSessionId;
  String? _mockStageKey;

  @override
  ListeningSimState build() {
    _isDisposed = false;
    _player = ref.read(audioPlayerGatewayProvider);
    _sessionStartTime = ref.read(clockProvider).now();
    _clockTracker = CountdownClockTracker(clock: ref.read(clockProvider));
    ref.onDispose(_cleanupAll);

    return const ListeningSimState(
      packId: 'ielts-listening-seed-01',
      isLoadingPack: false,
      pack: null,
      sectionIndex: 1,
      playbackSpeed: 1,
      isPlaying: false,
      isAudioReady: false,
      isExamMode: true,
      currentPosition: Duration.zero,
      totalDuration: Duration(minutes: 5),
      answers: {},
      showTranscript: false,
      isSubmitting: false,
    );
  }

  /// Loads Listening pack [packId] and prepares the SeaweedFS audio stream.
  Future<void> initialize(
    String packId, {
    bool isExamMode = true,
    String? mockSessionId,
    String? mockStageKey,
  }) async {
    _mockSessionId = mockSessionId;
    _mockStageKey = mockStageKey;
    _countdownTimer?.cancel();
    await _cancelPlayerSubs();
    final clock = ref.read(clockProvider);
    _sessionStartTime = clock.now();
    (_clockTracker ??= CountdownClockTracker(clock: clock)).start(
      remainingSeconds: 1800,
    );

    state = state.copyWith(
      packId: packId,
      isExamMode: isExamMode,
      isLoadingPack: true,
      isPlaying: false,
      isAudioReady: false,
      showTranscript: false,
      playbackSpeed: 1,
      currentPosition: Duration.zero,
      answers: const <int, String>{},
      remainingSeconds: 1800,
      totalSeconds: 1800,
      isPaused: false,
      clearError: true,
    );

    try {
      final sync = ref.read(contentSyncServiceProvider);
      final catalog = ref.read(examCatalogRepositoryProvider);
      final editionConfig = ref.read(editionConfigProvider);
      final bundleRes = await sync.ensureExamBundle(packId);
      if (_isDisposed) return;

      if (bundleRes.isFailure) {
        state = state.copyWith(
          isLoadingPack: false,
          errorMessage:
              'Could not load Listening pack "$packId": ${bundleRes.failureOrNull?.message}.',
        );
        return;
      }

      final spec = catalog.parseListeningPack(bundleRes.valueOrNull!);
      final firstSecIndex = spec.sections.isNotEmpty
          ? spec.sections.first.sectionIndex
          : 1;
      final budgetSecs = (spec.durationSeconds > 600)
          ? (spec.durationSeconds + 600)
          : 1800;
      (_clockTracker ??= CountdownClockTracker(
        clock: ref.read(clockProvider),
      )).start(remainingSeconds: budgetSecs);
      state = state.copyWith(
        isLoadingPack: false,
        pack: spec,
        sectionIndex: firstSecIndex,
        totalDuration: spec.durationSeconds > 0
            ? Duration(seconds: spec.durationSeconds)
            : const Duration(minutes: 5),
        remainingSeconds: budgetSecs,
        totalSeconds: budgetSecs,
        clearError: true,
      );
      _startExamCountdown();

      final audioPath = spec.audioRelativePath.trim();
      if (audioPath.isNotEmpty) {
        final offlinePlayable = await resolveCachedAudioPlayableUrl(audioPath);
        if (_isDisposed) {
          if (offlinePlayable != null && offlinePlayable.startsWith('blob:')) {
            await releasePlayableAudioUrl(offlinePlayable);
          }
          return;
        }
        await _releaseActiveBlobUrl();
        if (offlinePlayable != null && offlinePlayable.startsWith('blob:')) {
          _activeAudioBlobUrl = offlinePlayable;
        }
        final resolvedUrl =
            offlinePlayable ?? editionConfig.resolveMediaUrl(audioPath);
        await _loadAudioUrl(resolvedUrl, isExamMode: isExamMode);
      }
    } on Object catch (err) {
      if (_isDisposed) return;
      state = state.copyWith(
        isLoadingPack: false,
        errorMessage: 'Failed to load Listening pack: $err',
      );
    }
  }

  Future<void> _loadAudioUrl(
    String resolvedUrl, {
    required bool isExamMode,
  }) async {
    final player = ref.read(audioPlayerGatewayProvider);
    try {
      final loadRes = await player.loadFile(resolvedUrl);
      if (_isDisposed) return;
      loadRes.when(
        success: (dur) {
          state = state.copyWith(
            isAudioReady: true,
            totalDuration: dur ?? state.totalDuration,
            clearError: true,
          );
          _attachPlayerStreams(player);
        },
        failure: (f) {
          state = state.copyWith(
            isAudioReady: false,
            errorMessage: 'Audio unavailable: ${f.message}',
          );
        },
      );
    } on Object {
      // Non-fatal in headless test environments without audio platform plugin.
    }
  }

  void _attachPlayerStreams(AudioPlayerGateway player) {
    unawaited(_posSub?.cancel());
    unawaited(_durSub?.cancel());
    unawaited(_playSub?.cancel());

    _posSub = player.watchPosition().listen((pos) {
      if (!_isDisposed) {
        state = state.copyWith(currentPosition: pos);
      }
    }, onError: (_) {});

    _durSub = player.watchDuration().listen((dur) {
      if (!_isDisposed && dur != null && dur > Duration.zero) {
        state = state.copyWith(totalDuration: dur);
      }
    }, onError: (_) {});

    _playSub = player.watchIsPlaying().listen((playing) {
      if (!_isDisposed) {
        state = state.copyWith(isPlaying: playing);
      }
    }, onError: (_) {});
  }

  Future<void> _releaseActiveBlobUrl() async {
    final blob = _activeAudioBlobUrl;
    _activeAudioBlobUrl = null;
    if (blob != null) {
      await releasePlayableAudioUrl(blob);
    }
  }

  void _cleanupAll() {
    _isDisposed = true;
    _countdownTimer?.cancel();
    final posSub = _posSub;
    final durSub = _durSub;
    final playSub = _playSub;
    _posSub = null;
    _durSub = null;
    _playSub = null;
    if (posSub != null) unawaited(posSub.cancel());
    if (durSub != null) unawaited(durSub.cancel());
    if (playSub != null) unawaited(playSub.cancel());

    // Stop playback synchronously on captured gateway without calling `ref.read` (`RR-01`).
    final player = _player;
    if (player != null) {
      unawaited(player.pause().then((_) {}, onError: (_) {}));
    }
    final blob = _activeAudioBlobUrl;
    _activeAudioBlobUrl = null;
    if (blob != null) {
      unawaited(releasePlayableAudioUrl(blob));
    }
  }

  Future<void> _cancelPlayerSubs() async {
    final posSub = _posSub;
    final durSub = _durSub;
    final playSub = _playSub;
    _posSub = null;
    _durSub = null;
    _playSub = null;
    await posSub?.cancel();
    await durSub?.cancel();
    await playSub?.cancel();
    try {
      await _player?.pause();
    } on Object {
      // Ignore uninitialized player on teardown.
    }
    await _releaseActiveBlobUrl();
  }

  /// Toggles timer pause/resume in Study Mode.
  void toggleTimerPause() {
    if (state.isExamMode) return;
    final nextPaused = !state.isPaused;
    if (nextPaused) {
      _clockTracker?.pause();
    } else {
      _clockTracker?.resume();
    }
    state = state.copyWith(isPaused: nextPaused);
  }

  void _startExamCountdown() {
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_isDisposed) {
        timer.cancel();
        return;
      }
      if (state.isPaused) return;
      final rem = _clockTracker?.currentRemaining() ?? state.remainingSeconds;
      if (rem != state.remainingSeconds) {
        state = state.copyWith(remainingSeconds: rem);
      }
      if (rem <= 0) {
        timer.cancel();
      }
    });
  }

  /// Toggles play / pause (in Exam Mode audio can start, and pauses are disabled once started).
  Future<void> togglePlay() async {
    if (state.isExamMode && state.isPlaying) {
      return; // IELTS Exam Linear Lock prohibits pausing mid-recording
    }
    final player = ref.read(audioPlayerGatewayProvider);
    final nextPlaying = !state.isPlaying;
    state = state.copyWith(isPlaying: nextPlaying);
    try {
      if (nextPlaying) {
        await player.play();
      } else {
        await player.pause();
      }
    } on Object {
      // Keep UI responsive in isolated widget tests.
    }
  }

  /// Updates the audio playback rate multiplier (Study Mode only).
  Future<void> setSpeed(double speed) async {
    if (state.isExamMode && speed != 1.0) return;
    final clamped = speed.clamp(0.75, 1.5);
    state = state.copyWith(playbackSpeed: clamped);
    try {
      await ref.read(audioPlayerGatewayProvider).setSpeed(clamped);
    } on Object {
      // Ignore when audio plugin absent.
    }
  }

  /// Seeks to [pos] (Study Mode only).
  Future<void> seek(Duration pos) async {
    if (state.isExamMode) return;
    state = state.copyWith(currentPosition: pos);
    try {
      await ref.read(audioPlayerGatewayProvider).seek(pos);
    } on Object {
      // Ignore when audio plugin absent.
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

  /// Toggles an option letter for multi-select questions.
  void toggleMultiAnswer(int questionNumber, String letter) {
    final existing = (state.answers[questionNumber] ?? '')
        .split(',')
        .map((e) => e.trim())
        .where((e) => e.isNotEmpty)
        .toSet();
    if (existing.contains(letter)) {
      existing.remove(letter);
    } else {
      existing.add(letter);
    }
    final sorted = existing.toList()..sort();
    setAnswer(questionNumber, sorted.join(', '));
  }

  /// Switches active section (`1..4`).
  void selectSection(int section) {
    final maxSec = state.pack?.sections.length ?? 4;
    state = state.copyWith(sectionIndex: section.clamp(1, maxSec));
  }

  /// Toggles synced transcript overlay (Study Mode only).
  void toggleTranscript() {
    if (state.isExamMode) return;
    state = state.copyWith(showTranscript: !state.showTranscript);
  }

  /// Grades all pack questions deterministically using `LocalObjectiveScorer`,
  /// writes UUIDv4 attempt & activity log, and returns `attemptId`.
  Future<String?> submitListening() async {
    if (state.isSubmitting) return null;
    final pack = state.pack;
    if (pack == null) return null;

    _countdownTimer?.cancel();
    await _cancelPlayerSubs();
    state = state.copyWith(isSubmitting: true, clearError: true);

    try {
      final attemptRepo = ref.read(attemptRepositoryProvider);
      final profileRepo = ref.read(profileRepositoryProvider);
      final progressRepo = ref.read(progressRepositoryProvider);
      final entropy = ref.read(entropySourceProvider);
      final clock = ref.read(clockProvider);

      final profile = await profileRepo.loadOrInitializePrimary();
      final effectiveTrack = ExamTrack.resolveForPackOrProfile(
        packId: state.packId,
        profileExamId: profile.examId,
      );
      final examId = effectiveTrack.id;

      final allQuestions = pack.sections.expand((s) => s.questions).toList();
      final inputs = allQuestions
          .map(
            (q) => ObjectiveQuestionAnswer(
              questionId: q.questionId.isNotEmpty
                  ? q.questionId
                  : 'q_${q.number}',
              acceptedAnswers: q.acceptedVariants,
              userAnswer: state.answers[q.number],
              maxWords: q.maxWords,
              questionType: q.questionType,
            ),
          )
          .toList(growable: false);

      final report = LocalObjectiveScorer.score(
        answers: inputs,
        skill: SkillKind.listening,
        track: effectiveTrack,
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
            };
          })
          .toList(growable: false);

      final elapsedSeconds = _sessionStartTime != null
          ? clock.now().difference(_sessionStartTime!).inSeconds.clamp(5, 3600)
          : state.currentPosition.inSeconds.clamp(5, 3600);

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
        skill: SkillKind.listening,
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
          errorMessage: 'Failed to submit Listening test: $err',
        );
      }
      return null;
    }
  }
}
