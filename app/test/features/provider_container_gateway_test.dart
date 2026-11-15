import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/models/writing_evaluation.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/core/vocab/sm2_scheduler.dart';
import 'package:mockza/features/paywall/presentation/paywall_providers.dart';
import 'package:mockza/features/progress/presentation/progress_providers.dart';
import 'package:mockza/features/vocabulary/presentation/vocabulary_providers.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/services/grading_gateway.dart';
import 'package:test/test.dart';

import '../support/fakes.dart';

void main() {
  group('Tier 3: ProviderContainer & Fake Gateway Integration Suite', () {
    test(
      'FakeGradingGateway processes normal enqueue, job polling, and audio upload',
      () async {
        final fakeGrading = FakeGradingGateway(
          jobPollResult: const Ok(
            JobPollSnapshot(
              jobId: 'test-job-uuid-1234',
              attemptId: 'att-001',
              status: 'completed',
              stage: 'Evaluation complete',
              rawResultJson: <String, Object?>{
                'overallBand': 7.5,
                'criteria': <String, Object?>{
                  'taskAchievement': 7.5,
                  'coherenceAndCohesion': 7.5,
                  'lexicalResource': 7.5,
                  'grammaticalRangeAndAccuracy': 7.5,
                },
                'summaryFeedback': 'Well structured essay.',
              },
            ),
          ),
        );
        final container = ProviderContainer(
          overrides: [
            gradingGatewayProvider.overrideWithValue(fakeGrading),
          ],
        );
        addTearDown(container.dispose);

        final gateway = container.read(gradingGatewayProvider);
        final result = await gateway.enqueueWritingEvaluation(
          attemptId: 'att-001',
          packId: 'ielts-writing-seed-01',
          taskType: WritingTaskType.task2Essay,
          essayText: 'This is a test essay evaluating technological progress and environmental resilience.',
        );

        expect(result.isOk, isTrue);
        expect(result.valueOrNull, 'test-job-uuid-1234');
        expect(fakeGrading.enqueueWritingCalls, hasLength(1));
        expect(fakeGrading.enqueueWritingCalls.single.attemptId, 'att-001');

        final pollRes = await gateway.pollJobStatus(
          jobId: 'test-job-uuid-1234',
        );
        expect(pollRes.isOk, isTrue);
        expect(pollRes.valueOrNull?.status, 'completed');
        expect(pollRes.valueOrNull?.asWritingResult()?.overallBand, 7.5);

        final presignRes = await gateway.presignAudioUpload(
          attemptId: 'att-spk-01',
          partIndex: 1,
          byteLength: 1024,
        );
        expect(presignRes.isOk, isTrue);
        expect(
          presignRes.valueOrNull?.uploadUrl,
          startsWith('/v1/media/upload-proxy/'),
        );

        final uploadRes = await gateway.uploadAudioBytes(
          uploadUrl: presignRes.valueOrNull!.uploadUrl,
          bytes: <int>[1, 2, 3, 4],
          contentType: 'audio/mp4',
        );
        expect(uploadRes.isOk, isTrue);
        expect(fakeGrading.uploadedAudioCalls, hasLength(1));
      },
    );

    test(
      'FakeGradingGateway handles offline transport failure (NetworkFailure)',
      () async {
        final fakeGrading = FakeGradingGateway(
          enqueueResult: const Err(NetworkFailure('Server unreachable')),
        );
        final container = ProviderContainer(
          overrides: [
            gradingGatewayProvider.overrideWithValue(fakeGrading),
          ],
        );
        addTearDown(container.dispose);

        final gateway = container.read(gradingGatewayProvider);
        final result = await gateway.enqueueWritingEvaluation(
          attemptId: 'att-offline',
          packId: 'ielts-writing-seed-01',
          taskType: WritingTaskType.task2Essay,
          essayText:
              'Offline submission attempt when device lacks connectivity.',
        );

        expect(result.isErr, isTrue);
        final failure = (result as Err<String, Failure>).failure;
        expect(failure, isA<NetworkFailure>());
        expect(failure.code, 'network_error');
      },
    );

    test(
      'FakeGradingGateway handles QuotaExceededFailure (429 status code)',
      () async {
        final fakeGrading = FakeGradingGateway(
          enqueueResult: const Err(
            QuotaExceededFailure(
              'Daily evaluation quota reached',
              retryAfterSeconds: 3600,
            ),
          ),
        );
        final container = ProviderContainer(
          overrides: [
            gradingGatewayProvider.overrideWithValue(fakeGrading),
          ],
        );
        addTearDown(container.dispose);

        final gateway = container.read(gradingGatewayProvider);
        final result = await gateway.enqueueWritingEvaluation(
          attemptId: 'att-quota',
          packId: 'ielts-writing-seed-01',
          taskType: WritingTaskType.task2Essay,
          essayText: 'Submission attempting to exceed daily quota limit.',
        );

        expect(result.isErr, isTrue);
        final failure =
            (result as Err<String, Failure>).failure as QuotaExceededFailure;
        expect(failure.code, 'quota_exceeded');
        expect(failure.retryAfterSeconds, 3600);
      },
    );

    test(
      'FakeBillingGateway & PaywallNotifier persist Pro entitlement into SQLite profile',
      () async {
        final db = createTestDatabase();
        addTearDown(db.close);

        final container = ProviderContainer(
          overrides: [
            appDatabaseProvider.overrideWithValue(db),
            clockProvider.overrideWithValue(fixedTestClock()),
            entropySourceProvider.overrideWithValue(FixedEntropySource()),
            secureStorageGatewayProvider.overrideWithValue(
              InMemorySecureStorageGateway(),
            ),
            billingGatewayProvider.overrideWithValue(
              const FakeBillingGateway(isPro: true),
            ),
          ],
        );
        addTearDown(container.dispose);

        final identity = container.read(secureIdentityServiceProvider);
        final devId =
            (await identity.getOrCreateDeviceId()).valueOrNull ?? 'dev-001';
        final profileRepo = container.read(profileRepositoryProvider);
        await profileRepo.loadOrInitializePrimary(fallbackDeviceId: devId);

        final paywall = container.read(paywallNotifierProvider.notifier);
        await paywall.purchaseSelected();

        final state = container.read(paywallNotifierProvider);
        expect(state.isPro, isTrue);

        final updatedProfile = await profileRepo.loadOrInitializePrimary(
          fallbackDeviceId: devId,
        );
        expect(updatedProfile.isPro, isTrue);
      },
    );

    test(
      'OutboxSyncService processes submit_writing and flag_question outbox items',
      () async {
        final db = createTestDatabase();
        addTearDown(db.close);
        final fakeGrading = FakeGradingGateway();

        final container = ProviderContainer(
          overrides: [
            appDatabaseProvider.overrideWithValue(db),
            clockProvider.overrideWithValue(fixedTestClock()),
            entropySourceProvider.overrideWithValue(FixedEntropySource()),
            secureStorageGatewayProvider.overrideWithValue(
              InMemorySecureStorageGateway(),
            ),
            gradingGatewayProvider.overrideWithValue(fakeGrading),
          ],
        );
        addTearDown(container.dispose);

        final attemptRepo = container.read(attemptRepositoryProvider);
        await attemptRepo.saveLocalSubmission(
          attemptId: 'att-write-outbox-1',
          packId: 'ielts-writing-seed-01',
          skill: SkillKind.writing,
          status: AttemptStatus.inProgress,
          submissionJson: jsonEncode(<String, Object?>{
            'taskType': 'task2Essay',
            'essayText': 'Queued essay text waiting for sync.',
          }),
        );

        await attemptRepo.enqueueOutboxAction(
          actionType: 'submit_writing',
          payloadJson: jsonEncode(<String, Object?>{
            'attemptId': 'att-write-outbox-1',
            'packId': 'ielts-writing-seed-01',
            'taskType': 'task2Essay',
            'essayText': 'Queued essay text waiting for sync.',
          }),
        );

        await attemptRepo.enqueueOutboxAction(
          actionType: 'flag_question',
          payloadJson: jsonEncode(<String, Object?>{
            'packId': 'ielts-acad-reading-seed-01',
            'questionId': 'q-01',
            'reason': 'typo',
            'note': 'Minor spelling issue in option B',
          }),
        );

        final processed = await container
            .read(outboxSyncServiceProvider)
            .processPendingQueue();
        expect(processed, 2);
        expect(fakeGrading.enqueueWritingCalls, hasLength(1));
        expect(fakeGrading.flaggedQuestionCalls, hasLength(1));

        final row = await attemptRepo.getAttemptRow('att-write-outbox-1');
        expect(row?.status, AttemptStatus.queuedRemote.name);
        expect(row?.remoteJobId, 'test-job-uuid-1234');
      },
    );

    test(
      'VocabularyNotifier freezes sessionCards so rating does not skip every second card',
      () async {
        final db = createTestDatabase();
        addTearDown(db.close);

        final container = ProviderContainer(
          overrides: [
            appDatabaseProvider.overrideWithValue(db),
            clockProvider.overrideWithValue(fixedTestClock()),
          ],
        );
        addTearDown(container.dispose);

        final vocabRepo = container.read(vocabRepositoryProvider);
        await vocabRepo.insertSyncedDeckCards(<Map<String, Object?>>[
          <String, Object?>{
            'cardId': 'vocab-01',
            'headword': 'Mitigate',
            'ipa': '/ˈmɪt.ɪ.ɡeɪt/',
            'definition': 'Make less severe or painful.',
            'topicTag': 'academic',
            'contextSentence': 'Policies can mitigate environmental damage.',
          },
          <String, Object?>{
            'cardId': 'vocab-02',
            'headword': 'Proliferate',
            'ipa': '/prəˈlɪf.ər.eɪt/',
            'definition': 'Increase rapidly in numbers.',
            'topicTag': 'academic',
            'contextSentence': 'Renewable microgrids continue to proliferate.',
          },
          <String, Object?>{
            'cardId': 'vocab-03',
            'headword': 'Corroborate',
            'ipa': '/kəˈrɒb.ə.reɪt/',
            'definition': 'Confirm or give support to a statement.',
            'topicTag': 'academic',
            'contextSentence': 'Empirical findings corroborate the hypothesis.',
          },
        ]);

        final dueCards = await vocabRepo.getDueCards();
        expect(dueCards, hasLength(3));

        final notifier = container.read(vocabularyNotifierProvider.notifier);
        await notifier.loadSession(reviewAhead: false);

        var state = container.read(vocabularyNotifierProvider);
        expect(state.sessionCards, hasLength(3));
        expect(state.activeCardIndex, 0);
        expect(state.sessionCards[state.activeCardIndex].cardId, 'vocab-01');

        await notifier.rateCard(
          card: state.sessionCards[0],
          quality: ReviewQuality.good,
        );

        state = container.read(vocabularyNotifierProvider);
        expect(state.activeCardIndex, 1);
        expect(state.reviewedCount, 1);
        // Must advance to vocab-02 (index 1 of frozen sessionCards), never skipping to vocab-03!
        expect(state.sessionCards[state.activeCardIndex].cardId, 'vocab-02');
      },
    );

    test(
      'FakeAudioRecorderGateway captures audio turns and emits dBFS amplitude stream',
      () async {
        final fakeRecorder = FakeAudioRecorderGateway();
        final container = ProviderContainer(
          overrides: [
            audioRecorderGatewayProvider.overrideWithValue(fakeRecorder),
          ],
        );
        addTearDown(container.dispose);

        final recorder = container.read(audioRecorderGatewayProvider);
        final perm = await recorder.hasPermission();
        expect(perm.isOk, isTrue);
        expect(perm.valueOrNull, isTrue);

        final capturedLevels = <double>[];
        final sub = recorder.watchAmplitude().listen(capturedLevels.add);
        addTearDown(sub.cancel);

        final start = await recorder.startRecording(
          outputPath: '/tmp/attempt_turn_1.m4a',
        );
        expect(start.isOk, isTrue);
        expect(fakeRecorder.isRecording, isTrue);

        fakeRecorder.emitAmplitude(-18.5);
        await Future<void>.delayed(Duration.zero);
        expect(capturedLevels, contains(-18.5));

        final stop = await recorder.stopRecording();
        expect(stop.isOk, isTrue);
        expect(stop.valueOrNull, '/tmp/attempt_turn_1.m4a');
        expect(fakeRecorder.isRecording, isFalse);
      },
    );

    test(
      'FakeAudioPlayerGateway loads file, tracks playback state and speed adjustment',
      () async {
        final fakePlayer = FakeAudioPlayerGateway();
        final container = ProviderContainer(
          overrides: [
            audioPlayerGatewayProvider.overrideWithValue(fakePlayer),
          ],
        );
        addTearDown(container.dispose);

        final player = container.read(audioPlayerGatewayProvider);
        final load = await player.loadFile(
          '/v1/media/media/listening/listening_s01.m4a',
        );
        expect(load.isOk, isTrue);
        expect(load.valueOrNull, const Duration(seconds: 120));

        await player.play();
        expect(fakePlayer.isPlaying, isTrue);

        await player.setSpeed(1.15);
        expect(fakePlayer.speed, 1.15);

        await player.pause();
        expect(fakePlayer.isPlaying, isFalse);
      },
    );

    test(
      'TimeframeNotifier and ProgressNotifier default to honest empty state when zero attempts exist',
      () {
        final db = createTestDatabase();
        addTearDown(db.close);
        final container = ProviderContainer(
          overrides: [
            appDatabaseProvider.overrideWithValue(db),
            clockProvider.overrideWithValue(fixedTestClock()),
          ],
        );
        addTearDown(container.dispose);

        expect(container.read(timeframeProvider), '30D');
        container.read(timeframeProvider.notifier).setTimeframe('7D');
        expect(container.read(timeframeProvider), '7D');

        final progress = container.read(progressNotifierProvider);
        expect(progress.overallBand, isNull);
      },
    );
  });
}
