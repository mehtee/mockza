import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/exams/countdown_clock_tracker.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/services/audio_player_gateway.dart';
import 'package:mockza/services/audio_recorder_gateway.dart';
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
    this.isEphemeralStorage = false,
    this.hasStorageWarning = false,
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

  /// Whether local database degraded to volatile RAM (Web private mode) (`RR-07`).
  final bool isEphemeralStorage;

  /// Whether durable clip storage reported an abort/quota failure (`RR-07`).
  final bool hasStorageWarning;

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
    bool? isEphemeralStorage,
    bool? hasStorageWarning,
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
    isEphemeralStorage: isEphemeralStorage ?? this.isEphemeralStorage,
    hasStorageWarning: hasStorageWarning ?? this.hasStorageWarning,
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
  String? _activePlaybackBlobUrl;
  DateTime? _turnStartTime;
  DateTime? _sessionStartTime;
  bool _isDisposed = false;
  int _initGeneration = 0;
  late AudioRecorderGateway _recorder;
  late AudioPlayerGateway _player;
  late AttemptRepository _attemptRepo;
  String? _mockSessionId;
  String? _mockStageKey;

  @override
  SpeakingSimState build() {
    _isDisposed = false;
    final entropy = ref.read(entropySourceProvider);
    final clock = ref.read(clockProvider);
    // Capture resource owners while `ref` is active so disposal never calls `ref.read` (`RR-01`).
    _recorder = ref.read(audioRecorderGatewayProvider);
    _player = ref.read(audioPlayerGatewayProvider);
    _attemptRepo = ref.read(attemptRepositoryProvider);
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
      isEphemeralStorage: ref.read(isDatabaseEphemeralProvider),
    );
  }

  /// Loads [packId] from Drift/Postgres, checks microphone permission, and starts
  /// the live microphone level preview.
  Future<void> initialize(
    String packId, {
    bool isExamMode = true,
    String? mockSessionId,
    String? mockStageKey,
  }) async {
    _mockSessionId = mockSessionId;
    _mockStageKey = mockStageKey;
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

      if (bundleRes.isSuccess) {
        final spec = catalog.parseSpeakingSession(bundleRes.valueOrNull!);
        final prompts = spec.prompts;
        final restored = await _restorePendingSession(
          packId,
          isExamMode: state.isExamMode,
          prompts: prompts,
        );
        if (_isDisposed || gen != _initGeneration) return;

        final targetIndex = restored?.turnIndex ?? 0;
        final activePrompt = (targetIndex >= 0 && targetIndex < prompts.length)
            ? prompts[targetIndex]
            : (prompts.isNotEmpty ? prompts.first : null);
        final hasClipForTarget =
            activePrompt != null &&
            (restored?.turns.containsKey(activePrompt.promptId) ?? false);
        final prepSecs = hasClipForTarget
            ? 0
            : (activePrompt?.prepSeconds ?? 0);
        final initialTotal = prepSecs > 0
            ? prepSecs
            : (activePrompt?.speakSeconds ?? 60);

        state = state.copyWith(
          sessionId: restored?.sessionId ?? state.sessionId,
          isLoadingPack: false,
          sessionTitle: spec.title,
          prompts: prompts,
          currentTurnIndex: targetIndex.clamp(
            0,
            prompts.isEmpty ? 0 : prompts.length - 1,
          ),
          phase: hasClipForTarget
              ? SpeakingPhase.recorded
              : SpeakingPhase.prepOrReady,
          remainingSeconds: initialTotal,
          totalSeconds: initialTotal,
          cueCardNotes: restored?.notes ?? state.cueCardNotes,
          recordedTurns: restored?.turns ?? state.recordedTurns,
          clearError: true,
        );

        if (!hasClipForTarget && prepSecs > 0) {
          _startPrepCountdown(prepSecs);
        }
      } else {
        final f = bundleRes.failureOrNull!;
        state = state.copyWith(
          isLoadingPack: false,
          errorMessage:
              'Could not load Speaking pack "$packId": ${f.message}. Check connection and retry.',
        );
      }
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

    final recorder = _recorder;
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
        final recorder = _recorder;
        final res = await recorder.stopRecording();
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
    final recorder = _recorder;
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
      } else if (!_clockForRecording &&
          state.phase == SpeakingPhase.prepOrReady &&
          state.isExamMode) {
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

    final recorder = _recorder;
    String? recordedPath;
    String? stopFailureMessage;
    try {
      final stopRes = await recorder.stopRecording();
      if (stopRes.isFailure) {
        stopFailureMessage = stopRes.failureOrNull?.message;
      } else {
        recordedPath = stopRes.valueOrNull;
      }
    } on Object catch (err) {
      stopFailureMessage = '$err';
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
    var storageWarning = state.hasStorageWarning;
    var errorMsg = stopFailureMessage;

    if (prompt != null && recordedPath != null && recordedPath.isNotEmpty) {
      final previousTurn = updatedTurns[prompt.promptId];
      final persisted = await persistRecordedAudioClipWithStatus(
        recordedPath,
        '${state.sessionId}_${prompt.promptId}',
        mimeType: recorder.activeContentType,
      );
      if (_isDisposed) return;

      if (previousTurn != null &&
          previousTurn.localPathOrUrl != persisted.pathOrUrl) {
        await deleteRecordedAudioClip(previousTurn.localPathOrUrl);
      }

      if (!persisted.isDurable) {
        storageWarning = true;
        errorMsg = persisted.errorMessage ?? 'Recording is held in temporary browser memory only; submit without closing this tab.';
      }

      updatedTurns[prompt.promptId] = RecordedSpeakingTurn(
        partIndex: prompt.partIndex,
        promptId: prompt.promptId,
        promptText: prompt.promptText,
        localPathOrUrl: persisted.pathOrUrl,
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
      hasStorageWarning: storageWarning,
      errorMessage: errorMsg,
      clearError: errorMsg == null,
    );

    if (prompt != null && recordedPath != null && recordedPath.isNotEmpty) {
      await _persistPendingSession();
    }
  }

  /// Updates Part 2 scratchpad notes.
  void updateCueCardNotes(String text) {
    state = state.copyWith(cueCardNotes: text);
  }

  /// Moves to the next prompt in the Speaking pack, or switches parts in Study Mode.
  Future<void> goToTurn(int index) async {
    if (state.isSubmitting) return;
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

    final player = _player;
    if (state.isPlayingBack && state.playingPromptId == promptId) {
      await player.pause();
      if (!_isDisposed) {
        state = state.copyWith(isPlayingBack: false);
      }
      return;
    }

    await _stopPlaybackInternal();
    if (_isDisposed) return;

    // Materialize `idb://` clips into a MIME-typed `blob:` URL before calling `loadFile` (`RR-02`).
    final String? playableSource;
    if (turn.localPathOrUrl.startsWith('idb://')) {
      playableSource = await resolveCachedAudioPlayableUrl(
        turn.localPathOrUrl,
        mimeType: turn.contentType,
      );
      if (_isDisposed) {
        await releasePlayableAudioUrl(playableSource);
        return;
      }
      if (playableSource == null || playableSource.isEmpty) {
        state = state.copyWith(
          errorMessage: 'Could not load saved recording from browser storage. Re-record this turn.',
        );
        return;
      }
      if (playableSource.startsWith('blob:')) {
        _activePlaybackBlobUrl = playableSource;
      }
    } else {
      playableSource = turn.localPathOrUrl;
    }

    final loadRes = await player.loadFile(playableSource);
    if (_isDisposed) {
      await _releaseActivePlaybackBlob();
      return;
    }
    if (loadRes.isFailure) {
      await _releaseActivePlaybackBlob();
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

  Future<void> _releaseActivePlaybackBlob() async {
    final oldBlob = _activePlaybackBlobUrl;
    _activePlaybackBlobUrl = null;
    if (oldBlob != null) {
      await releasePlayableAudioUrl(oldBlob);
    }
  }

  Future<void> _stopPlaybackInternal() async {
    unawaited(_playSub?.cancel());
    _playSub = null;
    try {
      await _player.pause();
    } on Object {
      // Ignore if player uninitialized.
    }
    await _releaseActivePlaybackBlob();
    if (!_isDisposed) {
      state = state.copyWith(isPlayingBack: false, clearPlayingPrompt: true);
    }
  }

  List<RecordedSpeakingTurn> get _orderedRecordedTurns => state.prompts
      .map((prompt) => state.recordedTurns[prompt.promptId])
      .whereType<RecordedSpeakingTurn>()
      .toList(growable: false);

  Future<void> _persistPendingSession() async {
    if (state.recordedTurns.isEmpty) return;
    final orderedTurns = _orderedRecordedTurns;
    try {
      await _attemptRepo.savePendingSpeakingSession(
        sessionId: state.sessionId,
        packId: state.packId,
        isExamMode: state.isExamMode,
        startedAtUtcMs: _sessionStartTime?.toUtc().millisecondsSinceEpoch,
        sessionJson: jsonEncode({
          'packId': state.packId,
          'sessionTitle': state.sessionTitle,
          'isExamMode': state.isExamMode,
          'currentTurnIndex': state.currentTurnIndex,
          'cueCardNotes': state.cueCardNotes,
          'turns': orderedTurns
              .map(
                (t) => <String, Object?>{
                  'partIndex': t.partIndex,
                  'promptId': t.promptId,
                  'promptText': t.promptText,
                  'localPathOrUrl': t.localPathOrUrl,
                  'durationMs': t.durationMs,
                  'contentType': t.contentType,
                },
              )
              .toList(growable: false),
        }),
        mockSessionId: _mockSessionId,
        mockStageKey: _mockStageKey,
        recordings: orderedTurns
            .map(
              (t) => (
                recordingId: '${state.sessionId}_${t.promptId}',
                partIndex: t.partIndex,
                localFilePath: t.localPathOrUrl,
                durationMs: t.durationMs,
              ),
            )
            .toList(growable: false),
      );
    } on Object {
      if (!_isDisposed) {
        state = state.copyWith(
          hasStorageWarning: true,
          errorMessage: 'Could not save session progress. Keep this session open and retry before leaving.',
        );
      }
    }
  }

  Future<
    ({
      String sessionId,
      int turnIndex,
      String notes,
      Map<String, RecordedSpeakingTurn> turns,
    })?
  >
  _restorePendingSession(
    String packId, {
    required bool isExamMode,
    required List<SpeakingPromptSpec> prompts,
  }) async {
    try {
      final row = await _attemptRepo.findLatestPendingSpeakingSession(
        packId,
        isExamMode: isExamMode,
        mockSessionId: _mockSessionId,
      );
      if (row == null) return null;
      final decoded = jsonDecode(row.submissionJson);
      if (decoded is! Map<String, dynamic>) return null;
      final rawTurns = decoded['turns'];
      if (rawTurns is! List<dynamic> || rawTurns.isEmpty) return null;

      final restoredTurns = <String, RecordedSpeakingTurn>{};
      for (final item in rawTurns.whereType<Map<String, dynamic>>()) {
        final promptId = (item['promptId'] as String?) ?? '';
        final pathOrUrl = (item['localPathOrUrl'] as String?) ?? '';
        if (promptId.isEmpty || pathOrUrl.isEmpty) continue;
        // Verify durable bytes exist before restoring clip metadata (`RR-07`).
        final bytes = await readRecordedAudioBytes(pathOrUrl);
        if (bytes == null || bytes.isEmpty) continue;
        restoredTurns[promptId] = RecordedSpeakingTurn(
          partIndex: (item['partIndex'] as num?)?.toInt() ?? 1,
          promptId: promptId,
          promptText: (item['promptText'] as String?) ?? '',
          localPathOrUrl: pathOrUrl,
          durationMs: (item['durationMs'] as num?)?.toInt() ?? 1000,
          contentType: (item['contentType'] as String?) ?? 'audio/mp4',
        );
      }
      if (restoredTurns.isEmpty) return null;

      var nextIndex = (decoded['currentTurnIndex'] as num?)?.toInt() ?? 0;
      if (prompts.isNotEmpty) {
        final firstUnrecorded = prompts.indexWhere(
          (p) => !restoredTurns.containsKey(p.promptId),
        );
        if (firstUnrecorded >= 0) {
          nextIndex = firstUnrecorded;
        }
      }
      return (
        sessionId: row.attemptId,
        turnIndex: nextIndex,
        notes: (decoded['cueCardNotes'] as String?) ?? '',
        turns: restoredTurns,
      );
    } on Object {
      return null;
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

    state = state.copyWith(isSubmitting: true, clearError: true);

    _countdownTimer?.cancel();
    await stopMicPreview();
    await _stopPlaybackInternal();
    if (_isDisposed) return null;

    final attemptId = state.sessionId;
    final attemptRepo = ref.read(attemptRepositoryProvider);
    final gradingGateway = ref.read(gradingGatewayProvider);
    final profileRepo = ref.read(profileRepositoryProvider);
    final authSession = ref.read(authSessionServiceProvider);
    final progressRepo = ref.read(progressRepositoryProvider);
    final clock = ref.read(clockProvider);

    try {
      final profile = await profileRepo.loadOrInitializePrimary();
      final effectiveTrack = ExamTrack.resolveForPackOrProfile(
        packId: state.packId,
        profileExamId: profile.examId,
      );
      final examId = effectiveTrack.id;

      final orderedTurns = _orderedRecordedTurns;

      final totalPromptParts = state.prompts
          .map((prompt) => prompt.partIndex)
          .toSet();
      final representedParts = orderedTurns
          .map((turn) => turn.partIndex)
          .toSet();
      final canonicalPartSequence =
          totalPromptParts.length > 1 &&
              representedParts.containsAll(totalPromptParts)
          ? 'full'
          : 'part${orderedTurns.first.partIndex}';

      final turnEntries = orderedTurns
          .map((turn) {
            final recordingId = '${state.sessionId}_${turn.promptId}';
            return (turn: turn, recordingId: recordingId);
          })
          .toList(growable: false);

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

      final installedPack = await ref
          .read(examCatalogRepositoryProvider)
          .getInstalledPackById(state.packId);
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
        contentVersion: installedPack?.version,
        mockSessionId: _mockSessionId,
        mockStageKey: _mockStageKey,
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
        if (enqueueRes case Err<String, Failure>(
          failure: final QuotaExceededFailure quotaFailure,
        )) {
          await attemptRepo.updateAttemptEvaluation(
            attemptId: attemptId,
            status: AttemptStatus.failedRetryable,
            errorCode: quotaFailure.code,
          );
          if (outboxId != null) {
            await attemptRepo.deleteOutboxItem(outboxId);
          }
          if (!_isDisposed) {
            state = state.copyWith(
              isSubmitting: false,
              errorMessage: quotaFailure.message,
            );
          }
          return null;
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
    final ampSub = _ampSub;
    final playSub = _playSub;
    _ampSub = null;
    _playSub = null;
    if (ampSub != null) unawaited(ampSub.cancel());
    if (playSub != null) unawaited(playSub.cancel());

    // Stop captured recorder & player directly without `ref.read` after disposal (`RR-01`).
    unawaited(_recorder.stopRecording().then((_) {}, onError: (_) {}));
    unawaited(_player.pause().then((_) {}, onError: (_) {}));
    final blobUrl = _activePlaybackBlobUrl;
    _activePlaybackBlobUrl = null;
    if (blobUrl != null) {
      unawaited(releasePlayableAudioUrl(blobUrl));
    }
    if (_previewPath != null) {
      final path = _previewPath!;
      _previewPath = null;
      unawaited(deleteRecordedAudioClip(path));
    }
  }
}
