import 'dart:async';

import 'package:clock/clock.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/models/speaking_evaluation.dart';
import 'package:mockza/core/models/user_profile.dart';
import 'package:mockza/core/models/writing_evaluation.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/features/evaluation_review/presentation/evaluation_review_providers.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/services/grading_gateway.dart';
import 'package:test/test.dart';

import '../support/fakes.dart';

void main() {
  group('Phase 3: Review Retry & Stale Poll Isolation (TD-16, TD-17)', () {
    test(
      'TD-17: delayed poll response for Attempt A does not overwrite newly loaded Attempt B',
      () async {
        final db = createTestDatabase();
        addTearDown(db.close);
        final clock = Clock.fixed(DateTime.utc(2026, 11, 16, 12));
        final attemptRepo = AttemptRepository(db: db, clock: clock);

        await attemptRepo.saveLocalSubmission(
          attemptId: 'att-A',
          packId: 'w-01',
          skill: SkillKind.writing,
          status: AttemptStatus.queuedRemote,
          submissionJson: '{"essayText":"Essay A"}',
        );
        await attemptRepo.updateAttemptEvaluation(
          attemptId: 'att-A',
          status: AttemptStatus.queuedRemote,
          remoteJobId: 'job-A',
        );

        await attemptRepo.saveLocalSubmission(
          attemptId: 'att-B',
          packId: 'w-01',
          skill: SkillKind.writing,
          status: AttemptStatus.queuedRemote,
          submissionJson: '{"essayText":"Essay B"}',
        );
        await attemptRepo.updateAttemptEvaluation(
          attemptId: 'att-B',
          status: AttemptStatus.queuedRemote,
          remoteJobId: 'job-B',
        );

        final delayedA = Completer<Result<JobPollSnapshot, Failure>>();
        final gateway = _ControlledPollGateway(
          inner: FakeGradingGateway(),
          onPoll: (jobId) {
            if (jobId == 'job-A') return delayedA.future;
            return Future.value(
              const Ok(
                JobPollSnapshot(
                  jobId: 'job-B',
                  attemptId: 'att-B',
                  status: 'queued',
                  stage: 'Still processing B',
                ),
              ),
            );
          },
        );

        final container = ProviderContainer(
          overrides: [
            appDatabaseProvider.overrideWithValue(db),
            clockProvider.overrideWithValue(clock),
            gradingGatewayProvider.overrideWithValue(gateway),
          ],
        );
        addTearDown(container.dispose);
        final sub = container.listen(
          evaluationReviewNotifierProvider,
          (_, _) {},
        );
        addTearDown(sub.close);

        final notifier = container.read(evaluationReviewNotifierProvider.notifier);
        await notifier.loadAttempt('att-A');
        await notifier.loadAttempt('att-B');

        // Now resolve slow Attempt A poll as completed Band 8.5
        delayedA.complete(
          const Ok(
            JobPollSnapshot(
              jobId: 'job-A',
              attemptId: 'att-A',
              status: 'completed',
              rawResultJson: <String, Object?>{
                'attemptId': 'att-A',
                'overallBand': 8.5,
                'criteria': <String, Object?>{'TR': 8.5, 'CC': 8.5, 'LR': 8.5, 'GRA': 8.5},
              },
            ),
          ),
        );
        await Future<void>.delayed(const Duration(milliseconds: 20));

        final state = container.read(evaluationReviewNotifierProvider);
        expect(state.attemptId, 'att-B');
        expect(state.overallBand, isNull);

        final rowB = await attemptRepo.getAttemptRow('att-B');
        expect(rowB?.status, AttemptStatus.queuedRemote.name);
        expect(rowB?.overallBand, isNull);
      },
    );

    test(
      'TD-16: retryEvaluation invokes backend /v1/evaluate/retry on failed remote attempt',
      () async {
        final db = createTestDatabase();
        addTearDown(db.close);
        final clock = Clock.fixed(DateTime.utc(2026, 11, 16, 12));
        final attemptRepo = AttemptRepository(db: db, clock: clock);

        await attemptRepo.saveLocalSubmission(
          attemptId: 'att-failed-01',
          packId: 'w-01',
          skill: SkillKind.writing,
          status: AttemptStatus.failedRetryable,
          submissionJson: '{"essayText":"Retryable essay"}',
        );
        await attemptRepo.updateAttemptEvaluation(
          attemptId: 'att-failed-01',
          status: AttemptStatus.failedRetryable,
          remoteJobId: 'job-dead-1',
          errorCode: 'upstream_rate_limited',
        );

        final fakeGateway = FakeGradingGateway(
          retryResult: const Ok('job-retried-2'),
          jobPollResult: const Ok(
            JobPollSnapshot(
              jobId: 'job-retried-2',
              attemptId: 'att-failed-01',
              status: 'queued',
              stage: 'Retry queued',
            ),
          ),
        );

        final container = ProviderContainer(
          overrides: [
            appDatabaseProvider.overrideWithValue(db),
            clockProvider.overrideWithValue(clock),
            gradingGatewayProvider.overrideWithValue(fakeGateway),
            secureStorageGatewayProvider.overrideWithValue(
              InMemorySecureStorageGateway(),
            ),
          ],
        );
        addTearDown(container.dispose);
        final sub = container.listen(
          evaluationReviewNotifierProvider,
          (_, _) {},
        );
        addTearDown(sub.close);

        final notifier = container.read(evaluationReviewNotifierProvider.notifier);
        await notifier.loadAttempt('att-failed-01');
        await notifier.retryEvaluation();

        expect(fakeGateway.retryCalls, ['att-failed-01']);
        final updatedRow = await attemptRepo.getAttemptRow('att-failed-01');
        expect(updatedRow?.status, AttemptStatus.queuedRemote.name);
        expect(updatedRow?.remoteJobId, 'job-retried-2');
      },
    );
  });
}

class _ControlledPollGateway implements GradingGateway {
  new({required this.inner, required this.onPoll});
  final FakeGradingGateway inner;
  final Future<Result<JobPollSnapshot, Failure>> Function(String jobId) onPoll;

  @override
  Future<Result<JobPollSnapshot, Failure>> pollJobStatus({
    required String jobId,
  }) => onPoll(jobId);

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
  Future<Result<String, Failure>> retryEvaluation({
    required String attemptId,
  }) => inner.retryEvaluation(attemptId: attemptId);

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
  Future<Result<void, Failure>> uploadAudioBytes({
    required String uploadUrl,
    required List<int> bytes,
    required String contentType,
  }) => inner.uploadAudioBytes(
    uploadUrl: uploadUrl,
    bytes: bytes,
    contentType: contentType,
  );
}
