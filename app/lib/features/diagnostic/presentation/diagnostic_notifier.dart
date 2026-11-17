import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/diagnostic/diagnostic_budget.dart';
import 'package:mockza/core/diagnostic/diagnostic_models.dart';
import 'package:mockza/core/diagnostic/diagnostic_router.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/data/db/app_database.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/services/audio_player_gateway.dart';
import 'package:mockza/services/diagnostic_gateway.dart';
import 'package:mockza/services/media_bytes_platform.dart';

/// Ordered active workflow stages inside the 4-skill rapid baseline check.
enum DiagnosticFlowStage {
  /// Step 0: beginner orientation, sound check, and discarded mic check.
  intro,

  /// Unscored Reading worked example shown before live adaptive Reading items.
  readingExample,

  /// Live adaptive Reading micro-block (`A1`..`C2`).
  readingBlock,

  /// Calm transition card into Listening.
  transitionToListening,

  /// Unscored Listening worked example demonstrating play-once audio.
  listeningExample,

  /// Live adaptive Listening audio micro-block (`A1`..`C2`).
  listeningBlock,

  /// Calm transition card into Writing.
  transitionToWriting,

  /// Base short everyday Writing task (`~35-55 words`).
  writingBase,

  /// Optional supportive or extension Writing follow-up.
  writingFollowUp,

  /// Calm transition card into Speaking (or submit directly when opted out).
  transitionToSpeaking,

  /// Short `15s` Speaking cue preparation countdown.
  speakingPrep,

  /// Live `45s` Speaking capture turn (`partIndex: 1`).
  speakingRecording,

  /// Optional short `25s` Speaking follow-up (`partIndex: 2`).
  speakingFollowUp,

  /// Uploading / finalizing responses with the backend.
  submitting,

  /// Results & async evaluation status dashboard.
  results,
}

/// Device microphone check state in Step 0 (`/diagnostic/intro`).
enum MicPreflightStatus {
  /// Check has not been run yet.
  unchecked,

  /// Currently sampling microphone level (~3 seconds).
  checking,

  /// Clear speech signal detected and temp clip discarded.
  ready,

  /// OS/browser denied microphone permission.
  permissionDenied,

  /// No usable microphone hardware/plugin available on this platform.
  unavailable,

  /// Clip was silent, background-only, or clipping.
  noisyOrSilent,
}

/// Captured spoken turn metadata queued for diagnostic submission.
typedef DiagnosticSpeakingTurnDraft = ({
  int partIndex,
  String promptText,
  String objectKey,
  int? durationMs,
});

/// Immutable state container for the 4-skill rapid diagnostic flow.
@immutable
class DiagnosticState {
  /// Creates a [DiagnosticState].
  const new({
    required this.diagId,
    required this.examId,
    required this.mode,
    required this.selectionSeed,
    required this.stage,
    required this.writingAttemptId,
    required this.speakingAttemptId,
    this.isLoadingBank = false,
    this.bankLoadError,
    this.bank,
    this.isAlternateForm = false,
    this.retakeSkill,
    this.soundConfirmed = false,
    this.isPlayingPreflightAudio = false,
    this.preflightAudioError,
    this.micStatus = MicPreflightStatus.unchecked,
    this.micStatusMessage,
    this.micLevel = 0.0,
    this.speakingOptOut = false,
    this.startedAtUtcMs,
    this.collectionDeadlineUtcMs,
    this.resultsDeadlineUtcMs,
    this.stageDeadlineUtcMs,
    this.globalRemainingSeconds = DiagnosticBudget.collectionTotalSeconds,
    this.stageRemainingSeconds = DiagnosticBudget.introMaxSeconds,
    this.resultsRemainingSeconds = DiagnosticBudget.resultsWindowSeconds,
    this.readingHistory = const <BlockAttemptRecord>[],
    this.readingStopReason,
    this.readingSkipped = false,
    this.listeningHistory = const <BlockAttemptRecord>[],
    this.listeningStopReason,
    this.listeningSkipped = false,
    this.activeBlock,
    this.activeBlockStartedUtcMs,
    this.selectedOptionQ0,
    this.selectedOptionQ1,
    this.workedExampleOption,
    this.workedExampleRevealed = false,
    this.isAudioLoading = false,
    this.isAudioPlaying = false,
    this.audioPlayCount = 0,
    this.audioCompleted = false,
    this.audioFailed = false,
    this.audioErrorMessage,
    this.showAccessibleTranscript = false,
    this.writingBaseText = '',
    this.writingFollowUpText = '',
    this.writingFollowUpPrompt,
    this.writingSkipped = false,
    this.isSpeakingRecording = false,
    this.speakingAmplitude = 0.0,
    this.speakingElapsedMs = 0,
    this.speakingFollowUpPrompt,
    this.speakingTurns = const <DiagnosticSpeakingTurnDraft>[],
    this.speakingSkipped = false,
    this.speakingNoEvidenceReason,
    this.isUploadingSpeaking = false,
    this.speakingStatusMessage,
    this.isSubmitting = false,
    this.submitError,
    this.sessionSnapshot,
  });

  /// Creates the clean initial idle [DiagnosticState].
  factory initial() => const DiagnosticState(
    diagId: '',
    examId: 'ielts_academic',
    mode: DiagnosticMode.standard,
    selectionSeed: '',
    stage: DiagnosticFlowStage.intro,
    writingAttemptId: '',
    speakingAttemptId: '',
  );

  /// Active diagnostic session UUID.
  final String diagId;

  /// Selected learner target exam (`ielts_academic`, `toefl`, `det`, etc.).
  final String examId;

  /// Selected timing/accessibility mode (`standard`, `extended`, `accessible`).
  final DiagnosticMode mode;

  /// Per-session tie-break seed.
  final String selectionSeed;

  /// Active stage in the diagnostic flow.
  final DiagnosticFlowStage stage;

  /// Client-generated attempt UUID for the short Writing task.
  final String writingAttemptId;

  /// Client-generated attempt UUID for the short Speaking task.
  final String speakingAttemptId;

  /// Whether `/v1/diagnostic/packs` is currently loading.
  final bool isLoadingBank;

  /// Error encountered while fetching the diagnostic pack.
  final String? bankLoadError;

  /// Loaded content bank & worked examples.
  final DiagnosticBankSnapshot? bank;

  /// Whether an alternate retake pack is loaded.
  final bool isAlternateForm;

  /// Single skill being retaken (`null` for full 4-skill run).
  final String? retakeSkill;

  /// Whether user confirmed sample audio playback in Step 0.
  final bool soundConfirmed;

  /// Whether the Step 0 preflight clip is currently playing.
  final bool isPlayingPreflightAudio;

  /// Optional error from Step 0 sample sound test.
  final String? preflightAudioError;

  /// Step 0 discarded mic preflight status.
  final MicPreflightStatus micStatus;

  /// Human-readable Step 0 mic feedback.
  final String? micStatusMessage;

  /// Live normalized mic peak level `[0.0..1.0]`.
  final double micLevel;

  /// Learner opted to proceed without Speaking.
  final bool speakingOptOut;

  /// Wall-clock start timestamp when collection began (UTC ms).
  final int? startedAtUtcMs;

  /// Wall-clock 540s collection hard deadline (UTC ms).
  final int? collectionDeadlineUtcMs;

  /// Wall-clock 600s results/polling window deadline (UTC ms).
  final int? resultsDeadlineUtcMs;

  /// Bounded stage deadline (UTC ms).
  final int? stageDeadlineUtcMs;

  /// Whole seconds remaining before [collectionDeadlineUtcMs].
  final int globalRemainingSeconds;

  /// Whole seconds remaining in the current active stage.
  final int stageRemainingSeconds;

  /// Whole seconds remaining in the 60s results window.
  final int resultsRemainingSeconds;

  /// Adaptive Reading block history.
  final List<BlockAttemptRecord> readingHistory;

  /// Reading stage stop reason once concluded.
  final DiagnosticStopReason? readingStopReason;

  /// Whether learner explicitly skipped Reading.
  final bool readingSkipped;

  /// Adaptive Listening block history.
  final List<BlockAttemptRecord> listeningHistory;

  /// Listening stage stop reason once concluded.
  final DiagnosticStopReason? listeningStopReason;

  /// Whether learner explicitly skipped Listening.
  final bool listeningSkipped;

  /// Currently presented Reading or Listening block.
  final DiagnosticBlockDef? activeBlock;

  /// Wall-clock start timestamp for [activeBlock] (UTC ms).
  final int? activeBlockStartedUtcMs;

  /// Selected answer index (`0..2`) for Q1 on [activeBlock].
  final int? selectedOptionQ0;

  /// Selected answer index (`0..2`) for Q2 on [activeBlock].
  final int? selectedOptionQ1;

  /// Sample choice selected on worked example screen.
  final int? workedExampleOption;

  /// Whether the worked example explanation has been revealed.
  final bool workedExampleRevealed;

  /// Whether Listening audio is loading.
  final bool isAudioLoading;

  /// Whether Listening audio is actively playing.
  final bool isAudioPlaying;

  /// Number of times the current Listening block audio was started.
  final int audioPlayCount;

  /// Whether current Listening block audio completed at least once.
  final bool audioCompleted;

  /// Whether current Listening clip failed to load/play.
  final bool audioFailed;

  /// Optional error message from Listening audio playback.
  final String? audioErrorMessage;

  /// Accessible-mode post-audio transcript visibility flag.
  final bool showAccessibleTranscript;

  /// Learner's Writing base response text.
  final String writingBaseText;

  /// Learner's Writing follow-up response text.
  final String writingFollowUpText;

  /// Active follow-up prompt chosen for [DiagnosticFlowStage.writingFollowUp].
  final String? writingFollowUpPrompt;

  /// Whether learner explicitly skipped Writing.
  final bool writingSkipped;

  /// Whether Speaking capture is actively recording.
  final bool isSpeakingRecording;

  /// Live normalized Speaking amplitude `[0.0..1.0]`.
  final double speakingAmplitude;

  /// Elapsed Speaking turn duration in milliseconds.
  final int speakingElapsedMs;

  /// Active follow-up prompt chosen for [DiagnosticFlowStage.speakingFollowUp].
  final String? speakingFollowUpPrompt;

  /// Uploaded Speaking turns (`partIndex: 1`, optional `partIndex: 2`).
  final List<DiagnosticSpeakingTurnDraft> speakingTurns;

  /// Whether learner explicitly skipped Speaking.
  final bool speakingSkipped;

  /// Optional non-proficiency reason for missing Speaking evidence.
  final NoEvidenceReason? speakingNoEvidenceReason;

  /// Whether a Speaking clip is currently transcoding/uploading.
  final bool isUploadingSpeaking;

  /// Status line displayed below the Speaking mic controls.
  final String? speakingStatusMessage;

  /// Whether `/submit` or `/retake-skill` is in flight.
  final bool isSubmitting;

  /// Submission failure message if backend submit failed.
  final String? submitError;

  /// Latest synced diagnostic session snapshot from server or Drift cache.
  final DiagnosticSessionSnapshot? sessionSnapshot;

  /// Whether current mode enforces standard bounded timing rules.
  bool get isTimed => mode != DiagnosticMode.extended;

  /// Current Reading/Listening block index (`1`-based).
  int get currentBlockNumber => stage == DiagnosticFlowStage.listeningBlock
      ? listeningHistory.length + 1
      : readingHistory.length + 1;

  /// Upper presentation limit for current objective stage (`4` Reading, `3` Listening).
  int get currentBlockLimit =>
      stage == DiagnosticFlowStage.listeningBlock ? 3 : 4;

  /// Returns an updated copy of [DiagnosticState].
  DiagnosticState copyWith({
    String? diagId,
    String? examId,
    DiagnosticMode? mode,
    String? selectionSeed,
    DiagnosticFlowStage? stage,
    String? writingAttemptId,
    String? speakingAttemptId,
    bool? isLoadingBank,
    String? bankLoadError,
    bool clearBankLoadError = false,
    DiagnosticBankSnapshot? bank,
    bool? isAlternateForm,
    String? retakeSkill,
    bool clearRetakeSkill = false,
    bool? soundConfirmed,
    bool? isPlayingPreflightAudio,
    String? preflightAudioError,
    bool clearPreflightAudioError = false,
    MicPreflightStatus? micStatus,
    String? micStatusMessage,
    bool clearMicStatusMessage = false,
    double? micLevel,
    bool? speakingOptOut,
    int? startedAtUtcMs,
    int? collectionDeadlineUtcMs,
    int? resultsDeadlineUtcMs,
    int? stageDeadlineUtcMs,
    bool clearStageDeadline = false,
    int? globalRemainingSeconds,
    int? stageRemainingSeconds,
    int? resultsRemainingSeconds,
    List<BlockAttemptRecord>? readingHistory,
    DiagnosticStopReason? readingStopReason,
    bool clearReadingStopReason = false,
    bool? readingSkipped,
    List<BlockAttemptRecord>? listeningHistory,
    DiagnosticStopReason? listeningStopReason,
    bool clearListeningStopReason = false,
    bool? listeningSkipped,
    DiagnosticBlockDef? activeBlock,
    bool clearActiveBlock = false,
    int? activeBlockStartedUtcMs,
    int? selectedOptionQ0,
    int? selectedOptionQ1,
    bool clearSelections = false,
    int? workedExampleOption,
    bool clearWorkedExampleOption = false,
    bool? workedExampleRevealed,
    bool? isAudioLoading,
    bool? isAudioPlaying,
    int? audioPlayCount,
    bool? audioCompleted,
    bool? audioFailed,
    String? audioErrorMessage,
    bool clearAudioErrorMessage = false,
    bool? showAccessibleTranscript,
    String? writingBaseText,
    String? writingFollowUpText,
    String? writingFollowUpPrompt,
    bool clearWritingFollowUpPrompt = false,
    bool? writingSkipped,
    bool? isSpeakingRecording,
    double? speakingAmplitude,
    int? speakingElapsedMs,
    String? speakingFollowUpPrompt,
    bool clearSpeakingFollowUpPrompt = false,
    List<DiagnosticSpeakingTurnDraft>? speakingTurns,
    bool? speakingSkipped,
    NoEvidenceReason? speakingNoEvidenceReason,
    bool clearSpeakingNoEvidenceReason = false,
    bool? isUploadingSpeaking,
    String? speakingStatusMessage,
    bool clearSpeakingStatusMessage = false,
    bool? isSubmitting,
    String? submitError,
    bool clearSubmitError = false,
    DiagnosticSessionSnapshot? sessionSnapshot,
    bool clearSessionSnapshot = false,
  }) => DiagnosticState(
    diagId: diagId ?? this.diagId,
    examId: examId ?? this.examId,
    mode: mode ?? this.mode,
    selectionSeed: selectionSeed ?? this.selectionSeed,
    stage: stage ?? this.stage,
    writingAttemptId: writingAttemptId ?? this.writingAttemptId,
    speakingAttemptId: speakingAttemptId ?? this.speakingAttemptId,
    isLoadingBank: isLoadingBank ?? this.isLoadingBank,
    bankLoadError: clearBankLoadError
        ? null
        : (bankLoadError ?? this.bankLoadError),
    bank: bank ?? this.bank,
    isAlternateForm: isAlternateForm ?? this.isAlternateForm,
    retakeSkill: clearRetakeSkill ? null : (retakeSkill ?? this.retakeSkill),
    soundConfirmed: soundConfirmed ?? this.soundConfirmed,
    isPlayingPreflightAudio:
        isPlayingPreflightAudio ?? this.isPlayingPreflightAudio,
    preflightAudioError: clearPreflightAudioError
        ? null
        : (preflightAudioError ?? this.preflightAudioError),
    micStatus: micStatus ?? this.micStatus,
    micStatusMessage: clearMicStatusMessage
        ? null
        : (micStatusMessage ?? this.micStatusMessage),
    micLevel: micLevel ?? this.micLevel,
    speakingOptOut: speakingOptOut ?? this.speakingOptOut,
    startedAtUtcMs: startedAtUtcMs ?? this.startedAtUtcMs,
    collectionDeadlineUtcMs:
        collectionDeadlineUtcMs ?? this.collectionDeadlineUtcMs,
    resultsDeadlineUtcMs: resultsDeadlineUtcMs ?? this.resultsDeadlineUtcMs,
    stageDeadlineUtcMs: clearStageDeadline
        ? null
        : (stageDeadlineUtcMs ?? this.stageDeadlineUtcMs),
    globalRemainingSeconds:
        globalRemainingSeconds ?? this.globalRemainingSeconds,
    stageRemainingSeconds: stageRemainingSeconds ?? this.stageRemainingSeconds,
    resultsRemainingSeconds:
        resultsRemainingSeconds ?? this.resultsRemainingSeconds,
    readingHistory: readingHistory ?? this.readingHistory,
    readingStopReason: clearReadingStopReason
        ? null
        : (readingStopReason ?? this.readingStopReason),
    readingSkipped: readingSkipped ?? this.readingSkipped,
    listeningHistory: listeningHistory ?? this.listeningHistory,
    listeningStopReason: clearListeningStopReason
        ? null
        : (listeningStopReason ?? this.listeningStopReason),
    listeningSkipped: listeningSkipped ?? this.listeningSkipped,
    activeBlock: clearActiveBlock ? null : (activeBlock ?? this.activeBlock),
    activeBlockStartedUtcMs:
        activeBlockStartedUtcMs ?? this.activeBlockStartedUtcMs,
    selectedOptionQ0: clearSelections
        ? null
        : (selectedOptionQ0 ?? this.selectedOptionQ0),
    selectedOptionQ1: clearSelections
        ? null
        : (selectedOptionQ1 ?? this.selectedOptionQ1),
    workedExampleOption: clearWorkedExampleOption
        ? null
        : (workedExampleOption ?? this.workedExampleOption),
    workedExampleRevealed: workedExampleRevealed ?? this.workedExampleRevealed,
    isAudioLoading: isAudioLoading ?? this.isAudioLoading,
    isAudioPlaying: isAudioPlaying ?? this.isAudioPlaying,
    audioPlayCount: audioPlayCount ?? this.audioPlayCount,
    audioCompleted: audioCompleted ?? this.audioCompleted,
    audioFailed: audioFailed ?? this.audioFailed,
    audioErrorMessage: clearAudioErrorMessage
        ? null
        : (audioErrorMessage ?? this.audioErrorMessage),
    showAccessibleTranscript:
        showAccessibleTranscript ?? this.showAccessibleTranscript,
    writingBaseText: writingBaseText ?? this.writingBaseText,
    writingFollowUpText: writingFollowUpText ?? this.writingFollowUpText,
    writingFollowUpPrompt: clearWritingFollowUpPrompt
        ? null
        : (writingFollowUpPrompt ?? this.writingFollowUpPrompt),
    writingSkipped: writingSkipped ?? this.writingSkipped,
    isSpeakingRecording: isSpeakingRecording ?? this.isSpeakingRecording,
    speakingAmplitude: speakingAmplitude ?? this.speakingAmplitude,
    speakingElapsedMs: speakingElapsedMs ?? this.speakingElapsedMs,
    speakingFollowUpPrompt: clearSpeakingFollowUpPrompt
        ? null
        : (speakingFollowUpPrompt ?? this.speakingFollowUpPrompt),
    speakingTurns: speakingTurns ?? this.speakingTurns,
    speakingSkipped: speakingSkipped ?? this.speakingSkipped,
    speakingNoEvidenceReason: clearSpeakingNoEvidenceReason
        ? null
        : (speakingNoEvidenceReason ?? this.speakingNoEvidenceReason),
    isUploadingSpeaking: isUploadingSpeaking ?? this.isUploadingSpeaking,
    speakingStatusMessage: clearSpeakingStatusMessage
        ? null
        : (speakingStatusMessage ?? this.speakingStatusMessage),
    isSubmitting: isSubmitting ?? this.isSubmitting,
    submitError: clearSubmitError ? null : (submitError ?? this.submitError),
    sessionSnapshot: clearSessionSnapshot
        ? null
        : (sessionSnapshot ?? this.sessionSnapshot),
  );
}

/// Manages the complete 4-skill rapid starting-level diagnostic lifecycle,
/// adaptive routing, audio capture, Drift recovery, and server polling.
class DiagnosticNotifier extends Notifier<DiagnosticState> {
  Timer? _tickTimer;
  Timer? _transitionTimer;
  Timer? _draftDebounceTimer;
  Timer? _resultsPollTimer;
  Timer? _preflightTimer;
  StreamSubscription<double>? _ampSub;
  StreamSubscription<bool>? _playSub;
  StreamSubscription<Duration>? _posSub;
  String? _activeRecordingPath;
  bool _preflightPeakDetected = false;
  bool _disposed = false;
  int _playbackGeneration = 0;

  /// Optional callback invoked when global timeout auto-submits into `/diagnostic/results/:diagId`.
  void Function(String diagId)? onAutoSubmitted;

  @override
  DiagnosticState build() {
    _disposed = false;
    ref.onDispose(_cleanupAll);
    return DiagnosticState.initial();
  }

  /// Initializes Step 0 (`/diagnostic/intro`), loading profile defaults and diagnostic pack.
  Future<void> prepareIntro({
    String? examIdOverride,
    DiagnosticMode? modeOverride,
  }) async {
    await _stopMedia();
    _cancelTimers();

    final entropy = ref.read(entropySourceProvider);
    var resolvedExamId = examIdOverride;
    if (resolvedExamId == null || resolvedExamId.isEmpty) {
      try {
        final profile = await ref
            .read(profileRepositoryProvider)
            .loadOrInitializePrimary();
        resolvedExamId = profile.examId;
      } on Object {
        resolvedExamId = 'ielts_academic';
      }
    }
    if (_disposed) return;

    state = DiagnosticState(
      diagId: entropy.nextUuidV4(),
      examId: resolvedExamId,
      mode: modeOverride ?? DiagnosticMode.standard,
      selectionSeed: entropy.nextUuidV4(),
      stage: DiagnosticFlowStage.intro,
      writingAttemptId: entropy.nextUuidV4(),
      speakingAttemptId: entropy.nextUuidV4(),
      isLoadingBank: true,
    );

    await _loadBank(alternateForm: false);
  }

  Future<void> _loadBank({required bool alternateForm}) async {
    state = state.copyWith(isLoadingBank: true, clearBankLoadError: true);
    try {
      await ref.read(authSessionServiceProvider).ensureAuthenticated();
    } on Object {
      // Allow FakeDiagnosticGateway or offline cache paths to proceed.
    }
    final res = await ref
        .read(diagnosticGatewayProvider)
        .fetchDiagnosticBank(alternateForm: alternateForm);
    if (_disposed) return;
    res.when(
      success: (bank) {
        state = state.copyWith(
          isLoadingBank: false,
          bank: bank,
          isAlternateForm: alternateForm,
        );
      },
      failure: (f) {
        state = state.copyWith(
          isLoadingBank: false,
          bankLoadError: f.message,
        );
      },
    );
  }

  /// Retries loading `/v1/diagnostic/packs`.
  Future<void> retryLoadBank() =>
      _loadBank(alternateForm: state.isAlternateForm);

  /// Updates the timing/accessibility mode (`standard`, `extended`, `accessible`).
  void setMode(DiagnosticMode mode) {
    state = state.copyWith(mode: mode);
  }

  /// Switches to `extended` untimed help mode mid-session ("Need more help / time").
  void switchToExtendedHelpMode() {
    final nowMs = ref.read(clockProvider).now().toUtc().millisecondsSinceEpoch;
    final extendedDeadline =
        nowMs + (DiagnosticBudget.collectionTotalSeconds * 3 * 1000);
    state = state.copyWith(
      mode: DiagnosticMode.extended,
      collectionDeadlineUtcMs: extendedDeadline,
      stageDeadlineUtcMs: extendedDeadline,
      globalRemainingSeconds: DiagnosticBudget.collectionTotalSeconds * 3,
      stageRemainingSeconds: DiagnosticBudget.collectionTotalSeconds * 3,
    );
    unawaited(_persistLocalState());
  }

  /// Plays the short Step 0 device check audio sample.
  Future<void> playPreflightSampleSound() async {
    final bank = state.bank;
    if (bank == null) return;
    final resolvedUrl = ref
        .read(editionConfigProvider)
        .resolveMediaUrl(bank.preflightAudioUrl);
    final player = ref.read(audioPlayerGatewayProvider);
    final gen = ++_playbackGeneration;
    unawaited(_playSub?.cancel());
    _playSub = null;
    try {
      await player.pause();
    } on Object {
      // Ignore pause errors before preflight playback.
    }
    if (_disposed || gen != _playbackGeneration) return;

    state = state.copyWith(
      isPlayingPreflightAudio: true,
      clearPreflightAudioError: true,
    );
    player.setPlaybackMode(AudioPlaybackMode.studyInteractive);
    final loadRes = await player.loadFile(resolvedUrl);
    if (_disposed || gen != _playbackGeneration) return;
    if (loadRes case Err(:final failure)) {
      state = state.copyWith(
        isPlayingPreflightAudio: false,
        preflightAudioError:
            'Could not play sample audio (${failure.message}).',
      );
      return;
    }

    _playSub = player.watchIsPlaying().listen((playing) {
      if (_disposed || gen != _playbackGeneration) return;
      if (!playing && state.isPlayingPreflightAudio) {
        state = state.copyWith(isPlayingPreflightAudio: false);
      }
    }, onError: (_) {});

    state = state.copyWith(soundConfirmed: true);
    unawaited(
      player.play().then((playRes) {
        if (_disposed || gen != _playbackGeneration) return;
        if (playRes case Err(:final failure)) {
          state = state.copyWith(
            isPlayingPreflightAudio: false,
            preflightAudioError: 'Playback failed (${failure.message}).',
          );
          return;
        }
        if (state.isPlayingPreflightAudio) {
          state = state.copyWith(isPlayingPreflightAudio: false);
        }
      }),
    );
  }

  /// Manually confirms sound check without audio plugin (useful in assistive setups).
  void confirmSoundReady() {
    state = state.copyWith(
      soundConfirmed: true,
      clearPreflightAudioError: true,
    );
  }

  /// Runs a 3-second discarded live microphone preflight check (Sec. 3).
  Future<void> runMicPreflightCheck() async {
    final recorder = ref.read(audioRecorderGatewayProvider);
    _preflightTimer?.cancel();
    unawaited(_ampSub?.cancel());
    _preflightPeakDetected = false;

    state = state.copyWith(
      micStatus: MicPreflightStatus.checking,
      clearMicStatusMessage: true,
      micLevel: 0,
    );

    final permRes = await recorder.hasPermission();
    if (_disposed) return;
    final granted = permRes.valueOrNull ?? false;
    if (!granted) {
      state = state.copyWith(
        micStatus: MicPreflightStatus.permissionDenied,
        micStatusMessage: 'Microphone access was denied or blocked. You can continue without Speaking and evaluate the other 3 skills.',
      );
      return;
    }

    final tempPath = await createTempRecordingPath(
      'diag_preflight_${state.diagId}.m4a',
    );
    final startRes = await recorder.startRecording(outputPath: tempPath);
    if (_disposed) return;
    if (startRes is Err) {
      state = state.copyWith(
        micStatus: MicPreflightStatus.unavailable,
        micStatusMessage: 'Microphone unavailable right now. You can continue without Speaking.',
      );
      return;
    }

    _ampSub = recorder.watchAmplitude().listen((amp) {
      if (_disposed) return;
      if (amp > 0.08) {
        _preflightPeakDetected = true;
      }
      state = state.copyWith(micLevel: amp);
    }, onError: (_) {});

    _preflightTimer = Timer(const Duration(seconds: 3), () async {
      await _finishMicPreflightCheck();
    });
  }

  Future<void> _finishMicPreflightCheck() async {
    final recorder = ref.read(audioRecorderGatewayProvider);
    unawaited(_ampSub?.cancel());
    final stopRes = await recorder.stopRecording();
    final path = stopRes.valueOrNull;
    if (path != null && path.isNotEmpty) {
      await deleteRecordedAudioClip(path);
    }
    if (_disposed) return;
    if (_preflightPeakDetected) {
      state = state.copyWith(
        micStatus: MicPreflightStatus.ready,
        micStatusMessage: 'Microphone working clearly (test sample discarded).',
        micLevel: 0,
        speakingOptOut: false,
      );
    } else {
      state = state.copyWith(
        micStatus: MicPreflightStatus.noisyOrSilent,
        micStatusMessage: 'No clear voice detected. Move closer to your mic and retry, or continue without Speaking.',
        micLevel: 0,
      );
    }
  }

  /// Toggles Speaking opt-out during Step 0 or on a mic error banner.
  void setSpeakingOptOut({required bool optOut, NoEvidenceReason? reason}) {
    state = state.copyWith(
      speakingOptOut: optOut,
      speakingNoEvidenceReason: optOut
          ? (reason ?? NoEvidenceReason.micDenied)
          : null,
      clearSpeakingNoEvidenceReason: !optOut,
    );
  }

  /// Starts the live 4-skill diagnostic session and creates its server & local records.
  Future<String?> startDiagnosticSession() async {
    if (state.bank == null) {
      await _loadBank(alternateForm: false);
      if (state.bank == null) return null;
    }

    final clock = ref.read(clockProvider);
    final nowMs = clock.now().toUtc().millisecondsSinceEpoch;
    final collectionDeadline =
        nowMs + (DiagnosticBudget.collectionTotalSeconds * 1000);
    final resultsDeadline =
        collectionDeadline + (DiagnosticBudget.resultsWindowSeconds * 1000);
    final firstStageDeadline =
        DiagnosticBudget.computeBoundedStageDeadlineUtcMs(
          stageCapSeconds: DiagnosticBudget.readingMaxSeconds,
          globalCollectionDeadlineUtcMs: collectionDeadline,
          mode: state.mode,
          clock: clock,
        );

    final createRes = await ref
        .read(diagnosticGatewayProvider)
        .createOrResumeSession(
          diagId: state.diagId,
          examId: state.examId,
          mode: state.mode,
          selectionSeed: state.selectionSeed,
        );
    if (_disposed) return null;

    var resolvedCollectionDeadline = collectionDeadline;
    var resolvedResultsDeadline = resultsDeadline;
    if (createRes case Ok(:final value)) {
      final parsedCollection = DateTime.tryParse(
        value.collectionDeadlineAtIso,
      )?.toUtc().millisecondsSinceEpoch;
      final parsedResults = DateTime.tryParse(
        value.resultsDeadlineAtIso,
      )?.toUtc().millisecondsSinceEpoch;
      if (parsedCollection != null && parsedCollection > nowMs) {
        resolvedCollectionDeadline = parsedCollection;
      }
      if (parsedResults != null && parsedResults > resolvedCollectionDeadline) {
        resolvedResultsDeadline = parsedResults;
      }
    }

    state = state.copyWith(
      stage: DiagnosticFlowStage.readingExample,
      startedAtUtcMs: nowMs,
      collectionDeadlineUtcMs: resolvedCollectionDeadline,
      resultsDeadlineUtcMs: resolvedResultsDeadline,
      stageDeadlineUtcMs: firstStageDeadline,
      globalRemainingSeconds: DiagnosticBudget.remainingSeconds(
        deadlineUtcMs: resolvedCollectionDeadline,
        clock: clock,
      ),
      stageRemainingSeconds: DiagnosticBudget.remainingSeconds(
        deadlineUtcMs: firstStageDeadline,
        clock: clock,
      ),
      clearWorkedExampleOption: true,
      workedExampleRevealed: false,
      clearSubmitError: true,
    );

    _startCollectionTickTimer();
    await _persistLocalState();
    return state.diagId;
  }

  /// Launches a fresh alternate-form single-skill retake from the Results screen,
  /// preserving the other three already-evaluated skills on both client and server.
  Future<String?> startSingleSkillRetake(String skill) async {
    await _stopMedia();
    _cancelTimers();
    await _loadBank(alternateForm: true);
    if (_disposed || state.bank == null) return null;

    final entropy = ref.read(entropySourceProvider);
    final clock = ref.read(clockProvider);
    final nowMs = clock.now().toUtc().millisecondsSinceEpoch;
    final collectionDeadline =
        nowMs + (DiagnosticBudget.collectionTotalSeconds * 1000);
    final resultsDeadline =
        collectionDeadline + (DiagnosticBudget.resultsWindowSeconds * 1000);

    final nextStage = switch (skill) {
      'reading' => DiagnosticFlowStage.readingBlock,
      'listening' => DiagnosticFlowStage.listeningBlock,
      'writing' => DiagnosticFlowStage.writingBase,
      _ => DiagnosticFlowStage.speakingPrep,
    };

    final capSeconds = switch (skill) {
      'reading' => DiagnosticBudget.readingMaxSeconds,
      'listening' => DiagnosticBudget.listeningMaxSeconds,
      'writing' => DiagnosticBudget.writingMaxSeconds,
      _ => 15,
    };
    final stageDeadline = DiagnosticBudget.computeBoundedStageDeadlineUtcMs(
      stageCapSeconds: capSeconds,
      globalCollectionDeadlineUtcMs: collectionDeadline,
      mode: state.mode,
      clock: clock,
    );

    DiagnosticBlockDef? firstBlock;
    if (skill == 'reading') {
      final sel = DiagnosticRouter.selectNextObjectiveBlock(
        skill: 'reading',
        bank: state.bank!.readingBlocks,
        history: const [],
        remainingStageSeconds: DiagnosticBudget.readingMaxSeconds,
        remainingGlobalSeconds: DiagnosticBudget.collectionTotalSeconds,
        selectionSeed: entropy.nextUuidV4(),
        strictMode: state.isTimed,
      );
      firstBlock = sel.block;
    } else if (skill == 'listening') {
      final sel = DiagnosticRouter.selectNextObjectiveBlock(
        skill: 'listening',
        bank: state.bank!.listeningBlocks,
        history: const [],
        remainingStageSeconds: DiagnosticBudget.listeningMaxSeconds,
        remainingGlobalSeconds: DiagnosticBudget.collectionTotalSeconds,
        selectionSeed: entropy.nextUuidV4(),
        strictMode: state.isTimed,
      );
      firstBlock = sel.block;
    }

    state = state.copyWith(
      retakeSkill: skill,
      stage: nextStage,
      startedAtUtcMs: nowMs,
      collectionDeadlineUtcMs: collectionDeadline,
      resultsDeadlineUtcMs: resultsDeadline,
      stageDeadlineUtcMs: stageDeadline,
      globalRemainingSeconds: DiagnosticBudget.collectionTotalSeconds,
      stageRemainingSeconds: capSeconds,
      activeBlock: firstBlock,
      clearActiveBlock: firstBlock == null,
      activeBlockStartedUtcMs: firstBlock != null ? nowMs : null,
      clearSelections: true,
      readingHistory: skill == 'reading' ? const [] : state.readingHistory,
      clearReadingStopReason: skill == 'reading',
      readingSkipped: skill != 'reading' && state.readingSkipped,
      listeningHistory: skill == 'listening'
          ? const []
          : state.listeningHistory,
      clearListeningStopReason: skill == 'listening',
      listeningSkipped: skill != 'listening' && state.listeningSkipped,
      writingAttemptId: skill == 'writing'
          ? entropy.nextUuidV4()
          : state.writingAttemptId,
      writingBaseText: skill == 'writing' ? '' : state.writingBaseText,
      writingFollowUpText: skill == 'writing' ? '' : state.writingFollowUpText,
      clearWritingFollowUpPrompt: skill == 'writing',
      writingSkipped: skill != 'writing' && state.writingSkipped,
      speakingAttemptId: skill == 'speaking'
          ? entropy.nextUuidV4()
          : state.speakingAttemptId,
      speakingTurns: skill == 'speaking' ? const [] : state.speakingTurns,
      speakingSkipped: skill != 'speaking' && state.speakingSkipped,
      clearSpeakingNoEvidenceReason: skill == 'speaking',
      audioPlayCount: 0,
      audioCompleted: false,
      audioFailed: false,
      clearAudioErrorMessage: true,
      showAccessibleTranscript: false,
      clearSubmitError: true,
    );

    _startCollectionTickTimer();
    await _persistLocalState();
    if (skill == 'listening' && firstBlock != null) {
      unawaited(playCurrentListeningBlockAudio(isAutoPlay: true));
    }
    return state.diagId;
  }

  /// Restores an in-progress or completed diagnostic session by [diagId] (deep link / reload).
  Future<void> openOrResumeSession(String diagId) async {
    if (state.diagId == diagId && state.bank != null) return;
    await _loadBank(alternateForm: false);
    if (_disposed) return;

    final row = await ref
        .read(attemptRepositoryProvider)
        .getDiagnosticSession(diagId);
    if (_disposed) return;

    if (row != null) {
      _restoreFromRow(row);
    } else {
      final entropy = ref.read(entropySourceProvider);
      final clock = ref.read(clockProvider);
      final nowMs = clock.now().toUtc().millisecondsSinceEpoch;
      final collectionDeadline =
          nowMs + (DiagnosticBudget.collectionTotalSeconds * 1000);
      final resultsDeadline =
          collectionDeadline + (DiagnosticBudget.resultsWindowSeconds * 1000);
      final stageDeadline = DiagnosticBudget.computeBoundedStageDeadlineUtcMs(
        stageCapSeconds: DiagnosticBudget.readingMaxSeconds,
        globalCollectionDeadlineUtcMs: collectionDeadline,
        mode: DiagnosticMode.standard,
        clock: clock,
      );
      state = state.copyWith(
        diagId: diagId,
        selectionSeed: entropy.nextUuidV4(),
        writingAttemptId: entropy.nextUuidV4(),
        speakingAttemptId: entropy.nextUuidV4(),
        stage: DiagnosticFlowStage.readingExample,
        startedAtUtcMs: nowMs,
        collectionDeadlineUtcMs: collectionDeadline,
        resultsDeadlineUtcMs: resultsDeadline,
        stageDeadlineUtcMs: stageDeadline,
      );
      _startCollectionTickTimer();
    }
  }

  /// Opens the results route for [diagId], restoring cached results and polling if needed.
  Future<void> openResults(String diagId) async {
    final row = await ref
        .read(attemptRepositoryProvider)
        .getDiagnosticSession(diagId);
    if (_disposed) return;
    if (row != null) {
      _restoreFromRow(row);
    } else if (state.diagId != diagId) {
      state = state.copyWith(
        diagId: diagId,
        stage: DiagnosticFlowStage.results,
      );
    } else {
      state = state.copyWith(stage: DiagnosticFlowStage.results);
    }
    if (state.bank == null) {
      unawaited(_loadBank(alternateForm: false));
    }
    await refreshResults();
    _startResultsPolling();
  }

  /// Polls `/v1/diagnostic/sessions/:diagId` once to update pending Writing/Speaking evaluations.
  Future<void> refreshResults() async {
    if (state.diagId.isEmpty) return;
    final clock = ref.read(clockProvider);
    final res = await ref
        .read(diagnosticGatewayProvider)
        .fetchSession(diagId: state.diagId);
    if (_disposed) return;
    res.when(
      success: (snapshot) {
        final resultsDeadline = state.resultsDeadlineUtcMs;
        final remaining = resultsDeadline != null
            ? DiagnosticBudget.remainingSeconds(
                deadlineUtcMs: resultsDeadline,
                clock: clock,
              )
            : 0;
        state = state.copyWith(
          stage: DiagnosticFlowStage.results,
          sessionSnapshot: snapshot,
          resultsRemainingSeconds: remaining,
          clearSubmitError: true,
        );
        unawaited(_persistLocalState());
        if (!snapshot.hasPendingWork) {
          _resultsPollTimer?.cancel();
        }
      },
      failure: (_) {},
    );
  }

  /// Selects an option on the Reading or Listening worked example screen.
  void selectWorkedExampleOption(int index) {
    state = state.copyWith(
      workedExampleOption: index,
      workedExampleRevealed: true,
    );
  }

  /// Advances from the unscored Reading worked example to the first live adaptive block.
  void startLiveReadingBlocks() {
    final bank = state.bank;
    if (bank == null) return;
    final clock = ref.read(clockProvider);
    final nowMs = clock.now().toUtc().millisecondsSinceEpoch;
    final sel = DiagnosticRouter.selectNextObjectiveBlock(
      skill: 'reading',
      bank: bank.readingBlocks,
      history: const [],
      remainingStageSeconds: state.stageRemainingSeconds,
      remainingGlobalSeconds: state.globalRemainingSeconds,
      selectionSeed: state.selectionSeed,
      strictMode: state.isTimed,
    );
    if (!sel.shouldPresent || sel.block == null) {
      _advanceFromReading(sel.stopReason ?? DiagnosticStopReason.contentLimit);
      return;
    }
    state = state.copyWith(
      stage: DiagnosticFlowStage.readingBlock,
      activeBlock: sel.block,
      activeBlockStartedUtcMs: nowMs,
      clearSelections: true,
    );
    unawaited(_persistLocalState());
  }

  /// Selects an option (`0..2`) for Q1 or Q2 on the current objective block.
  void selectBlockOption({
    required int questionIndex,
    required int optionIndex,
  }) {
    if (questionIndex == 0) {
      state = state.copyWith(selectedOptionQ0: optionIndex);
    } else {
      state = state.copyWith(selectedOptionQ1: optionIndex);
    }
  }

  /// Submits the currently selected answers for the active Reading or Listening block
  /// and executes the adaptive next-block router.
  void submitCurrentObjectiveBlock() {
    final block = state.activeBlock;
    if (block == null) return;
    final selected0 = state.selectedOptionQ0;
    final selected1 = state.selectedOptionQ1;
    if (selected0 == null || selected1 == null) return;

    final outcome = DiagnosticRouter.classifyBlockOutcome(
      questions: block.questions,
      selectedOptionIndices: <int?>[selected0, selected1],
    );
    _recordBlockOutcomeAndRoute(
      block: block,
      category: outcome.category,
      correctCount: outcome.correctCount,
      selectedIndices: <int?>[selected0, selected1],
      noEvidenceReason: outcome.noEvidenceReason,
    );
  }

  /// Records explicit `"I don't know"` for the current block (routes as `no_evidence`,
  /// never punishing with a wrong-answer difficulty drop).
  void markCurrentBlockDontKnow() {
    final block = state.activeBlock;
    if (block == null) return;
    _recordBlockOutcomeAndRoute(
      block: block,
      category: RoutingCategory.noEvidence,
      correctCount: 0,
      selectedIndices: const <int?>[null, null],
      noEvidenceReason: NoEvidenceReason.dontKnow,
    );
  }

  /// Skips the entire Reading or Listening skill cleanly (`skipped` -> `null` score).
  void skipObjectiveStage() {
    unawaited(_stopMedia());
    if (state.stage == DiagnosticFlowStage.readingExample ||
        state.stage == DiagnosticFlowStage.readingBlock) {
      state = state.copyWith(
        readingSkipped: true,
        readingStopReason: DiagnosticStopReason.contentLimit,
        clearActiveBlock: true,
        clearSelections: true,
      );
      if (state.retakeSkill == 'reading') {
        unawaited(submitAllAndGoResults());
        return;
      }
      _enterTransition(
        DiagnosticFlowStage.transitionToListening,
        nextAction: _enterListeningExample,
      );
    } else {
      state = state.copyWith(
        listeningSkipped: true,
        listeningStopReason: DiagnosticStopReason.contentLimit,
        clearActiveBlock: true,
        clearSelections: true,
      );
      if (state.retakeSkill == 'listening') {
        unawaited(submitAllAndGoResults());
        return;
      }
      _enterTransition(
        DiagnosticFlowStage.transitionToWriting,
        nextAction: _enterWritingBase,
      );
    }
    unawaited(_persistLocalState());
  }

  void _recordBlockOutcomeAndRoute({
    required DiagnosticBlockDef block,
    required RoutingCategory category,
    required int correctCount,
    required List<int?> selectedIndices,
    NoEvidenceReason? noEvidenceReason,
  }) {
    final clock = ref.read(clockProvider);
    final nowMs = clock.now().toUtc().millisecondsSinceEpoch;
    final elapsedSeconds = state.activeBlockStartedUtcMs != null
        ? ((nowMs - state.activeBlockStartedUtcMs!) / 1000).round().clamp(
            1,
            300,
          )
        : null;

    final record = BlockAttemptRecord(
      blockId: block.blockId,
      tier: block.tier,
      category: category,
      selectedOptionIndices: selectedIndices,
      correctCount: correctCount,
      noEvidenceReason: noEvidenceReason,
      elapsedSeconds: elapsedSeconds,
    );

    final isListening = state.stage == DiagnosticFlowStage.listeningBlock;
    final updatedHistory = isListening
        ? <BlockAttemptRecord>[...state.listeningHistory, record]
        : <BlockAttemptRecord>[...state.readingHistory, record];

    final bankBlocks = isListening
        ? state.bank!.listeningBlocks
        : state.bank!.readingBlocks;
    final sel = DiagnosticRouter.selectNextObjectiveBlock(
      skill: isListening ? 'listening' : 'reading',
      bank: bankBlocks,
      history: updatedHistory,
      remainingStageSeconds: state.stageRemainingSeconds,
      remainingGlobalSeconds: state.globalRemainingSeconds,
      selectionSeed: state.selectionSeed,
      strictMode: state.isTimed,
    );

    if (isListening) {
      state = state.copyWith(listeningHistory: updatedHistory);
      if (sel.shouldPresent && sel.block != null) {
        state = state.copyWith(
          activeBlock: sel.block,
          activeBlockStartedUtcMs: nowMs,
          clearSelections: true,
          isAudioLoading: false,
          isAudioPlaying: false,
          audioPlayCount: 0,
          audioCompleted: false,
          audioFailed: false,
          clearAudioErrorMessage: true,
          showAccessibleTranscript: false,
        );
        unawaited(playCurrentListeningBlockAudio(isAutoPlay: true));
      } else {
        unawaited(_stopAudioOnly());
        _advanceFromListening(
          sel.stopReason ?? DiagnosticStopReason.samplingComplete,
        );
      }
    } else {
      state = state.copyWith(readingHistory: updatedHistory);
      if (sel.shouldPresent && sel.block != null) {
        state = state.copyWith(
          activeBlock: sel.block,
          activeBlockStartedUtcMs: nowMs,
          clearSelections: true,
        );
      } else {
        _advanceFromReading(
          sel.stopReason ?? DiagnosticStopReason.samplingComplete,
        );
      }
    }
    unawaited(_persistLocalState());
  }

  void _advanceFromReading(DiagnosticStopReason reason) {
    state = state.copyWith(
      readingStopReason: reason,
      clearActiveBlock: true,
      clearSelections: true,
    );
    if (state.retakeSkill == 'reading') {
      unawaited(submitAllAndGoResults());
      return;
    }
    _enterTransition(
      DiagnosticFlowStage.transitionToListening,
      nextAction: _enterListeningExample,
    );
  }

  void _enterListeningExample() {
    final clock = ref.read(clockProvider);
    final globalDeadline =
        state.collectionDeadlineUtcMs ??
        (clock.now().toUtc().millisecondsSinceEpoch + 400000);
    final stageDeadline = DiagnosticBudget.computeBoundedStageDeadlineUtcMs(
      stageCapSeconds: DiagnosticBudget.listeningMaxSeconds,
      globalCollectionDeadlineUtcMs: globalDeadline,
      mode: state.mode,
      clock: clock,
    );
    state = state.copyWith(
      stage: DiagnosticFlowStage.listeningExample,
      stageDeadlineUtcMs: stageDeadline,
      stageRemainingSeconds: DiagnosticBudget.remainingSeconds(
        deadlineUtcMs: stageDeadline,
        clock: clock,
      ),
      clearWorkedExampleOption: true,
      workedExampleRevealed: false,
      audioPlayCount: 0,
      audioCompleted: false,
      audioFailed: false,
      clearAudioErrorMessage: true,
    );
    unawaited(_persistLocalState());
  }

  /// Plays the worked Listening example sample clip (unrestricted replay on example).
  Future<void> playWorkedListeningExample() async {
    final url = state.bank?.workedListening.mediaUrl;
    if (url == null || url.isEmpty) return;
    await _playMediaPath(url, lockAfterOnePlay: false, countAsBlockPlay: false);
  }

  /// Starts live adaptive Listening blocks after the worked example.
  void startLiveListeningBlocks() {
    final bank = state.bank;
    if (bank == null) return;
    final clock = ref.read(clockProvider);
    final nowMs = clock.now().toUtc().millisecondsSinceEpoch;
    final sel = DiagnosticRouter.selectNextObjectiveBlock(
      skill: 'listening',
      bank: bank.listeningBlocks,
      history: const [],
      remainingStageSeconds: state.stageRemainingSeconds,
      remainingGlobalSeconds: state.globalRemainingSeconds,
      selectionSeed: state.selectionSeed,
      strictMode: state.isTimed,
    );
    if (!sel.shouldPresent || sel.block == null) {
      unawaited(_stopAudioOnly());
      _advanceFromListening(
        sel.stopReason ?? DiagnosticStopReason.contentLimit,
      );
      return;
    }
    state = state.copyWith(
      stage: DiagnosticFlowStage.listeningBlock,
      activeBlock: sel.block,
      activeBlockStartedUtcMs: nowMs,
      clearSelections: true,
      isAudioLoading: false,
      isAudioPlaying: false,
      audioPlayCount: 0,
      audioCompleted: false,
      audioFailed: false,
      clearAudioErrorMessage: true,
      showAccessibleTranscript: false,
    );
    unawaited(_persistLocalState());
    unawaited(playCurrentListeningBlockAudio(isAutoPlay: true));
  }

  /// Plays the current Listening block clip (played once in standard mode; replayable in accessible mode).
  Future<void> playCurrentListeningBlockAudio({bool isAutoPlay = false}) async {
    final url = state.activeBlock?.mediaUrl;
    if (url == null || url.isEmpty) {
      state = state.copyWith(
        audioFailed: true,
        audioErrorMessage: 'Audio clip missing for this block.',
      );
      return;
    }
    if (state.audioPlayCount >= 1 &&
        state.mode != DiagnosticMode.accessible &&
        !state.audioFailed) {
      return;
    }
    await _playMediaPath(
      url,
      lockAfterOnePlay: state.mode != DiagnosticMode.accessible,
      countAsBlockPlay: true,
      isAutoPlay: isAutoPlay,
    );
  }

  Future<void> _playMediaPath(
    String relativeOrAbsolute, {
    required bool lockAfterOnePlay,
    required bool countAsBlockPlay,
    bool isAutoPlay = false,
  }) async {
    final resolved = ref
        .read(editionConfigProvider)
        .resolveMediaUrl(relativeOrAbsolute);
    final player = ref.read(audioPlayerGatewayProvider);
    final gen = ++_playbackGeneration;
    unawaited(_playSub?.cancel());
    _playSub = null;
    try {
      await player.pause();
    } on Object {
      // Ignore pause errors before loading fresh source.
    }
    if (_disposed || gen != _playbackGeneration) return;

    player.setPlaybackMode(
      lockAfterOnePlay
          ? AudioPlaybackMode.examLinearLocked
          : AudioPlaybackMode.studyInteractive,
    );

    state = state.copyWith(
      isAudioLoading: true,
      isAudioPlaying: false,
      audioFailed: false,
      clearAudioErrorMessage: true,
    );

    final loadRes = await player.loadFile(resolved);
    if (_disposed || gen != _playbackGeneration) return;
    if (loadRes case Err(:final failure)) {
      state = state.copyWith(
        isAudioLoading: false,
        isAudioPlaying: false,
        audioFailed: true,
        audioErrorMessage: 'Could not load audio (${failure.message}).',
      );
      return;
    }

    _playSub = player.watchIsPlaying().listen((playing) {
      if (_disposed || gen != _playbackGeneration) return;
      if (!playing && state.isAudioPlaying) {
        state = state.copyWith(
          isAudioPlaying: false,
          audioCompleted: true,
        );
      } else if (playing && !state.isAudioPlaying) {
        state = state.copyWith(
          isAudioLoading: false,
          isAudioPlaying: true,
        );
      }
    }, onError: (_) {});

    final priorCount = state.audioPlayCount;
    state = state.copyWith(
      isAudioLoading: false,
      isAudioPlaying: true,
      audioPlayCount: countAsBlockPlay ? priorCount + 1 : priorCount,
    );

    unawaited(
      player.play().then((playRes) {
        if (_disposed || gen != _playbackGeneration) return;
        if (playRes case Err(:final failure)) {
          if (isAutoPlay) {
            state = state.copyWith(
              isAudioLoading: false,
              isAudioPlaying: false,
              audioPlayCount: priorCount,
              audioFailed: false,
              clearAudioErrorMessage: true,
            );
          } else {
            state = state.copyWith(
              isAudioLoading: false,
              isAudioPlaying: false,
              audioFailed: true,
              audioErrorMessage: 'Audio playback failed (${failure.message}).',
            );
          }
          return;
        }
        if (state.isAudioPlaying) {
          state = state.copyWith(
            isAudioLoading: false,
            isAudioPlaying: false,
            audioCompleted: true,
          );
        }
      }),
    );
  }

  Future<void> _stopAudioOnly() async {
    _playbackGeneration += 1;
    unawaited(_playSub?.cancel());
    _playSub = null;
    try {
      await ref.read(audioPlayerGatewayProvider).pause();
    } on Object {
      // Ignore cleanup errors.
    }
    if (!_disposed) {
      state = state.copyWith(
        isAudioLoading: false,
        isAudioPlaying: false,
        isPlayingPreflightAudio: false,
      );
    }
  }

  /// Reveals or hides the post-audio transcript when `mode == DiagnosticMode.accessible`.
  void toggleAccessibleTranscript() {
    if (state.mode != DiagnosticMode.accessible || !state.audioCompleted) {
      return;
    }
    state = state.copyWith(
      showAccessibleTranscript: !state.showAccessibleTranscript,
    );
  }

  /// Exits Listening gracefully on unrecoverable playback failure (`noEvidenceReason: playbackFailed`).
  void abandonListeningDueToPlaybackFailure() {
    final block = state.activeBlock;
    if (block != null) {
      _recordBlockOutcomeAndRoute(
        block: block,
        category: RoutingCategory.noEvidence,
        correctCount: 0,
        selectedIndices: const <int?>[null, null],
        noEvidenceReason: NoEvidenceReason.playbackFailed,
      );
      return;
    }
    _advanceFromListening(DiagnosticStopReason.contentLimit);
  }

  void _advanceFromListening(DiagnosticStopReason reason) {
    unawaited(_stopMedia());
    state = state.copyWith(
      listeningStopReason: reason,
      clearActiveBlock: true,
      clearSelections: true,
    );
    if (state.retakeSkill == 'listening') {
      unawaited(submitAllAndGoResults());
      return;
    }
    _enterTransition(
      DiagnosticFlowStage.transitionToWriting,
      nextAction: _enterWritingBase,
    );
  }

  void _enterTransition(
    DiagnosticFlowStage transitionStage, {
    required VoidCallback nextAction,
  }) {
    _transitionTimer?.cancel();
    state = state.copyWith(stage: transitionStage);
    _transitionTimer = Timer(
      const Duration(seconds: DiagnosticBudget.transitionMaxSeconds),
      () {
        if (!_disposed && state.stage == transitionStage) {
          nextAction();
        }
      },
    );
  }

  /// Advances immediately past a transition screen instead of waiting 5 seconds.
  void skipTransitionNow() {
    _transitionTimer?.cancel();
    switch (state.stage) {
      case DiagnosticFlowStage.transitionToListening:
        _enterListeningExample();
      case DiagnosticFlowStage.transitionToWriting:
        _enterWritingBase();
      case DiagnosticFlowStage.transitionToSpeaking:
        _enterSpeakingPrep();
      case DiagnosticFlowStage.intro:
      case DiagnosticFlowStage.readingExample:
      case DiagnosticFlowStage.readingBlock:
      case DiagnosticFlowStage.listeningExample:
      case DiagnosticFlowStage.listeningBlock:
      case DiagnosticFlowStage.writingBase:
      case DiagnosticFlowStage.writingFollowUp:
      case DiagnosticFlowStage.speakingPrep:
      case DiagnosticFlowStage.speakingRecording:
      case DiagnosticFlowStage.speakingFollowUp:
      case DiagnosticFlowStage.submitting:
      case DiagnosticFlowStage.results:
        break;
    }
  }

  void _enterWritingBase() {
    final clock = ref.read(clockProvider);
    final globalDeadline =
        state.collectionDeadlineUtcMs ??
        (clock.now().toUtc().millisecondsSinceEpoch + 300000);
    final stageDeadline = DiagnosticBudget.computeBoundedStageDeadlineUtcMs(
      stageCapSeconds: DiagnosticBudget.writingMaxSeconds,
      globalCollectionDeadlineUtcMs: globalDeadline,
      mode: state.mode,
      clock: clock,
    );
    state = state.copyWith(
      stage: DiagnosticFlowStage.writingBase,
      stageDeadlineUtcMs: stageDeadline,
      stageRemainingSeconds: DiagnosticBudget.remainingSeconds(
        deadlineUtcMs: stageDeadline,
        clock: clock,
      ),
    );
    unawaited(_persistLocalState());
  }

  /// Updates Writing base text and schedules a debounced Drift persistence flush.
  void updateWritingBaseText(String value) {
    state = state.copyWith(writingBaseText: value);
    _scheduleDraftFlush();
  }

  /// Updates Writing follow-up text and schedules a debounced Drift persistence flush.
  void updateWritingFollowUpText(String value) {
    state = state.copyWith(writingFollowUpText: value);
    _scheduleDraftFlush();
  }

  void _scheduleDraftFlush() {
    _draftDebounceTimer?.cancel();
    _draftDebounceTimer = Timer(
      const Duration(milliseconds: 500),
      () => unawaited(_persistLocalState()),
    );
  }

  /// Flushes any pending Writing draft immediately on app pause or submission.
  Future<void> flushPendingDraft() async {
    _draftDebounceTimer?.cancel();
    await _persistLocalState();
  }

  /// Moves from base Writing prompt to optional supportive/extension follow-up or Speaking.
  Future<void> completeWritingBase({bool forceSupportiveHelper = false}) async {
    await flushPendingDraft();
    final bank = state.bank;
    final words = state.writingBaseText
        .trim()
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .length;

    if (bank != null &&
        (!state.isTimed || state.stageRemainingSeconds >= 20) &&
        state.writingFollowUpPrompt == null) {
      final prompt = (forceSupportiveHelper || words < 25)
          ? bank.writingPrompt.supportiveFollowUp
          : bank.writingPrompt.extensionFollowUp;
      state = state.copyWith(
        stage: DiagnosticFlowStage.writingFollowUp,
        writingFollowUpPrompt: prompt,
      );
      await _persistLocalState();
      return;
    }

    await completeWritingStage();
  }

  /// Completes Writing (keeping whatever text the learner typed) and advances to Speaking or submit.
  Future<void> completeWritingStage({bool skipped = false}) async {
    await flushPendingDraft();
    state = state.copyWith(writingSkipped: skipped);
    if (state.retakeSkill == 'writing') {
      await submitAllAndGoResults();
      return;
    }
    if (state.speakingOptOut) {
      state = state.copyWith(
        speakingSkipped: false,
        speakingNoEvidenceReason:
            state.speakingNoEvidenceReason ?? NoEvidenceReason.micDenied,
      );
      await submitAllAndGoResults();
      return;
    }
    _enterTransition(
      DiagnosticFlowStage.transitionToSpeaking,
      nextAction: _enterSpeakingPrep,
    );
    await _persistLocalState();
  }

  void _enterSpeakingPrep() {
    final clock = ref.read(clockProvider);
    final globalDeadline =
        state.collectionDeadlineUtcMs ??
        (clock.now().toUtc().millisecondsSinceEpoch + 120000);
    final stageDeadline = DiagnosticBudget.computeBoundedStageDeadlineUtcMs(
      stageCapSeconds: 15,
      globalCollectionDeadlineUtcMs: globalDeadline,
      mode: state.mode,
      clock: clock,
    );
    state = state.copyWith(
      stage: DiagnosticFlowStage.speakingPrep,
      stageDeadlineUtcMs: stageDeadline,
      stageRemainingSeconds: DiagnosticBudget.remainingSeconds(
        deadlineUtcMs: stageDeadline,
        clock: clock,
      ),
      clearSpeakingStatusMessage: true,
    );
    unawaited(_persistLocalState());
  }

  /// Starts the main `45s` Speaking capture turn (`partIndex: 1`).
  Future<void> startSpeakingRecording({int partIndex = 1}) async {
    if (state.isSpeakingRecording || state.isUploadingSpeaking) return;
    final recorder = ref.read(audioRecorderGatewayProvider);
    final permRes = await recorder.hasPermission();
    if (_disposed) return;

    if (!(permRes.valueOrNull ?? false)) {
      state = state.copyWith(
        speakingNoEvidenceReason: NoEvidenceReason.micDenied,
        speakingStatusMessage:
            'Microphone access is blocked. You can finish without Speaking.',
      );
      return;
    }

    final fileName = 'diag_${state.speakingAttemptId}_p$partIndex.m4a';
    _activeRecordingPath = await createTempRecordingPath(fileName);
    final startRes = await recorder.startRecording(
      outputPath: _activeRecordingPath ?? '',
    );
    if (_disposed) return;

    if (startRes case Err(:final failure)) {
      state = state.copyWith(
        speakingNoEvidenceReason: NoEvidenceReason.micDenied,
        speakingStatusMessage: 'Microphone unavailable (${failure.message}).',
      );
      return;
    }

    final clock = ref.read(clockProvider);
    final globalDeadline =
        state.collectionDeadlineUtcMs ??
        (clock.now().toUtc().millisecondsSinceEpoch + 90000);
    final turnCapSeconds = partIndex == 1 ? 45 : 25;
    final stageDeadline = DiagnosticBudget.computeBoundedStageDeadlineUtcMs(
      stageCapSeconds: turnCapSeconds,
      globalCollectionDeadlineUtcMs: globalDeadline,
      mode: state.mode,
      clock: clock,
    );

    unawaited(_ampSub?.cancel());
    _ampSub = recorder.watchAmplitude().listen((amp) {
      if (!_disposed) {
        state = state.copyWith(speakingAmplitude: amp);
      }
    }, onError: (_) {});

    state = state.copyWith(
      stage: partIndex == 1
          ? DiagnosticFlowStage.speakingRecording
          : DiagnosticFlowStage.speakingFollowUp,
      stageDeadlineUtcMs: stageDeadline,
      stageRemainingSeconds: DiagnosticBudget.remainingSeconds(
        deadlineUtcMs: stageDeadline,
        clock: clock,
      ),
      isSpeakingRecording: true,
      speakingAmplitude: 0,
      speakingElapsedMs: 0,
      speakingStatusMessage: 'Recording...',
    );
  }

  /// Stops active Speaking capture, persists bytes, uploads to storage, and decides follow-up vs submit.
  Future<void> stopSpeakingRecordingAndUpload({
    required int partIndex,
    bool autoSubmitAfter = false,
  }) async {
    if (!state.isSpeakingRecording) return;
    final recorder = ref.read(audioRecorderGatewayProvider);
    unawaited(_ampSub?.cancel());
    final stopRes = await recorder.stopRecording();
    if (_disposed) return;

    final recordedPath = stopRes.valueOrNull ?? _activeRecordingPath;
    _activeRecordingPath = null;
    final durationMs = state.speakingElapsedMs;

    state = state.copyWith(
      isSpeakingRecording: false,
      speakingAmplitude: 0,
      isUploadingSpeaking: true,
      speakingStatusMessage: 'Saving your audio...',
    );

    if (recordedPath == null || recordedPath.isEmpty) {
      state = state.copyWith(
        isUploadingSpeaking: false,
        speakingNoEvidenceReason: NoEvidenceReason.unusableAudio,
        speakingStatusMessage: 'No audio captured.',
      );
      if (autoSubmitAfter) {
        await submitAllAndGoResults();
      }
      return;
    }

    final persisted = await persistRecordedAudioClipWithStatus(
      recordedPath,
      '${state.speakingAttemptId}_p$partIndex',
      mimeType: recorder.activeContentType,
    );
    final bytes = await readRecordedAudioBytes(persisted.pathOrUrl);
    if (_disposed) return;

    if (bytes == null || bytes.isEmpty) {
      state = state.copyWith(
        isUploadingSpeaking: false,
        speakingNoEvidenceReason: NoEvidenceReason.unusableAudio,
        speakingStatusMessage: 'Recorded audio could not be read.',
      );
      if (autoSubmitAfter) {
        await submitAllAndGoResults();
      }
      return;
    }

    final gradingGateway = ref.read(gradingGatewayProvider);
    final presignRes = await gradingGateway.presignAudioUpload(
      attemptId: state.speakingAttemptId,
      partIndex: partIndex,
      byteLength: bytes.length,
      contentType: recorder.activeContentType,
    );
    if (_disposed) return;

    late final ({String uploadUrl, String objectKey}) presign;
    switch (presignRes) {
      case Err(:final failure):
        state = state.copyWith(
          isUploadingSpeaking: false,
          speakingStatusMessage: 'Audio upload failed (${failure.message}).',
        );
        if (autoSubmitAfter) {
          await submitAllAndGoResults();
        }
        return;
      case Ok(:final value):
        presign = value;
    }

    final uploadRes = await gradingGateway.uploadAudioBytes(
      uploadUrl: presign.uploadUrl,
      bytes: bytes,
      contentType: recorder.activeContentType,
    );
    if (_disposed) return;
    await deleteRecordedAudioClip(persisted.pathOrUrl);

    if (uploadRes case Err(:final failure)) {
      state = state.copyWith(
        isUploadingSpeaking: false,
        speakingStatusMessage: 'Audio upload failed (${failure.message}).',
      );
      if (autoSubmitAfter) {
        await submitAllAndGoResults();
      }
      return;
    }

    final promptText = partIndex == 1
        ? (state.bank?.speakingPrompt.basePrompt ?? '')
        : (state.speakingFollowUpPrompt ??
              state.bank?.speakingPrompt.extensionFollowUp ??
              '');
    final nextTurns = <DiagnosticSpeakingTurnDraft>[
      ...state.speakingTurns.where((t) => t.partIndex != partIndex),
      (
        partIndex: partIndex,
        promptText: promptText,
        objectKey: presign.objectKey,
        durationMs: durationMs > 0 ? durationMs : 1000,
      ),
    ];

    state = state.copyWith(
      speakingTurns: nextTurns,
      isUploadingSpeaking: false,
      clearSpeakingNoEvidenceReason: true,
      speakingStatusMessage: 'Audio saved.',
    );
    await _persistLocalState();

    if (!autoSubmitAfter &&
        partIndex == 1 &&
        state.bank != null &&
        (!state.isTimed || state.globalRemainingSeconds >= 30)) {
      final followPrompt = durationMs < 12000
          ? state.bank!.speakingPrompt.supportiveFollowUp
          : state.bank!.speakingPrompt.extensionFollowUp;
      final clock = ref.read(clockProvider);
      final globalDeadline =
          state.collectionDeadlineUtcMs ??
          (clock.now().toUtc().millisecondsSinceEpoch + 30000);
      final stageDeadline = DiagnosticBudget.computeBoundedStageDeadlineUtcMs(
        stageCapSeconds: 25,
        globalCollectionDeadlineUtcMs: globalDeadline,
        mode: state.mode,
        clock: clock,
      );
      state = state.copyWith(
        stage: DiagnosticFlowStage.speakingFollowUp,
        speakingFollowUpPrompt: followPrompt,
        stageDeadlineUtcMs: stageDeadline,
        stageRemainingSeconds: DiagnosticBudget.remainingSeconds(
          deadlineUtcMs: stageDeadline,
          clock: clock,
        ),
        speakingStatusMessage: 'Optional quick follow-up ready.',
      );
      return;
    }

    await submitAllAndGoResults();
  }

  /// Marks Speaking as skipped (`skipped` -> `null` score) and submits immediately.
  Future<void> skipSpeakingAndSubmit({NoEvidenceReason? reason}) async {
    await _stopMedia();
    state = state.copyWith(
      speakingSkipped: reason == null || reason == NoEvidenceReason.skipped,
      speakingNoEvidenceReason: reason ?? NoEvidenceReason.skipped,
    );
    await submitAllAndGoResults();
  }

  /// Finalizes active capture/drafts and submits either full diagnostic or single-skill retake.
  Future<DiagnosticSessionSnapshot?> submitAllAndGoResults() async {
    if (state.isSubmitting) return state.sessionSnapshot;
    _transitionTimer?.cancel();
    _tickTimer?.cancel();
    await flushPendingDraft();
    await _stopMedia();

    state = state.copyWith(
      stage: DiagnosticFlowStage.submitting,
      isSubmitting: true,
      clearSubmitError: true,
    );

    final gateway = ref.read(diagnosticGatewayProvider);
    final bank = state.bank;

    final result = state.retakeSkill != null
        ? await gateway.retakeSingleSkill(
            diagId: state.diagId,
            skill: state.retakeSkill!,
            readingHistory: state.retakeSkill == 'reading'
                ? state.readingHistory
                : null,
            readingStopReason: state.retakeSkill == 'reading'
                ? state.readingStopReason
                : null,
            listeningHistory: state.retakeSkill == 'listening'
                ? state.listeningHistory
                : null,
            listeningStopReason: state.retakeSkill == 'listening'
                ? state.listeningStopReason
                : null,
            writingAttemptId: state.retakeSkill == 'writing'
                ? state.writingAttemptId
                : null,
            writingPromptTitle: bank?.writingPrompt.title,
            writingBasePrompt: bank?.writingPrompt.basePrompt,
            writingFollowUpPrompt: state.writingFollowUpPrompt,
            writingBaseResponse: state.writingBaseText,
            writingFollowUpResponse: state.writingFollowUpText.isEmpty
                ? null
                : state.writingFollowUpText,
            speakingAttemptId: state.retakeSkill == 'speaking'
                ? state.speakingAttemptId
                : null,
            speakingBasePrompt: bank?.speakingPrompt.basePrompt,
            speakingFollowUpPrompt: state.speakingFollowUpPrompt,
            speakingTurns: state.retakeSkill == 'speaking'
                ? state.speakingTurns
                : null,
          )
        : await gateway.submitSession(
            diagId: state.diagId,
            examId: state.examId,
            mode: state.mode,
            readingHistory: state.readingHistory,
            readingStopReason: state.readingStopReason,
            readingSkipped: state.readingSkipped,
            listeningHistory: state.listeningHistory,
            listeningStopReason: state.listeningStopReason,
            listeningSkipped: state.listeningSkipped,
            writingAttemptId: state.writingAttemptId,
            writingPromptTitle: bank?.writingPrompt.title,
            writingBasePrompt: bank?.writingPrompt.basePrompt,
            writingFollowUpPrompt: state.writingFollowUpPrompt,
            writingBaseResponse: state.writingBaseText,
            writingFollowUpResponse: state.writingFollowUpText.isEmpty
                ? null
                : state.writingFollowUpText,
            writingSkipped: state.writingSkipped,
            speakingAttemptId: state.speakingAttemptId,
            speakingBasePrompt: bank?.speakingPrompt.basePrompt,
            speakingFollowUpPrompt: state.speakingFollowUpPrompt,
            speakingTurns: state.speakingTurns,
            speakingSkipped: state.speakingSkipped,
            speakingNoEvidenceReason: state.speakingNoEvidenceReason,
          );

    if (_disposed) return null;

    switch (result) {
      case Ok(:final value):
        final clock = ref.read(clockProvider);
        final submitWindowEnd =
            clock.now().toUtc().millisecondsSinceEpoch +
            DiagnosticBudget.resultsWindowSeconds * 1000;
        final existingDeadline = state.resultsDeadlineUtcMs;
        final resultsDeadline =
            existingDeadline != null && existingDeadline < submitWindowEnd
            ? existingDeadline
            : submitWindowEnd;
        state = state.copyWith(
          stage: DiagnosticFlowStage.results,
          isSubmitting: false,
          sessionSnapshot: value,
          clearRetakeSkill: true,
          resultsDeadlineUtcMs: resultsDeadline,
          resultsRemainingSeconds: DiagnosticBudget.remainingSeconds(
            deadlineUtcMs: resultsDeadline,
            clock: clock,
          ),
        );
        await _persistLocalState();
        _startResultsPolling();
        return value;
      case Err(:final failure):
        state = state.copyWith(
          stage: DiagnosticFlowStage.submitting,
          isSubmitting: false,
          submitError: failure.message,
        );
        await _persistLocalState();
        return null;
    }
  }

  void _startCollectionTickTimer() {
    _tickTimer?.cancel();
    _tickTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_disposed) return;
      _onCollectionTick();
    });
  }

  void _onCollectionTick() {
    final clock = ref.read(clockProvider);
    final globalDeadline = state.collectionDeadlineUtcMs;
    final stageDeadline = state.stageDeadlineUtcMs;
    if (globalDeadline == null) return;

    final nextGlobal = DiagnosticBudget.remainingSeconds(
      deadlineUtcMs: globalDeadline,
      clock: clock,
    );
    final nextStage = stageDeadline != null
        ? DiagnosticBudget.remainingSeconds(
            deadlineUtcMs: stageDeadline,
            clock: clock,
          )
        : nextGlobal;

    state = state.copyWith(
      globalRemainingSeconds: nextGlobal,
      stageRemainingSeconds: nextStage,
      speakingElapsedMs: state.isSpeakingRecording
          ? state.speakingElapsedMs + 1000
          : state.speakingElapsedMs,
    );

    if (state.isTimed && nextGlobal <= 0) {
      _handleGlobalCollectionTimeout();
      return;
    }

    if (state.isTimed && nextStage <= 0) {
      _handleStageTimeout();
    }
  }

  void _handleGlobalCollectionTimeout() {
    _tickTimer?.cancel();
    _transitionTimer?.cancel();
    if (state.stage == DiagnosticFlowStage.readingBlock &&
        state.activeBlock != null) {
      final block = state.activeBlock!;
      final outcome = DiagnosticRouter.classifyBlockOutcome(
        questions: block.questions,
        selectedOptionIndices: <int?>[
          state.selectedOptionQ0,
          state.selectedOptionQ1,
        ],
      );
      state = state.copyWith(
        readingHistory: <BlockAttemptRecord>[
          ...state.readingHistory,
          BlockAttemptRecord(
            blockId: block.blockId,
            tier: block.tier,
            category: outcome.category,
            selectedOptionIndices: <int?>[
              state.selectedOptionQ0,
              state.selectedOptionQ1,
            ],
            correctCount: outcome.correctCount,
            noEvidenceReason: outcome.noEvidenceReason,
          ),
        ],
        readingStopReason: DiagnosticStopReason.globalTimeout,
        clearActiveBlock: true,
      );
    } else if (state.stage == DiagnosticFlowStage.listeningBlock &&
        state.activeBlock != null) {
      final block = state.activeBlock!;
      final outcome = DiagnosticRouter.classifyBlockOutcome(
        questions: block.questions,
        selectedOptionIndices: <int?>[
          state.selectedOptionQ0,
          state.selectedOptionQ1,
        ],
      );
      state = state.copyWith(
        listeningHistory: <BlockAttemptRecord>[
          ...state.listeningHistory,
          BlockAttemptRecord(
            blockId: block.blockId,
            tier: block.tier,
            category: outcome.category,
            selectedOptionIndices: <int?>[
              state.selectedOptionQ0,
              state.selectedOptionQ1,
            ],
            correctCount: outcome.correctCount,
            noEvidenceReason: outcome.noEvidenceReason,
          ),
        ],
        listeningStopReason: DiagnosticStopReason.globalTimeout,
        clearActiveBlock: true,
      );
    }

    if (state.isSpeakingRecording) {
      final part = state.stage == DiagnosticFlowStage.speakingFollowUp ? 2 : 1;
      unawaited(
        stopSpeakingRecordingAndUpload(
          partIndex: part,
          autoSubmitAfter: true,
        ).then((_) {
          final nav = onAutoSubmitted;
          if (nav != null && state.diagId.isNotEmpty) {
            nav(state.diagId);
          }
        }),
      );
      return;
    }

    unawaited(
      submitAllAndGoResults().then((_) {
        final nav = onAutoSubmitted;
        if (nav != null && state.diagId.isNotEmpty) {
          nav(state.diagId);
        }
      }),
    );
  }

  void _handleStageTimeout() {
    switch (state.stage) {
      case DiagnosticFlowStage.readingExample:
        startLiveReadingBlocks();
      case DiagnosticFlowStage.readingBlock:
        final block = state.activeBlock;
        if (block != null) {
          final outcome = DiagnosticRouter.classifyBlockOutcome(
            questions: block.questions,
            selectedOptionIndices: <int?>[
              state.selectedOptionQ0,
              state.selectedOptionQ1,
            ],
          );
          state = state.copyWith(
            readingHistory: <BlockAttemptRecord>[
              ...state.readingHistory,
              BlockAttemptRecord(
                blockId: block.blockId,
                tier: block.tier,
                category: outcome.category,
                selectedOptionIndices: <int?>[
                  state.selectedOptionQ0,
                  state.selectedOptionQ1,
                ],
                correctCount: outcome.correctCount,
                noEvidenceReason: outcome.noEvidenceReason,
              ),
            ],
          );
        }
        _advanceFromReading(DiagnosticStopReason.stageTimeout);
      case DiagnosticFlowStage.listeningExample:
        startLiveListeningBlocks();
      case DiagnosticFlowStage.listeningBlock:
        final block = state.activeBlock;
        if (block != null) {
          final outcome = DiagnosticRouter.classifyBlockOutcome(
            questions: block.questions,
            selectedOptionIndices: <int?>[
              state.selectedOptionQ0,
              state.selectedOptionQ1,
            ],
          );
          state = state.copyWith(
            listeningHistory: <BlockAttemptRecord>[
              ...state.listeningHistory,
              BlockAttemptRecord(
                blockId: block.blockId,
                tier: block.tier,
                category: outcome.category,
                selectedOptionIndices: <int?>[
                  state.selectedOptionQ0,
                  state.selectedOptionQ1,
                ],
                correctCount: outcome.correctCount,
                noEvidenceReason: outcome.noEvidenceReason,
              ),
            ],
          );
        }
        _advanceFromListening(DiagnosticStopReason.stageTimeout);
      case DiagnosticFlowStage.writingBase:
      case DiagnosticFlowStage.writingFollowUp:
        unawaited(completeWritingStage());
      case DiagnosticFlowStage.speakingPrep:
        unawaited(startSpeakingRecording());
      case DiagnosticFlowStage.speakingRecording:
        unawaited(stopSpeakingRecordingAndUpload(partIndex: 1));
      case DiagnosticFlowStage.speakingFollowUp:
        if (state.isSpeakingRecording) {
          unawaited(
            stopSpeakingRecordingAndUpload(
              partIndex: 2,
              autoSubmitAfter: true,
            ),
          );
        } else {
          unawaited(submitAllAndGoResults());
        }
      case DiagnosticFlowStage.intro:
      case DiagnosticFlowStage.transitionToListening:
      case DiagnosticFlowStage.transitionToWriting:
      case DiagnosticFlowStage.transitionToSpeaking:
      case DiagnosticFlowStage.submitting:
      case DiagnosticFlowStage.results:
        break;
    }
  }

  void _startResultsPolling() {
    _resultsPollTimer?.cancel();
    final snap = state.sessionSnapshot;
    if (snap == null || !snap.hasPendingWork) return;
    _resultsPollTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      if (_disposed) return;
      final clock = ref.read(clockProvider);
      final resultsDeadline = state.resultsDeadlineUtcMs;
      final remaining = resultsDeadline != null
          ? DiagnosticBudget.remainingSeconds(
              deadlineUtcMs: resultsDeadline,
              clock: clock,
            )
          : 0;
      state = state.copyWith(resultsRemainingSeconds: remaining);
      unawaited(refreshResults());
      if (state.isTimed && remaining <= 0) {
        // After the 60s results window ends, stop fast polling; manual refresh & later Home check remain.
        _resultsPollTimer?.cancel();
      }
    });
  }

  Future<void> _persistLocalState() async {
    if (state.diagId.isEmpty) return;
    try {
      final repo = ref.read(attemptRepositoryProvider);
      final payload = <String, Object?>{
        'stage': state.stage.name,
        'writingAttemptId': state.writingAttemptId,
        'speakingAttemptId': state.speakingAttemptId,
        'readingHistory': state.readingHistory
            .map((e) => e.toJson())
            .toList(growable: false),
        'readingStopReason': ?state.readingStopReason?.wire,
        'readingSkipped': state.readingSkipped,
        'listeningHistory': state.listeningHistory
            .map((e) => e.toJson())
            .toList(growable: false),
        'listeningStopReason': ?state.listeningStopReason?.wire,
        'listeningSkipped': state.listeningSkipped,
        'writingBaseText': state.writingBaseText,
        'writingFollowUpText': state.writingFollowUpText,
        'writingFollowUpPrompt': ?state.writingFollowUpPrompt,
        'writingSkipped': state.writingSkipped,
        'speakingOptOut': state.speakingOptOut,
        'speakingSkipped': state.speakingSkipped,
        'snapshot': state.sessionSnapshot != null
            ? <String, Object?>{
                'diagId': state.sessionSnapshot!.diagId,
                'examId': state.sessionSnapshot!.examId,
                'mode': state.sessionSnapshot!.mode.wire,
                'policyVersion': state.sessionSnapshot!.policyVersion,
                'contentVersion': state.sessionSnapshot!.contentVersion,
                'status': state.sessionSnapshot!.status,
                'startedAt': state.sessionSnapshot!.startedAtIso,
                'collectionDeadlineAt':
                    state.sessionSnapshot!.collectionDeadlineAtIso,
                'resultsDeadlineAt':
                    state.sessionSnapshot!.resultsDeadlineAtIso,
                'resultRevision': state.sessionSnapshot!.resultRevision,
                'skills': <String, Object?>{
                  'reading': _outcomeToJson(state.sessionSnapshot!.reading),
                  'listening': _outcomeToJson(state.sessionSnapshot!.listening),
                  'writing': _outcomeToJson(state.sessionSnapshot!.writing),
                  'speaking': _outcomeToJson(state.sessionSnapshot!.speaking),
                },
                'recommendedFirstAction': <String, Object?>{
                  'title': state.sessionSnapshot!.recommendedActionTitle,
                  'description':
                      state.sessionSnapshot!.recommendedActionDescription,
                  'drillType': ?state.sessionSnapshot!.recommendedDrillType,
                  'targetSkill': ?state.sessionSnapshot!.recommendedTargetSkill,
                },
              }
            : null,
      };
      await repo.saveDiagnosticSession(
        diagId: state.diagId,
        examId: state.examId,
        mode: state.mode.wire,
        policyVersion:
            state.bank?.policyVersion ?? DiagnosticRouter.policyVersion,
        contentVersion: state.bank?.contentVersion ?? '2026-11-17.v1',
        selectionSeed: state.selectionSeed,
        startedAtUtcMs:
            state.startedAtUtcMs ??
            ref.read(clockProvider).now().toUtc().millisecondsSinceEpoch,
        collectionDeadlineUtcMs:
            state.collectionDeadlineUtcMs ??
            ref.read(clockProvider).now().toUtc().millisecondsSinceEpoch +
                DiagnosticBudget.collectionTotalSeconds * 1000,
        resultsDeadlineUtcMs:
            state.resultsDeadlineUtcMs ??
            ref.read(clockProvider).now().toUtc().millisecondsSinceEpoch +
                DiagnosticBudget.totalSessionSeconds * 1000,
        currentStage: state.stage.name,
        status: state.sessionSnapshot?.status ?? 'in_progress',
        stateJson: jsonEncode(payload),
      );
    } on Object {
      // Non-fatal in widget tests without Drift plugin.
    }
  }

  Map<String, Object?> _outcomeToJson(DiagnosticSkillOutcomeSnapshot o) =>
      <String, Object?>{
        'skill': o.skill,
        'status': o.status.wire,
        'suggestedPracticeLevel': ?o.suggestedPracticeLevel,
        'suggestedTier': ?o.suggestedTier?.code,
        'observations': o.observations,
        'weaknessFocus': ?o.weaknessFocus,
        'recommendedDrillType': ?o.recommendedDrillType,
        'jobId': ?o.jobId,
        'attemptId': ?o.attemptId,
        'errorCode': ?o.errorCode,
        'quotaRefunded': o.quotaRefunded,
        'reducedSampling': o.reducedSampling,
        'hasContradictoryEvidence': o.hasContradictoryEvidence,
        'stopReason': ?o.stopReason?.wire,
      };

  void _restoreFromRow(DiagnosticSessionRow row) {
    try {
      final decoded = jsonDecode(row.stateJson);
      if (decoded is! Map<String, dynamic>) return;
      final stageName = decoded['stage'] as String? ?? 'intro';
      final restoredStage = DiagnosticFlowStage.values.firstWhere(
        (s) => s.name == stageName,
        orElse: () => DiagnosticFlowStage.results,
      );
      final snapRaw = decoded['snapshot'];
      final snap = snapRaw is Map<String, Object?>
          ? DiagnosticSessionSnapshot.fromJson(snapRaw)
          : (snapRaw is Map
                ? DiagnosticSessionSnapshot.fromJson(
                    Map<String, Object?>.from(snapRaw),
                  )
                : null);

      state = state.copyWith(
        diagId: row.diagId,
        examId: row.examId,
        mode: DiagnosticMode.fromWire(row.mode),
        selectionSeed: row.selectionSeed,
        stage: restoredStage,
        startedAtUtcMs: row.startedAtUtcMs,
        collectionDeadlineUtcMs: row.collectionDeadlineUtcMs,
        resultsDeadlineUtcMs: row.resultsDeadlineUtcMs,
        writingAttemptId:
            decoded['writingAttemptId'] as String? ?? state.writingAttemptId,
        speakingAttemptId:
            decoded['speakingAttemptId'] as String? ?? state.speakingAttemptId,
        writingBaseText: decoded['writingBaseText'] as String? ?? '',
        writingFollowUpText: decoded['writingFollowUpText'] as String? ?? '',
        writingFollowUpPrompt: decoded['writingFollowUpPrompt'] as String?,
        writingSkipped: decoded['writingSkipped'] as bool? ?? false,
        speakingOptOut: decoded['speakingOptOut'] as bool? ?? false,
        speakingSkipped: decoded['speakingSkipped'] as bool? ?? false,
        sessionSnapshot: snap,
      );
    } on Object {
      // Ignore malformed cached JSON.
    }
  }

  Future<void> _stopMedia() async {
    unawaited(_ampSub?.cancel());
    unawaited(_playSub?.cancel());
    unawaited(_posSub?.cancel());
    _ampSub = null;
    _playSub = null;
    _posSub = null;
    try {
      await ref.read(audioPlayerGatewayProvider).pause();
    } on Object {
      // Ignore audio plugin errors during cleanup.
    }
    try {
      if (state.isSpeakingRecording) {
        await ref.read(audioRecorderGatewayProvider).stopRecording();
      }
    } on Object {
      // Ignore recorder cleanup errors.
    }
  }

  void _cancelTimers() {
    _tickTimer?.cancel();
    _transitionTimer?.cancel();
    _draftDebounceTimer?.cancel();
    _resultsPollTimer?.cancel();
    _preflightTimer?.cancel();
  }

  void _cleanupAll() {
    _disposed = true;
    _cancelTimers();
    unawaited(_ampSub?.cancel());
    unawaited(_playSub?.cancel());
    unawaited(_posSub?.cancel());
  }
}
