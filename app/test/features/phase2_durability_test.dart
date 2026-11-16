import 'dart:convert';
import 'dart:io';

import 'package:clock/clock.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/exams/countdown_clock_tracker.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/models/speaking_evaluation.dart';
import 'package:mockza/core/models/user_profile.dart';
import 'package:mockza/core/models/writing_evaluation.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/data/repositories/exam_catalog_repository.dart';
import 'package:mockza/services/auth_session_service.dart';
import 'package:mockza/services/cache_cleanup_service.dart';
import 'package:mockza/services/crash_log.dart';
import 'package:mockza/services/grading_gateway.dart';
import 'package:mockza/services/outbox_sync_service.dart';
import 'package:mockza/services/secure_identity_service.dart';
import 'package:test/test.dart';

import '../support/fakes.dart';

void main() {
  group('Phase 2: Durability, Timers, Pending Media & Outbox Tests', () {
    test('TD-37: CountdownClockTracker uses elapsed wall time across pause/resume', () {
      var currentTime = DateTime.utc(2026, 11, 16, 12);
      final clock = Clock(() => currentTime);
      final tracker = CountdownClockTracker(clock: clock)
        ..start(remainingSeconds: 120);
      currentTime = currentTime.add(const Duration(seconds: 45));
      expect(tracker.currentRemaining(), 75);

      expect(tracker.pause(), 75);
      currentTime = currentTime.add(const Duration(seconds: 300));
      expect(tracker.currentRemaining(), 75);

      tracker.resume();
      currentTime = currentTime.add(const Duration(seconds: 80));
      expect(tracker.currentRemaining(), 0);
      expect(tracker.isExpired, isTrue);
    });

    test('TD-18 & TD-40: CacheCleanupService protects pending recordings from Clear Cache', () async {
      final db = createTestDatabase();
      addTearDown(db.close);
      final now = DateTime.utc(2026, 11, 16, 12);
      final clock = Clock.fixed(now);
      final attemptRepo = AttemptRepository(db: db, clock: clock);
      final catalogRepo = ExamCatalogRepository(db: db, clock: clock);
      final cleanup = CacheCleanupService(
        catalogRepository: catalogRepo,
        attemptRepository: attemptRepo,
      );

      final tmpDir = await Directory.systemTemp.createTemp('mockza_p2_');
      addTearDown(() => tmpDir.delete(recursive: true));
      final audioFile = File('${tmpDir.path}/turn1.m4a');
      await audioFile.writeAsBytes([1, 2, 3, 4]);

      await attemptRepo.saveDurableSubmissionWithOutbox(
        attemptId: 'att-pending-01',
        packId: 'spk-01',
        skill: SkillKind.speaking,
        submissionJson: '{}',
        actionType: 'submit_speaking',
        outboxPayloadJson: '{"attemptId":"att-pending-01","turns":[]}',
        recordings: [
          (
            recordingId: 'rec-pending-01',
            partIndex: 1,
            localFilePath: audioFile.path,
            durationMs: 2000,
            remoteObjectKey: null,
          ),
        ],
      );

      await cleanup.clearDownloadedCaches();

      expect(audioFile.existsSync(), isTrue);
      final rows = await attemptRepo.getRecordingsForAttempt('att-pending-01');
      expect(rows, hasLength(1));
    });

    test('TD-19, TD-42, TD-43: Outbox drains >10 items and prevents partial speaking submits', () async {
      final db = createTestDatabase();
      addTearDown(db.close);
      final now = DateTime.utc(2026, 11, 16, 12);
      final clock = Clock.fixed(now);
      final attemptRepo = AttemptRepository(db: db, clock: clock);
      final gateway = FakeGradingGateway();
      final identity = SecureIdentityService(
        storage: InMemorySecureStorageGateway(),
        entropy: FixedEntropySource(),
      );
      final authSession = AuthSessionService(
        config: EditionConfig.globalDefault,
        identity: identity,
        clock: clock,
        crashLog: const DeveloperCrashLog(AppEdition.global),
      );
      final outbox = OutboxSyncService(
        attemptRepository: attemptRepo,
        gradingGateway: gateway,
        authSession: authSession,
        crashLog: const DeveloperCrashLog(AppEdition.global),
        clock: clock,
      );
      addTearDown(outbox.dispose);

      // Enqueue 12 writing items and verify all 12 drain in one processPendingQueue call.
      for (var i = 0; i < 12; i++) {
        final attId = 'att-batch-$i';
        await attemptRepo.saveDurableSubmissionWithOutbox(
          attemptId: attId,
          packId: 'w-01',
          skill: SkillKind.writing,
          submissionJson: '{}',
          actionType: 'submit_writing',
          outboxPayloadJson: jsonEncode({
            'attemptId': attId,
            'packId': 'w-01',
            'taskType': 'task2Essay',
            'essayText': 'Sample writing text exceeding minimum word count length.',
          }),
        );
      }

      final drained = await outbox.processPendingQueue();
      expect(drained, 12);
      expect(gateway.enqueueWritingCalls, hasLength(12));
      expect(await attemptRepo.countOutboxItems(), 0);

      // Now test partial failure on a 2-turn Speaking session:
      final tmpDir = await Directory.systemTemp.createTemp('mockza_spk_');
      addTearDown(() => tmpDir.delete(recursive: true));
      final clip1 = File('${tmpDir.path}/clip1.m4a');
      final clip2 = File('${tmpDir.path}/clip2.m4a');
      await clip1.writeAsBytes([10, 20, 30]);
      await clip2.writeAsBytes([40, 50, 60]);

      // Upload 1 succeeds, Upload 2 fails transiently.
      var putCount = 0;
      final partialInner = FakeGradingGateway();
      final partialGateway = _PartialUploadGateway(
        inner: partialInner,
        onUpload: () {
          putCount++;
          return putCount == 1
              ? const Ok(null)
              : const Err(NetworkFailure('Simulated mid-session upload drop'));
        },
      );
      final outboxPartial = OutboxSyncService(
        attemptRepository: attemptRepo,
        gradingGateway: partialGateway,
        authSession: authSession,
        crashLog: const DeveloperCrashLog(AppEdition.global),
        clock: clock,
      );
      addTearDown(outboxPartial.dispose);

      await attemptRepo.saveDurableSubmissionWithOutbox(
        attemptId: 'att-multi-01',
        packId: 'spk-01',
        skill: SkillKind.speaking,
        submissionJson: '{}',
        actionType: 'submit_speaking',
        outboxPayloadJson: jsonEncode({
          'attemptId': 'att-multi-01',
          'packId': 'spk-01',
          'partSequence': 'full',
          'turns': [
            {
              'recordingId': 'r1',
              'turnId': 'q1',
              'partIndex': 1,
              'promptText': 'Q1',
              'localFilePath': clip1.path,
              'contentType': 'audio/mp4',
            },
            {
              'recordingId': 'r2',
              'turnId': 'q2',
              'partIndex': 2,
              'promptText': 'Q2',
              'localFilePath': clip2.path,
              'contentType': 'audio/mp4',
            },
          ],
        }),
        recordings: [
          (
            recordingId: 'r1',
            partIndex: 1,
            localFilePath: clip1.path,
            durationMs: 1000,
            remoteObjectKey: null,
          ),
          (
            recordingId: 'r2',
            partIndex: 2,
            localFilePath: clip2.path,
            durationMs: 1000,
            remoteObjectKey: null,
          ),
        ],
      );

      final resCount = await outboxPartial.processPendingQueue();
      expect(resCount, 0);
      // Enqueue was NEVER called with partial turn 1 only.
      expect(partialInner.enqueueSpeakingCalls, isEmpty);
      // Outbox item retained with checkpointed objectKey on turn 1.
      final remaining = await attemptRepo.countOutboxItems();
      expect(remaining, 1);
      final rec1Rows = await attemptRepo.getRecordingsForAttempt('att-multi-01');
      expect(rec1Rows.firstWhere((r) => r.recordingId == 'r1').remoteObjectKey, isNotNull);
    });
  });
}

class _PartialUploadGateway implements GradingGateway {
  new({required this.inner, required this.onUpload});
  final FakeGradingGateway inner;
  final Result<void, Failure> Function() onUpload;

  @override
  Future<Result<String, Failure>> enqueueSpeakingEvaluation({
    required String attemptId,
    required String packId,
    required String audioObjectKey,
    required int partIndex,
    String examId = 'ielts_academic',
    String partSequence = 'full',
    List<({int partIndex, String promptText, String objectKey, int? durationMs})>?
    turns,
  }) => inner.enqueueSpeakingEvaluation(
    attemptId: attemptId,
    packId: packId,
    audioObjectKey: audioObjectKey,
    partIndex: partIndex,
    examId: examId,
    partSequence: partSequence,
    turns: turns,
  );

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
  }) => inner.enqueueWritingEvaluation(
    attemptId: attemptId,
    packId: packId,
    taskType: taskType,
    essayText: essayText,
    examId: examId,
    promptTitle: promptTitle,
    promptBody: promptBody,
    durationSeconds: durationSeconds,
    wordCount: wordCount,
  );

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
  }) => inner.explainQuestion(
    questionId: questionId,
    learnerAnswer: learnerAnswer,
    correctAnswer: correctAnswer,
    passageContext: passageContext,
    packId: packId,
    packVersion: packVersion,
    skill: skill,
    questionType: questionType,
  );

  @override
  Future<Result<QuotaSnapshot, Failure>> fetchQuotaStatus() =>
      inner.fetchQuotaStatus();

  @override
  Future<Result<void, Failure>> flagQuestion({
    required String packId,
    required String questionId,
    required String reason,
    String? note,
  }) => inner.flagQuestion(
    packId: packId,
    questionId: questionId,
    reason: reason,
    note: note,
  );

  @override
  Future<Result<JobPollSnapshot, Failure>> pollJobStatus({
    required String jobId,
  }) => inner.pollJobStatus(jobId: jobId);

  @override
  Future<Result<SpeakingEvaluationResult?, Failure>> pollSpeakingResult({
    required String jobId,
  }) => inner.pollSpeakingResult(jobId: jobId);

  @override
  Future<Result<WritingEvaluationResult?, Failure>> pollWritingResult({
    required String jobId,
  }) => inner.pollWritingResult(jobId: jobId);

  @override
  Future<Result<({String uploadUrl, String objectKey}), Failure>>
  presignAudioUpload({
    required String attemptId,
    required int partIndex,
    required int byteLength,
    String? turnId,
    String contentType = 'audio/mp4',
  }) => inner.presignAudioUpload(
    attemptId: attemptId,
    partIndex: partIndex,
    byteLength: byteLength,
    turnId: turnId,
    contentType: contentType,
  );

  @override
  Future<Result<String, Failure>> retryEvaluation({
    required String attemptId,
  }) => inner.retryEvaluation(attemptId: attemptId);

  @override
  Future<Result<void, Failure>> uploadAudioBytes({
    required String uploadUrl,
    required List<int> bytes,
    required String contentType,
  }) async => onUpload();
}
