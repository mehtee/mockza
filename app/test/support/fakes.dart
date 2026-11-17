import 'dart:async';

import 'package:clock/clock.dart';
import 'package:drift/drift.dart' show driftRuntimeOptions;
import 'package:drift/native.dart';
import 'package:mockza/core/models/speaking_evaluation.dart';
import 'package:mockza/core/models/user_profile.dart';
import 'package:mockza/core/models/writing_evaluation.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/data/db/app_database.dart';
import 'package:mockza/services/audio_player_gateway.dart';
import 'package:mockza/services/audio_recorder_gateway.dart';
import 'package:mockza/services/billing_gateway.dart';
import 'package:mockza/services/entropy_source.dart';
import 'package:mockza/services/grading_gateway.dart';
import 'package:mockza/services/secure_identity_service.dart';

/// Creates an isolated in-memory Drift [AppDatabase] for hermetic tests.
AppDatabase createTestDatabase() {
  driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
  return AppDatabase(NativeDatabase.memory());
}

/// Deterministic fixed wall clock defaulted to `2026-11-15T12:00:00Z`.
Clock fixedTestClock([DateTime? instant]) =>
    Clock.fixed(instant ?? DateTime.utc(2026, 11, 15, 12));

/// In-memory [SecureStorageGateway] substitute without OS keychain channels.
final class InMemorySecureStorageGateway implements SecureStorageGateway {
  final Map<String, String> _store = <String, String>{};

  @override
  Future<Result<void, Failure>> delete({required String key}) async {
    _store.remove(key);
    return const Ok(null);
  }

  @override
  Future<Result<String?, Failure>> read({required String key}) async =>
      Ok(_store[key]);

  @override
  Future<Result<void, Failure>> write({
    required String key,
    required String value,
  }) async {
    _store[key] = value;
    return const Ok(null);
  }
}

/// Deterministic UUID generator for unit and widget tests.
final class FixedEntropySource implements EntropySource {
  /// Creates a [FixedEntropySource] returning sequential deterministic UUIDs.
  new([this._seed = 1]);

  int _seed;

  @override
  String nextUuidV4() {
    final suffix = (_seed++).toString().padLeft(12, '0');
    return '00000000-0000-4000-8000-$suffix';
  }
}

/// Controllable [BillingGateway] fake without store SDK platform channels.
final class FakeBillingGateway implements BillingGateway {
  /// Creates a [FakeBillingGateway].
  const new({this.isPro = false, this.shouldFail = false});

  /// Entitlement response returned by queries.
  final bool isPro;

  /// Whether billing checks should simulate failures.
  final bool shouldFail;

  @override
  Future<Result<bool, Failure>> checkProEntitlement() async {
    if (shouldFail) {
      return const Err(NetworkFailure('Billing store unreachable'));
    }
    return Ok(isPro);
  }

  @override
  Future<Result<bool, Failure>> restorePurchases() async {
    if (shouldFail) {
      return const Err(NetworkFailure('Restore purchases failed'));
    }
    return Ok(isPro);
  }

  @override
  Future<Result<List<StorePackage>, Failure>> fetchOfferings() async {
    if (shouldFail) return const Err(NetworkFailure('Offerings failed'));
    return const Ok(defaultGlobalStorePackages);
  }

  @override
  Future<Result<bool, Failure>> purchasePackage(String packageId) async {
    if (shouldFail) return const Err(NetworkFailure('Purchase failed'));
    return const Ok(true);
  }
}

/// Controllable [GradingGateway] fake for testing online/offline AI grading and quota scenarios.
final class FakeGradingGateway implements GradingGateway {
  /// Creates a [FakeGradingGateway].
  new({
    this.enqueueResult,
    this.jobPollResult,
    this.writingPollResult,
    this.speakingPollResult,
    this.presignResult,
    this.uploadAudioResult,
    this.flagQuestionResult,
    this.retryResult,
  });

  /// Configurable enqueue outcome. Default returns a dummy jobId.
  Result<String, Failure>? enqueueResult;

  /// Configurable unified job polling outcome.
  Result<JobPollSnapshot, Failure>? jobPollResult;

  /// Configurable polling outcome for writing.
  Result<WritingEvaluationResult?, Failure>? writingPollResult;

  /// Configurable polling outcome for speaking.
  Result<SpeakingEvaluationResult?, Failure>? speakingPollResult;

  /// Configurable presigned upload URL outcome.
  Result<({String uploadUrl, String objectKey}), Failure>? presignResult;

  /// Configurable raw audio byte upload outcome.
  Result<void, Failure>? uploadAudioResult;

  /// Configurable question flagging outcome.
  Result<void, Failure>? flagQuestionResult;

  /// Configurable retry outcome.
  Result<String, Failure>? retryResult;

  /// Recorded retry calls for assertion.
  final List<String> retryCalls = <String>[];

  /// Recorded writing enqueue calls for assertion.
  final List<
    ({
      String attemptId,
      String packId,
      WritingTaskType taskType,
      String essayText,
    })
  >
  enqueueWritingCalls = [];

  /// Recorded speaking enqueue calls for assertion.
  final List<
    ({
      String attemptId,
      String packId,
      String audioObjectKey,
      int partIndex,
    })
  >
  enqueueSpeakingCalls = [];

  /// Recorded presign calls for assertion.
  final List<({String attemptId, int partIndex, int byteLength})> presignCalls =
      [];

  /// Recorded audio byte upload calls for assertion.
  final List<({String uploadUrl, int byteLength, String contentType})>
  uploadedAudioCalls = [];

  /// Recorded flagged questions for assertion.
  final List<({String packId, String questionId, String reason, String? note})>
  flaggedQuestionCalls = [];

  @override
  Future<Result<String, Failure>> enqueueWritingEvaluation({
    required String attemptId,
    required String packId,
    required WritingTaskType taskType,
    required String essayText,
    String examId = 'ielts_academic',
    String promptTitle = '',
    String promptBody = '',
    int? durationSeconds,
    int? wordCount,
  }) async {
    enqueueWritingCalls.add((
      attemptId: attemptId,
      packId: packId,
      taskType: taskType,
      essayText: essayText,
    ));
    return enqueueResult ?? const Ok('test-job-uuid-1234');
  }

  @override
  Future<Result<JobPollSnapshot, Failure>> pollJobStatus({
    required String jobId,
  }) async {
    return jobPollResult ??
        Ok(
          JobPollSnapshot(
            jobId: jobId,
            attemptId: 'att-001',
            status: 'queued',
            stage: 'Queued for AI evaluation',
          ),
        );
  }

  @override
  Future<Result<WritingEvaluationResult?, Failure>> pollWritingResult({
    required String jobId,
  }) async {
    return writingPollResult ?? const Ok(null);
  }

  @override
  Future<Result<({String uploadUrl, String objectKey}), Failure>>
  presignAudioUpload({
    required String attemptId,
    required int partIndex,
    required int byteLength,
    String? turnId,
    String contentType = 'audio/mp4',
  }) async {
    presignCalls.add((
      attemptId: attemptId,
      partIndex: partIndex,
      byteLength: byteLength,
    ));
    final suffix = (turnId != null && turnId.isNotEmpty) ? '-$turnId' : '';
    return presignResult ??
        Ok((
          uploadUrl:
              '/v1/media/upload-proxy/users/test/clips/test/part-$partIndex$suffix.m4a',
          objectKey: 'users/test/clips/test/part-$partIndex$suffix.m4a',
        ));
  }

  @override
  Future<Result<void, Failure>> uploadAudioBytes({
    required String uploadUrl,
    required List<int> bytes,
    required String contentType,
  }) async {
    uploadedAudioCalls.add((
      uploadUrl: uploadUrl,
      byteLength: bytes.length,
      contentType: contentType,
    ));
    return uploadAudioResult ?? const Ok(null);
  }

  @override
  Future<Result<SpeakingEvaluationResult?, Failure>> pollSpeakingResult({
    required String jobId,
  }) async {
    return speakingPollResult ?? const Ok(null);
  }

  @override
  Future<Result<String, Failure>> enqueueSpeakingEvaluation({
    required String attemptId,
    required String packId,
    required String audioObjectKey,
    required int partIndex,
    String examId = 'ielts_academic',
    String partSequence = 'full',
    List<
      ({
        int partIndex,
        String promptText,
        String objectKey,
        int? durationMs,
      })
    >?
    turns,
  }) async {
    enqueueSpeakingCalls.add((
      attemptId: attemptId,
      packId: packId,
      audioObjectKey: audioObjectKey,
      partIndex: partIndex,
    ));
    return enqueueResult ?? const Ok('test-speaking-job-1234');
  }

  @override
  Future<Result<String, Failure>> retryEvaluation({
    required String attemptId,
  }) async {
    retryCalls.add(attemptId);
    return retryResult ?? const Ok('retried-job-uuid-9999');
  }

  @override
  Future<Result<String, Failure>> explainQuestion({
    required String questionId,
    required String learnerAnswer,
    required String correctAnswer,
    required String passageContext,
    String packId = '',
    String packVersion = '1.0.0',
    String skill = 'reading',
    String questionType = 'short_answer',
  }) async {
    return const Ok(
      'The correct answer is derived from paragraph 3 which directly states...',
    );
  }

  @override
  Future<Result<QuotaSnapshot, Failure>> fetchQuotaStatus() async {
    return const Ok(
      QuotaSnapshot(
        speakingRemaining: 3,
        writingRemaining: 3,
        isPro: false,
      ),
    );
  }

  @override
  Future<Result<void, Failure>> flagQuestion({
    required String packId,
    required String questionId,
    required String reason,
    String? note,
  }) async {
    flaggedQuestionCalls.add((
      packId: packId,
      questionId: questionId,
      reason: reason,
      note: note,
    ));
    return flagQuestionResult ?? const Ok(null);
  }
}

/// Controllable [AudioRecorderGateway] fake simulating audio capture and dBFS levels.
final class FakeAudioRecorderGateway implements AudioRecorderGateway {
  bool _isRecording = false;
  final StreamController<double> _amplitudeController =
      StreamController<double>.broadcast();

  /// Path returned on stopRecording.
  String recordedFilePath = '/tmp/test_recording.m4a';

  /// Permission status returned by hasPermission.
  bool permissionGranted = true;

  /// Whether next call should fail.
  Failure? failure;

  /// Whether recording is currently active.
  bool get isRecording => _isRecording;

  @override
  String get activeContentType => 'audio/mp4';

  /// Emits a simulated dBFS level (`-60.0` to `0.0`) to listeners.
  void emitAmplitude(double dbFs) {
    if (!_amplitudeController.isClosed) {
      _amplitudeController.add(dbFs);
    }
  }

  @override
  Future<Result<bool, Failure>> hasPermission({bool request = true}) async {
    if (failure != null) return Err(failure!);
    return Ok(permissionGranted);
  }

  @override
  Future<Result<void, Failure>> startRecording({
    required String outputPath,
  }) async {
    if (failure != null) return Err(failure!);
    _isRecording = true;
    recordedFilePath = outputPath;
    return const Ok(null);
  }

  @override
  Future<Result<String?, Failure>> stopRecording() async {
    if (failure != null) return Err(failure!);
    _isRecording = false;
    return Ok(recordedFilePath);
  }

  @override
  Stream<double> watchAmplitude() => _amplitudeController.stream;

  @override
  Future<void> dispose() async {
    _isRecording = false;
    await _amplitudeController.close();
  }
}

/// Controllable [AudioPlayerGateway] fake simulating audio playback.
final class FakeAudioPlayerGateway implements AudioPlayerGateway {
  /// Currently loaded audio file or URL.
  String? currentFilePath;

  /// Whether playback is currently active.
  bool isPlaying = false;

  /// Active playback speed multiplier.
  double speed = 1;

  /// Simulated total clip duration.
  Duration currentDuration = const Duration(seconds: 120);

  /// Configurable failure for testing error paths.
  Failure? failure;

  /// Optional failure affecting only [play] (while [loadFile] succeeds),
  /// useful for simulating browser autoplay gating (`NotAllowedError`).
  Failure? playFailure;

  @override
  Future<Result<Duration?, Failure>> loadFile(String filePath) async {
    if (failure != null) return Err(failure!);
    currentFilePath = filePath;
    return Ok(currentDuration);
  }

  @override
  Future<Result<void, Failure>> play() async {
    if (failure != null) return Err(failure!);
    if (playFailure != null) return Err(playFailure!);
    isPlaying = true;
    return const Ok(null);
  }

  @override
  Future<Result<void, Failure>> pause() async {
    if (failure != null) return Err(failure!);
    isPlaying = false;
    return const Ok(null);
  }

  @override
  Future<Result<void, Failure>> setSpeed(double newSpeed) async {
    if (failure != null) return Err(failure!);
    speed = newSpeed;
    return const Ok(null);
  }

  AudioPlaybackMode _playbackMode = AudioPlaybackMode.studyInteractive;

  @override
  AudioPlaybackMode get playbackMode => _playbackMode;

  @override
  void setPlaybackMode(AudioPlaybackMode mode) {
    _playbackMode = mode;
  }

  @override
  Future<Result<void, Failure>> seek(Duration position) async {
    if (failure != null) return Err(failure!);
    if (_playbackMode == AudioPlaybackMode.examLinearLocked) {
      return const Err(ValidationFailure('Scrubbing locked'));
    }
    return const Ok(null);
  }

  @override
  Stream<Duration> watchPosition() => const Stream.empty();

  @override
  Stream<Duration?> watchDuration() => Stream.value(currentDuration);

  @override
  Stream<bool> watchIsPlaying() => Stream.value(isPlaying);

  @override
  Future<void> dispose() async {
    isPlaying = false;
  }
}
