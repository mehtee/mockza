import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/exams/countdown_clock_tracker.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/services/media_bytes_platform.dart';

/// Phase of a Speaking prompt turn.
enum SpeakingPhase {
  /// Preparation countdown (Part 2) or prompt preview before recording (Parts 1 & 3).
  prepOrReady,

  /// Active microphone capture for the current turn.
  recording,

  /// Turn finished and ready for playback verification, next turn, or submission.
  recorded,
}

/// Recorded audio clip captured for a single Speaking prompt turn.
@immutable
class RecordedSpeakingTurn {
  /// Creates a [RecordedSpeakingTurn].
  const new({
    required this.partIndex,
    required this.promptId,
    required this.promptText,
    required this.localPathOrUrl,
    required this.durationMs,
    required this.contentType,
  });

  /// IELTS Speaking part (`1`, `2`, or `3`).
  final int partIndex;

  /// Unique prompt identifier inside the session.
  final String promptId;

  /// Prompt text displayed to the candidate.
  final String promptText;

  /// Recorded file path (native) or blob URL (Web).
  final String localPathOrUrl;

  /// Turn duration in milliseconds.
  final int durationMs;

  /// Audio MIME type recorded by the platform encoder.
  final String contentType;
}

/// Immutable UI state for the Speaking exam simulator (Screens 04 & 05).
@immutable
class SpeakingSimState {
  /// Creates a [SpeakingSimState].
  const new({
    required this.packId,
    required this.sessionId,
    required this.sessionTitle,
    required this.isExamMode,
    required this.isLoadingPack,
    required this.prompts,
    required this.currentTurnIndex,
    required this.phase,
    required this.remainingSeconds,
    required this.totalSeconds,
    required this.hasMicPermission,
    required this.isPreviewingMic,
    required this.amplitude,
    required this.isClipping,
    required this.isSilent,
    required this.cueCardNotes,
    required this.recordedTurns,
    required this.isPlayingBack,
    required this.playingPromptId,
    required this.isSubmitting,
    this.errorMessage,
  });

  /// Active Postgres speaking pack ID.
  final String packId;

  /// UUIDv4 attempt ID generated once for this session.
  final String sessionId;

  /// Pack headline title.
  final String sessionTitle;

  /// Exam Mode (strict countdowns, single recording) vs Study Mode.
  final bool isExamMode;

  /// Whether pack JSON is currently loading from Drift/API.
  final bool isLoadingPack;

  /// All prompts loaded from Postgres `SpeakingSessionSpec`.
  final List<SpeakingPromptSpec> prompts;

  /// Index inside [prompts].
  final int currentTurnIndex;

  /// Active turn phase.
  final SpeakingPhase phase;

  /// Seconds remaining in active countdown.
  final int remainingSeconds;

  /// Total seconds in active phase.
  final int totalSeconds;

  /// Whether microphone permission is granted.
  final bool hasMicPermission;

  /// Whether live mic-check preview capture is active (waveform responsive).
  final bool isPreviewingMic;

  /// Real-time normalized microphone amplitude `[0.0..1.0]`.
  final double amplitude;

  /// Whether audio amplitude hit clipping ceiling.
  final bool isClipping;

  /// Whether microphone input is currently near silent.
  final bool isSilent;

  /// Candidate scratchpad notes for Part 2 cue card.
  final String cueCardNotes;

  /// Recorded turns keyed by `promptId`.
  final Map<String, RecordedSpeakingTurn> recordedTurns;

  /// Whether turn playback check is currently playing.
  final bool isPlayingBack;

  /// Prompt ID currently playing back, or null.
  final String? playingPromptId;

  /// Whether audio upload & remote grading enqueueing is in flight.
  final bool isSubmitting;

  /// Optional non-fatal error message (offline load, permission, upload).
  final String? errorMessage;

  /// Active [SpeakingPromptSpec], or null if not yet loaded.
  SpeakingPromptSpec? get currentPrompt =>
      (currentTurnIndex >= 0 && currentTurnIndex < prompts.length)
      ? prompts[currentTurnIndex]
      : null;

  /// Active IELTS Speaking part (`1`, `2`, or `3`).
  int get activePart => currentPrompt?.partIndex ?? 2;

  /// Active prompt text.
  String get promptTitle =>
      currentPrompt?.promptText ?? 'Loading speaking prompt...';

  /// Cue card bullet points (Part 2).
  List<String> get cueCardBullets =>
      currentPrompt?.bulletPoints ?? const <String>[];

  /// Whether Part 2 prep countdown is running.
  bool get isPreparing =>
      phase == SpeakingPhase.prepOrReady &&
      (currentPrompt?.prepSeconds ?? 0) > 0;

  /// Whether active turn recording is capturing audio.
  bool get isRecording => phase == SpeakingPhase.recording;

  /// Set of completed parts (`1`, `2`, `3`).
  Set<int> get completedParts =>
      recordedTurns.values.map((t) => t.partIndex).toSet();

  /// Returns a copy with updated Speaking simulator state.
  SpeakingSimState copyWith({
    String? packId,
    String? sessionId,
    String? sessionTitle,
    bool? isExamMode,
    bool? isLoadingPack,
    List<SpeakingPromptSpec>? prompts,
    int? currentTurnIndex,
    SpeakingPhase? phase,
    int? remainingSeconds,
    int? totalSeconds,
    bool? hasMicPermission,
    bool? isPreviewingMic,
    double? amplitude,
    bool? isClipping,
    bool? isSilent,
    String? cueCardNotes,
    Map<String, RecordedSpeakingTurn>? recordedTurns,
    bool? isPlayingBack,
    String? playingPromptId,
    bool clearPlayingPrompt = false,
    bool? isSubmitting,
    String? errorMessage,
    bool clearError = false,
  }) => SpeakingSimState(
    packId: packId ?? this.packId,
    sessionId: sessionId ?? this.sessionId,
    sessionTitle: sessionTitle ?? this.sessionTitle,
    isExamMode: isExamMode ?? this.isExamMode,
    isLoadingPack: isLoadingPack ?? this.isLoadingPack,
    prompts: prompts ?? this.prompts,
    currentTurnIndex: currentTurnIndex ?? this.currentTurnIndex,
    phase: phase ?? this.phase,
    remainingSeconds: remainingSeconds ?? this.remainingSeconds,
    totalSeconds: totalSeconds ?? this.totalSeconds,
    hasMicPermission: hasMicPermission ?? this.hasMicPermission,
    isPreviewingMic: isPreviewingMic ?? this.isPreviewingMic,
    amplitude: amplitude ?? this.amplitude,
    isClipping: isClipping ?? this.isClipping,
    isSilent: isSilent ?? this.isSilent,
    cueCardNotes: cueCardNotes ?? this.cueCardNotes,
    recordedTurns: recordedTurns ?? this.recordedTurns,
    isPlayingBack: isPlayingBack ?? this.isPlayingBack,
    playingPromptId: clearPlayingPrompt
        ? null
        : (playingPromptId ?? this.playingPromptId),
    isSubmitting: isSubmitting ?? this.isSubmitting,
    errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
  );
}

/// Coordinates real Postgres Speaking packs, live mic waveform preview, recording,
/// SeaweedFS upload, and AI grading enqueueing.
class SpeakingSimNotifier extends Notifier<SpeakingSimState> {
  Timer? _countdownTimer;
  CountdownClockTracker? _clockTracker;
  bool _clockForRecording = false;
  StreamSubscription<double>? _ampSub;
  StreamSubscription<bool>? _playSub;
  String? _previewPath;
  DateTime? _turnStartTime;
  DateTime? _sessionStartTime;
  bool _isDisposed = false;
  int _initGeneration = 0;

  @override
  SpeakingSimState build() {
    _isDisposed = false;
    final entropy = ref.read(entropySourceProvider);
    final clock = ref.read(clockProvider);
    _sessionStartTime = clock.now();

    ref.onDispose(_cleanupAll);

    return SpeakingSimState(
      packId: 'ielts-speaking-seed-01',
      sessionId: entropy.nextUuidV4(),
      sessionTitle: 'Speaking Simulator',
      isExamMode: true,
      isLoadingPack: true,
      prompts: const <SpeakingPromptSpec>[],
      currentTurnIndex: 0,
      phase: SpeakingPhase.prepOrReady,
      remainingSeconds: 60,
      totalSeconds: 60,
      hasMicPermission: true,
      isPreviewingMic: false,
      amplitude: 0,
      isClipping: false,
      isSilent: false,
      cueCardNotes: '',
      recordedTurns: const <String, RecordedSpeakingTurn>{},
      isPlayingBack: false,
      playingPromptId: null,
      isSubmitting: false,
    );
  }

  /// Loads [packId] from Drift/Postgres, checks microphone permission, and starts
  /// the live microphone level preview.
  Future<void> initialize(
    String packId, {
    bool isExamMode = true,
  }) async {
    final entropy = ref.read(entropySourceProvider);
    final clock = ref.read(clockProvider);
    final gen = ++_initGeneration;
    _sessionStartTime = clock.now();
    _clockTracker ??= CountdownClockTracker(clock: clock);

    state = state.copyWith(
      packId: packId,
      sessionId: entropy.nextUuidV4(),
      isExamMode: isExamMode,
      isLoadingPack: true,
      clearError: true,
      recordedTurns: const <String, RecordedSpeakingTurn>{},
    );

    await _loadPackBundle(packId, gen);
    if (_isDisposed || gen != _initGeneration) return;
    await _configureMicAndStartPreview();
  }

  Future<void> _loadPackBundle(String packId, int gen) async {
    try {
      final sync = ref.read(contentSyncServiceProvider);
      final catalog = ref.read(examCatalogRepositoryProvider);
      final bundleRes = await sync.ensureExamBundle(packId);
      if (_isDisposed || gen != _initGeneration) return;

      bundleRes.when(
        success: (bundle) {
          final spec = catalog.parseSpeakingSession(bundle);
          final prompts = spec.prompts;
          final first = prompts.isNotEmpty ? prompts.first : null;
          final prepSecs = first?.prepSeconds ?? 0;
          final initialTotal = prepSecs > 0
              ? prepSecs
              : (first?.speakSeconds ?? 60);

          state = state.copyWith(
            isLoadingPack: false,
            sessionTitle: spec.title,
            prompts: prompts,
            currentTurnIndex: 0,
            phase: SpeakingPhase.prepOrReady,
            remainingSeconds: initialTotal,
            totalSeconds: initialTotal,
            clearError: true,
          );

          if (prepSecs > 0) {
            _startPrepCountdown(prepSecs);
          }
        },
        failure: (f) {
          state = state.copyWith(
            isLoadingPack: false,
            errorMessage:
                'Could not load Speaking pack "$packId": ${f.message}. Check connection and retry.',
          );
        },
      );
    } on Object catch (err) {
      if (_isDisposed) return;
      state = state.copyWith(
        isLoadingPack: false,
        errorMessage: 'Failed to load Speaking pack: $err',
      );
    }
  }

  Future<void> _configureMicAndStartPreview() async {
    try {
      await ref.read(platformAudioChannelProvider).configureRecordingSession();
    } on Object {
      // Non-fatal in Web / test environments without native channel.
    }

    final recorder = ref.read(audioRecorderGatewayProvider);
    try {
      final permRes = await recorder.hasPermission();
      if (_isDisposed) return;
      final granted = permRes.valueOrNull ?? false;
      state = state.copyWith(hasMicPermission: granted);
      if (granted) {
        await startMicPreview();
      }
    } on Object {
      if (!_isDisposed) {
        state = state.copyWith(hasMicPermission: true);
      }
    }
  }

  /// Re-requests microphone permission and starts the live waveform preview.
  Future<void> retryMicPermission() async {
    await _configureMicAndStartPreview();
  }

  /// Opens OS application settings when microphone permission was denied permanently.
  Future<void> openMicSettings() async {
    try {
      await ref.read(platformAudioChannelProvider).openAppSettings();
    } on Object {
      // Ignore on unsupported targets.
    }
  }

  /// Starts live microphone level capture in prep/ready state so the wave
  /// responds visually to real speech before active recording begins.
  Future<void> startMicPreview() async {
    if (_isDisposed || state.isRecording || !state.hasMicPermission) return;
    if (state.isPreviewingMic) return;

    final recorder = ref.read(audioRecorderGatewayProvider);
    try {
      final previewPath = await createTempRecordingPath(
        'speaking_preview_${state.sessionId}.m4a',
      );
      _previewPath = previewPath;
      final startRes = await recorder.startRecording(outputPath: previewPath);
      if (_isDisposed) return;

      startRes.when(
        success: (_) {
          state = state.copyWith(
            isPreviewingMic: true,
            isSilent: true,
            clearError: true,
          );
          _attachAmplitudeListener();
        },
        failure: (_) {
          // Browsers may wait for explicit tap; allow manual mic test button.
          state = state.copyWith(isPreviewingMic: false);
        },
      );
    } on Object {
      if (!_isDisposed) {
        state = state.copyWith(isPreviewingMic: false);
      }
    }
  }

  /// Stops the preview mic capture and deletes any temporary preview file.
  Future<void> stopMicPreview() async {
    await _ampSub?.cancel();
    _ampSub = null;
    if (state.isPreviewingMic) {
      try {
        final res = await ref
            .read(audioRecorderGatewayProvider)
            .stopRecording();
        final path = res.valueOrNull ?? _previewPath;
        if (path != null && path.isNotEmpty) {
          await deleteRecordedAudioClip(path);
        }
      } on Object {
        // Best-effort cleanup.
      }
      _previewPath = null;
      if (!_isDisposed) {
        state = state.copyWith(
          isPreviewingMic: false,
          amplitude: 0,
          isSilent: false,
          isClipping: false,
        );
      }
    }
  }

  void _attachAmplitudeListener() {
    unawaited(_ampSub?.cancel());
    final recorder = ref.read(audioRecorderGatewayProvider);
    _ampSub = recorder.watchAmplitude().listen(
      (level) {
        if (_isDisposed) return;
        state = state.copyWith(
          amplitude: level,
          isSilent: level < 0.06,
          isClipping: level > 0.94,
        );
      },
      onError: (_) {},
    );
  }

  void _startPrepCountdown(int seconds) {
    _countdownTimer?.cancel();
    _clockForRecording = false;
    (_clockTracker ??= CountdownClockTracker(
      clock: ref.read(clockProvider),
    )).start(remainingSeconds: seconds);
    state = state.copyWith(
      phase: SpeakingPhase.prepOrReady,
      remainingSeconds: seconds,
      totalSeconds: seconds,
    );
    _countdownTimer = Timer.periodic(const Duration(milliseconds: 500), (
      timer,
    ) {
      if (_isDisposed) {
        timer.cancel();
        return;
      }
      reconcileTimer();
    });
  }

  /// Synchronizes countdown state against wall clock after resume or tick (`TD-37`).
  void reconcileTimer() {
    final tracker = _clockTracker;
    if (_isDisposed || tracker == null) return;
    if (state.phase == SpeakingPhase.recorded) return;
    if (!_clockForRecording && (state.currentPrompt?.prepSeconds ?? 0) <= 0) {
      return;
    }
    final rem = tracker.currentRemaining();
    if (rem != state.remainingSeconds) {
      state = state.copyWith(remainingSeconds: rem);
    }
    if (rem <= 0) {
      _countdownTimer?.cancel();
      if (_clockForRecording && state.phase == SpeakingPhase.recording) {
        unawaited(finishResponse());
      } else if (!_clockForRecording && state.phase == SpeakingPhase.prepOrReady) {
        unawaited(startSpeaking());
      }
    }
  }

  /// Starts active microphone recording for the current Speaking turn.
  Future<void> startSpeaking() async {
    _countdownTimer?.cancel();
    await stopMicPreview();
    if (_isDisposed) return;

    final recorder = ref.read(audioRecorderGatewayProvider);
    final permRes = await recorder.hasPermission();
    if (_isDisposed) return;
    final granted = permRes.valueOrNull ?? false;
    if (!granted) {
      state = state.copyWith(
        hasMicPermission: false,
        errorMessage:
            'Please enable microphone permission to record your response.',
      );
      return;
    }

    final prompt = state.currentPrompt;
    final speakSecs = prompt?.speakSeconds ?? 120;
    final turnKey = prompt?.promptId ?? 'turn_${state.currentTurnIndex}';
    final outPath = await createTempRecordingPath(
      'speaking_${state.sessionId}_$turnKey.m4a',
    );
    final startRes = await recorder.startRecording(outputPath: outPath);
    if (_isDisposed) return;

    startRes.when(
      success: (_) {
        _turnStartTime = ref.read(clockProvider).now();
        _clockForRecording = true;
        (_clockTracker ??= CountdownClockTracker(
          clock: ref.read(clockProvider),
        )).start(remainingSeconds: speakSecs);
        state = state.copyWith(
          hasMicPermission: true,
          isPreviewingMic: false,
          phase: SpeakingPhase.recording,
          remainingSeconds: speakSecs,
          totalSeconds: speakSecs,
          isSilent: false,
          isClipping: false,
          clearError: true,
        );
        _attachAmplitudeListener();
        _countdownTimer = Timer.periodic(
          const Duration(milliseconds: 500),
          (timer) {
            if (_isDisposed) {
              timer.cancel();
              return;
            }
            reconcileTimer();
          },
        );
      },
      failure: (f) {
        state = state.copyWith(
          errorMessage: 'Could not start recording: ${f.message}',
        );
      },
    );
  }

  /// Stops active microphone recording and saves the turn clip locally.
  Future<void> finishResponse() async {
    _countdownTimer?.cancel();
    await _ampSub?.cancel();
    _ampSub = null;

    final recorder = ref.read(audioRecorderGatewayProvider);
    String? recordedPath;
    try {
      final stopRes = await recorder.stopRecording();
      recordedPath = stopRes.valueOrNull;
    } on Object {
      recordedPath = null;
    }

    if (_isDisposed) return;

    final now = ref.read(clockProvider).now();
    final elapsedMs = _turnStartTime != null
        ? now.difference(_turnStartTime!).inMilliseconds.clamp(500, 600000)
        : ((state.totalSeconds - state.remainingSeconds).clamp(1, 600) * 1000);

    final prompt = state.currentPrompt;
    final updatedTurns = Map<String, RecordedSpeakingTurn>.from(
      state.recordedTurns,
    );
    if (prompt != null && recordedPath != null && recordedPath.isNotEmpty) {
      final durablePath = await persistRecordedAudioClip(
        recordedPath,
        '${state.sessionId}_${prompt.promptId}',
      );
      if (_isDisposed) return;
      updatedTurns[prompt.promptId] = RecordedSpeakingTurn(
        partIndex: prompt.partIndex,
        promptId: prompt.promptId,
        promptText: prompt.promptText,
        localPathOrUrl: durablePath,
        durationMs: elapsedMs,
        contentType: recorder.activeContentType,
      );
    }

    state = state.copyWith(
      phase: SpeakingPhase.recorded,
      isPreviewingMic: false,
      amplitude: 0,
      isSilent: false,
      isClipping: false,
      recordedTurns: updatedTurns,
    );
  }

  /// Updates Part 2 scratchpad notes.
  void updateCueCardNotes(String text) {
    state = state.copyWith(cueCardNotes: text);
  }

  /// Moves to the next prompt in the Speaking pack, or switches parts in Study Mode.
  Future<void> goToTurn(int index) async {
    if (index < 0 || index >= state.prompts.length) return;
    if (state.isExamMode && state.isRecording) return;

    _countdownTimer?.cancel();
    await stopMicPreview();
    await _stopPlaybackInternal();
    if (_isDisposed) return;

    final nextPrompt = state.prompts[index];
    final hasClip = state.recordedTurns.containsKey(nextPrompt.promptId);
    final prepSecs = nextPrompt.prepSeconds;
    final totalSecs = prepSecs > 0 ? prepSecs : nextPrompt.speakSeconds;

    state = state.copyWith(
      currentTurnIndex: index,
      phase: hasClip ? SpeakingPhase.recorded : SpeakingPhase.prepOrReady,
      remainingSeconds: totalSecs,
      totalSeconds: totalSecs,
      clearError: true,
    );

    if (!hasClip) {
      if (prepSecs > 0) {
        _startPrepCountdown(prepSecs);
      }
      await startMicPreview();
    }
  }

  /// Plays or pauses the recorded clip for [promptId] before submitting.
  Future<void> togglePlayback(String promptId) async {
    final turn = state.recordedTurns[promptId];
    if (turn == null) return;

    final player = ref.read(audioPlayerGatewayProvider);
    if (state.isPlayingBack && state.playingPromptId == promptId) {
      await player.pause();
      if (!_isDisposed) {
        state = state.copyWith(isPlayingBack: false);
      }
      return;
    }

    await _stopPlaybackInternal();
    final loadRes = await player.loadFile(turn.localPathOrUrl);
    if (_isDisposed) return;
    if (loadRes.isFailure) {
      state = state.copyWith(
        errorMessage: 'Could not play clip: ${loadRes.failureOrNull?.message}',
      );
      return;
    }

    unawaited(_playSub?.cancel());
    _playSub = player.watchIsPlaying().listen((playing) {
      if (_isDisposed) return;
      state = state.copyWith(
        isPlayingBack: playing,
        clearPlayingPrompt: !playing,
      );
    });
    state = state.copyWith(
      isPlayingBack: true,
      playingPromptId: promptId,
      clearError: true,
    );
    await player.play();
  }

  Future<void> _stopPlaybackInternal() async {
    unawaited(_playSub?.cancel());
    _playSub = null;
    try {
      await ref.read(audioPlayerGatewayProvider).pause();
    } on Object {
      // Ignore if player uninitialized.
    }
    if (!_isDisposed) {
      state = state.copyWith(isPlayingBack: false, clearPlayingPrompt: true);
    }
  }

  /// Uploads recorded audio turn(s) to SeaweedFS via `/v1/uploads/presign`,
  /// persists local submission + `AudioRecordings`, enqueues `/v1/evaluate/speaking`
  /// (with `OutboxSyncQueue` fallback when offline), and returns the `attemptId`.
  Future<String?> submitSession() async {
    if (state.isSubmitting) return null;
    if (state.recordedTurns.isEmpty) {
      state = state.copyWith(
        errorMessage: 'Record at least one response before submitting.',
      );
      return null;
    }

    _countdownTimer?.cancel();
    await stopMicPreview();
    await _stopPlaybackInternal();
    if (_isDisposed) return null;

    state = state.copyWith(isSubmitting: true, clearError: true);

    final attemptId = state.sessionId;
    final attemptRepo = ref.read(attemptRepositoryProvider);
    final gradingGateway = ref.read(gradingGatewayProvider);
    final profileRepo = ref.read(profileRepositoryProvider);
    final authSession = ref.read(authSessionServiceProvider);
    final progressRepo = ref.read(progressRepositoryProvider);
    final entropy = ref.read(entropySourceProvider);
    final clock = ref.read(clockProvider);

    try {
      final profile = await profileRepo.loadOrInitializePrimary();
      final examId = profile.examId == 'ielts_general'
          ? 'ielts_general'
          : 'ielts_academic';

      final orderedTurns = state.recordedTurns.values.toList()
        ..sort((a, b) => a.partIndex.compareTo(b.partIndex));

      final canonicalPartSequence = orderedTurns.length >= 3
          ? 'full'
          : 'part${orderedTurns.first.partIndex}';

      final turnEntries = orderedTurns.map((turn) {
        final recordingId = entropy.nextUuidV4();
        return (turn: turn, recordingId: recordingId);
      }).toList(growable: false);

      final outboxTurnsPayload = turnEntries
          .map(
            (e) => <String, Object?>{
              'recordingId': e.recordingId,
              'turnId': e.turn.promptId,
              'partIndex': e.turn.partIndex,
              'promptText': e.turn.promptText,
              'localFilePath': e.turn.localPathOrUrl,
              'contentType': e.turn.contentType,
              'durationMs': e.turn.durationMs,
            },
          )
          .toList(growable: false);

      final submissionJson = jsonEncode({
        'packId': state.packId,
        'notes': state.cueCardNotes,
        'turns': outboxTurnsPayload,
      });

      final elapsedSeconds = _sessionStartTime != null
          ? clock.now().difference(_sessionStartTime!).inSeconds.clamp(5, 3600)
          : orderedTurns.fold<int>(
              0,
              (acc, t) => acc + (t.durationMs ~/ 1000),
            );

      final outboxPayloadMap = <String, Object?>{
        'attemptId': attemptId,
        'packId': state.packId,
        'examId': examId,
        'partSequence': canonicalPartSequence,
        'turns': outboxTurnsPayload,
      };

      // Persist parent Attempt, child AudioRecordings, and Outbox entry atomically BEFORE network I/O (`TD-18` & `TD-43`).
      final outboxId = await attemptRepo.saveDurableSubmissionWithOutbox(
        attemptId: attemptId,
        packId: state.packId,
        skill: SkillKind.speaking,
        submissionJson: submissionJson,
        actionType: 'submit_speaking',
        outboxPayloadJson: jsonEncode(outboxPayloadMap),
        examId: examId,
        startedAtUtcMs: _sessionStartTime?.toUtc().millisecondsSinceEpoch,
        durationSeconds: elapsedSeconds,
        usedStudyMode: !state.isExamMode,
        recordings: turnEntries
            .map(
              (e) => (
                recordingId: e.recordingId,
                partIndex: e.turn.partIndex,
                localFilePath: e.turn.localPathOrUrl,
                durationMs: e.turn.durationMs,
                remoteObjectKey: null,
              ),
            )
            .toList(growable: false),
      );

      await progressRepo.logTodayActivity(
        studySeconds: elapsedSeconds,
        completedItems: 1,
      );

      await authSession.ensureAuthenticated();

      final uploadedTurnsPayload =
          <
            ({
              int partIndex,
              String promptText,
              String objectKey,
              int? durationMs,
            })
          >[];
      String? primaryObjectKey;

      for (var i = 0; i < turnEntries.length; i++) {
        final entry = turnEntries[i];
        final turn = entry.turn;
        final bytes = await readRecordedAudioBytes(turn.localPathOrUrl);
        if (bytes == null || bytes.isEmpty) continue;

        final presignRes = await gradingGateway.presignAudioUpload(
          attemptId: attemptId,
          partIndex: turn.partIndex,
          turnId: turn.promptId,
          byteLength: bytes.length,
          contentType: turn.contentType,
        );
        if (presignRes.isSuccess) {
          final target = presignRes.valueOrNull!;
          final putRes = await gradingGateway.uploadAudioBytes(
            uploadUrl: target.uploadUrl,
            bytes: bytes,
            contentType: turn.contentType,
          );
          if (putRes.isSuccess) {
            primaryObjectKey ??= target.objectKey;
            outboxTurnsPayload[i]['objectKey'] = target.objectKey;
            await attemptRepo.updateAudioRecordingRemoteKey(
              recordingId: entry.recordingId,
              remoteObjectKey: target.objectKey,
            );
            uploadedTurnsPayload.add((
              partIndex: turn.partIndex,
              promptText: turn.promptText,
              objectKey: target.objectKey,
              durationMs: turn.durationMs,
            ));
          }
        }
      }

      if (outboxId != null && uploadedTurnsPayload.isNotEmpty) {
        await attemptRepo.updateOutboxPayload(
          id: outboxId,
          payloadJson: jsonEncode(outboxPayloadMap),
        );
      }

      // Only submit when EVERY recorded turn succeeded (`TD-19`).
      if (uploadedTurnsPayload.length == orderedTurns.length &&
          primaryObjectKey != null) {
        final enqueueRes = await gradingGateway.enqueueSpeakingEvaluation(
          attemptId: attemptId,
          packId: state.packId,
          audioObjectKey: primaryObjectKey,
          partIndex: orderedTurns.first.partIndex,
          examId: examId,
          partSequence: canonicalPartSequence,
          turns: uploadedTurnsPayload,
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
          if (!_isDisposed) {
            state = state.copyWith(isSubmitting: false);
          }
          return attemptId;
        }
      }

      // Retain checkpointed outbox item and schedule foreground retry (`TD-42`).
      ref.read(outboxSyncServiceProvider).notifyWorkEnqueued();
      if (!_isDisposed) {
        state = state.copyWith(isSubmitting: false);
      }
      return attemptId;
    } on Object catch (err) {
      if (!_isDisposed) {
        state = state.copyWith(
          isSubmitting: false,
          errorMessage: 'Failed to submit Speaking attempt: $err',
        );
      }
      return null;
    }
  }

  void _cleanupAll() {
    _isDisposed = true;
    _countdownTimer?.cancel();
    unawaited(_ampSub?.cancel());
    unawaited(_playSub?.cancel());
    try {
      unawaited(ref.read(audioRecorderGatewayProvider).stopRecording());
    } on Object {
      // Ignore if recorder uninitialized.
    }
    try {
      unawaited(ref.read(audioPlayerGatewayProvider).pause());
    } on Object {
      // Ignore if player uninitialized.
    }
    if (_previewPath != null) {
      unawaited(deleteRecordedAudioClip(_previewPath!));
    }
  }
}
