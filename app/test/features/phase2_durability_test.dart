import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:clock/clock.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
import 'package:mockza/features/listening_sim/presentation/listening_sim_providers.dart';
import 'package:mockza/features/speaking_sim/presentation/speaking_sim_providers.dart';
import 'package:mockza/features/writing_sim/presentation/writing_sim_providers.dart';
import 'package:mockza/providers.dart';
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
    test(
      'TD-37: CountdownClockTracker uses elapsed wall time across pause/resume',
      () {
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
      },
    );

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
            'essayText':
                'Sample writing text exceeding minimum word count length.',
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
      final rec1Rows = await attemptRepo.getRecordingsForAttempt(
        'att-multi-01',
      );
      expect(
        rec1Rows.firstWhere((r) => r.recordingId == 'r1').remoteObjectKey,
        isNotNull,
      );
    });

    test('RR-01: closing speakingSimNotifierProvider stops active recorder and player on disposal', () async {
      final db = createTestDatabase();
      addTearDown(db.close);
      final recorder = FakeAudioRecorderGateway();
      final player = FakeAudioPlayerGateway();
      final container = ProviderContainer(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          audioRecorderGatewayProvider.overrideWithValue(recorder),
          audioPlayerGatewayProvider.overrideWithValue(player),
        ],
      );
      addTearDown(container.dispose);

      final sub = container.listen(speakingSimNotifierProvider, (_, _) {});
      await recorder.startRecording(outputPath: '/tmp/rr01_speaking.m4a');
      await player.play();
      expect(recorder.isRecording, isTrue);
      expect(player.isPlaying, isTrue);

      sub.close();
      await container.pump();

      expect(recorder.isRecording, isFalse);
      expect(player.isPlaying, isFalse);
    });

    test('RR-01: closing listeningSimNotifierProvider stops active playback on disposal', () async {
      final db = createTestDatabase();
      addTearDown(db.close);
      final player = FakeAudioPlayerGateway();
      final container = ProviderContainer(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          audioPlayerGatewayProvider.overrideWithValue(player),
        ],
      );
      addTearDown(container.dispose);

      final sub = container.listen(listeningSimNotifierProvider, (_, _) {});
      await player.play();
      expect(player.isPlaying, isTrue);

      sub.close();
      await container.pump();

      expect(player.isPlaying, isFalse);
    });

    test('RR-08: Writing autosave captures immutable task snapshot across task switch and never resurrects deleted submitted draft', () async {
      final db = createTestDatabase();
      addTearDown(db.close);
      final catalogRepo = ExamCatalogRepository(
        db: db,
        clock: Clock.fixed(DateTime.utc(2026, 11, 16)),
      );
      await catalogRepo.saveExamPayload(
        packId: 'w-pack-rr08',
        bundle: {
          'pack': {
            'packId': 'w-pack-rr08',
            'skill': 'writing',
            'title': 'Writing Pack',
            'description': 'Two tasks',
            'version': '1.0.0',
          },
          'sections': [
            {
              'sectionId': 't1',
              'sectionIndex': 1,
              'sectionType': 'task1Academic',
              'title': 'Task 1',
              'contentText': 'Describe chart',
              'durationSeconds': 1200,
              'wordCount': 150,
            },
            {
              'sectionId': 't2',
              'sectionIndex': 2,
              'sectionType': 'task2Essay',
              'title': 'Task 2',
              'contentText': 'Write essay',
              'durationSeconds': 2400,
              'wordCount': 250,
            },
          ],
          'questions': <dynamic>[],
        },
      );

      final firstSaveStarted = Completer<void>();
      final firstSaveRelease = Completer<void>();
      final heldRepo = _DelayedDraftAttemptRepository(
        db: db,
        clock: Clock.fixed(DateTime.utc(2026, 11, 16)),
        onFirstSaveDraft: () {
          if (!firstSaveStarted.isCompleted) {
            firstSaveStarted.complete();
          }
          return firstSaveRelease.future;
        },
      );

      final container = ProviderContainer(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          attemptRepositoryProvider.overrideWithValue(heldRepo),
          gradingGatewayProvider.overrideWithValue(FakeGradingGateway()),
          secureStorageGatewayProvider.overrideWithValue(
            InMemorySecureStorageGateway(),
          ),
        ],
      );
      addTearDown(container.dispose);

      final sub = container.listen(writingSimNotifierProvider, (_, _) {});
      addTearDown(sub.close);

      final notifier = container.read(writingSimNotifierProvider.notifier);
      await notifier.initialize(
        'w-pack-rr08',
        mockSessionId: 'mock-rr08',
        mockStageKey: 'writing_task1',
      );

      notifier.updateDraft('Task one first write');
      final inFlightFirst = notifier.flushAutosaveNow();
      await firstSaveStarted.future;

      // Switch to Task 2 while Task 1 write #1 is still in flight; flush queues Task 1 snapshot.
      notifier
        ..updateDraft('Task one latest before switch')
        ..selectTaskIndex(1)
        ..updateDraft('Task two essay body with sufficient content');

      firstSaveRelease.complete();
      await inFlightFirst;
      // Drain the queued Task 1 outgoing save and flush Task 2 too.
      await Future<void>.delayed(Duration.zero);
      await notifier.flushAutosaveNow();

      final draft1 = await heldRepo.getWritingDraft('draft-w-pack-rr08-t1');
      final draft2 = await heldRepo.getWritingDraft('draft-w-pack-rr08-t2');
      expect(draft1?.draftText, 'Task one latest before switch');
      expect(draft2?.draftText, 'Task two essay body with sufficient content');

      // Now verify submit during an in-flight save never resurrects Task 2 draft.
      final submitGateStarted = Completer<void>();
      final submitGateRelease = Completer<void>();
      heldRepo.nextSaveGate = () {
        if (!submitGateStarted.isCompleted) submitGateStarted.complete();
        return submitGateRelease.future;
      };
      final queuedBeforeSubmit = notifier.flushAutosaveNow();
      await submitGateStarted.future;
      final submitFuture = notifier.submitWriting();
      notifier
        ..selectTaskIndex(0)
        ..updateDraft('An edit while the submission is awaiting storage');
      final saveDuringSubmit = notifier.flushAutosaveNow();
      submitGateRelease.complete();
      await queuedBeforeSubmit;
      final attemptId = await submitFuture;
      await saveDuringSubmit;

      expect(attemptId, isNotNull);
      expect(await heldRepo.getWritingDraft('draft-w-pack-rr08-t2'), isNull);
      final submitted = await heldRepo.getAttemptRow(attemptId!);
      final submittedPayload =
          jsonDecode(submitted!.submissionJson) as Map<String, dynamic>;
      expect(submittedPayload['taskType'], 'task2Essay');
      expect(
        submittedPayload['essayText'],
        'Task two essay body with sufficient content',
      );
      expect(submitted.mockStageKey, 'writing_task2');
      await notifier.flushAutosaveNow();
      expect(await heldRepo.getWritingDraft('draft-w-pack-rr08-t2'), isNull);
    });

    test('RR-07: SpeakingSimNotifier restores pre-submit session turns and notes from durable inProgress storage', () async {
      final tmpDir = Directory.systemTemp.createTempSync('mockza_rr07_');
      addTearDown(() => tmpDir.deleteSync(recursive: true));
      final db = createTestDatabase();
      addTearDown(db.close);
      final clipFile = File('${tmpDir.path}/turn1.m4a')
        ..writeAsBytesSync([1, 2, 3, 4]);
      final clock = Clock.fixed(DateTime.utc(2026, 11, 16));
      final catalogRepo = ExamCatalogRepository(db: db, clock: clock);
      await catalogRepo.saveExamPayload(
        packId: 'sp-pack-rr07',
        bundle: {
          'pack': {
            'packId': 'sp-pack-rr07',
            'skill': 'speaking',
            'title': 'Restored Speaking Pack',
            'description': '2 turns',
            'version': '1.0.0',
          },
          'sections': [
            {
              'sectionId': 'p1',
              'sectionIndex': 1,
              'sectionType': 'speaking_part1',
              'title': 'Part 1',
              'durationSeconds': 120,
            },
          ],
          'questions': [
            {
              'questionId': 'q1',
              'sectionId': 'p1',
              'questionNumber': 1,
              'questionType': 'speaking_part1',
              'prompt': 'First prompt',
            },
            {
              'questionId': 'q2',
              'sectionId': 'p1',
              'questionNumber': 2,
              'questionType': 'speaking_part1',
              'prompt': 'Second prompt',
            },
          ],
        },
      );

      final attemptRepo = AttemptRepository(db: db, clock: clock);
      await attemptRepo.savePendingSpeakingSession(
        sessionId: 'sess-restore-01',
        packId: 'sp-pack-rr07',
        isExamMode: true,
        sessionJson: jsonEncode({
          'packId': 'sp-pack-rr07',
          'sessionTitle': 'Restored Speaking Pack',
          'isExamMode': true,
          'currentTurnIndex': 1,
          'cueCardNotes': 'Solar microgrids note',
          'turns': [
            {
              'partIndex': 1,
              'promptId': 'q1',
              'promptText': 'First prompt',
              'localPathOrUrl': clipFile.path,
              'durationMs': 4200,
              'contentType': 'audio/mp4',
            },
          ],
        }),
        recordings: [
          (
            recordingId: 'sess-restore-01_q1',
            partIndex: 1,
            localFilePath: clipFile.path,
            durationMs: 4200,
          ),
        ],
      );

      final laterRepo = AttemptRepository(
        db: db,
        clock: Clock.fixed(DateTime.utc(2026, 11, 17)),
      );
      await laterRepo.savePendingSpeakingSession(
        sessionId: 'unrelated-mock-session',
        packId: 'sp-pack-rr07',
        isExamMode: true,
        mockSessionId: 'another-mock',
        mockStageKey: 'speaking',
        sessionJson: '{}',
      );
      expect(
        (await attemptRepo.findLatestPendingSpeakingSession(
          'sp-pack-rr07',
          isExamMode: true,
        ))?.attemptId,
        'sess-restore-01',
      );
      expect(
        (await attemptRepo.findLatestPendingSpeakingSession(
          'sp-pack-rr07',
          isExamMode: true,
          mockSessionId: 'another-mock',
        ))?.attemptId,
        'unrelated-mock-session',
      );

      final container = ProviderContainer(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          audioRecorderGatewayProvider.overrideWithValue(
            FakeAudioRecorderGateway()..permissionGranted = false,
          ),
          gradingGatewayProvider.overrideWithValue(FakeGradingGateway()),
          secureStorageGatewayProvider.overrideWithValue(
            InMemorySecureStorageGateway(),
          ),
          audioPlayerGatewayProvider.overrideWithValue(
            FakeAudioPlayerGateway(),
          ),
        ],
      );
      addTearDown(container.dispose);

      final sub = container.listen(speakingSimNotifierProvider, (_, _) {});
      addTearDown(sub.close);

      await container
          .read(speakingSimNotifierProvider.notifier)
          .initialize('sp-pack-rr07');

      final restoredState = container.read(speakingSimNotifierProvider);
      expect(restoredState.sessionId, 'sess-restore-01');
      expect(restoredState.cueCardNotes, 'Solar microgrids note');
      expect(restoredState.recordedTurns.keys, contains('q1'));
      expect(restoredState.currentTurnIndex, 1);

      final notifier = container.read(speakingSimNotifierProvider.notifier);
      final firstSubmission = notifier.submitSession();
      final repeatedSubmission = await notifier.submitSession();
      expect(repeatedSubmission, isNull);
      final submittedId = await firstSubmission;
      expect(submittedId, 'sess-restore-01');
      final recordings = await attemptRepo.getRecordingsForAttempt(
        submittedId!,
      );
      expect(
        recordings,
        hasLength(1),
        reason:
            'Submitting a restored turn must update its existing recording row',
      );
      expect(recordings.single.remoteObjectKey, isNotNull);
    });
  });
}

class _DelayedDraftAttemptRepository extends AttemptRepository {
  new({
    required super.db,
    required super.clock,
    required this.onFirstSaveDraft,
  });

  final Future<void> Function() onFirstSaveDraft;
  Future<void> Function()? nextSaveGate;
  bool _usedFirst = false;

  @override
  Future<void> saveWritingDraft({
    required String attemptId,
    required String packId,
    required String taskType,
    required String draftText,
    required int wordCount,
    required int timerRemainingSec,
  }) async {
    if (!_usedFirst) {
      _usedFirst = true;
      await onFirstSaveDraft();
    } else if (nextSaveGate != null) {
      final gate = nextSaveGate!;
      nextSaveGate = null;
      await gate();
    }
    await super.saveWritingDraft(
      attemptId: attemptId,
      packId: packId,
      taskType: taskType,
      draftText: draftText,
      wordCount: wordCount,
      timerRemainingSec: timerRemainingSec,
    );
  }
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
    List<
      ({int partIndex, String promptText, String objectKey, int? durationMs})
    >?
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
