import 'package:clock/clock.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/data/db/app_database.dart';
import 'package:test/test.dart';

import '../support/fakes.dart';

void main() {
  late AppDatabase db;
  late Clock clock;

  setUp(() async {
    db = createTestDatabase();
    clock = fixedTestClock();
  });

  tearDown(() async {
    await db.close();
  });

  group(
    'Drift Tier 2 SQLite: PRAGMA foreign_keys = ON and Cascade Deletes',
    () {
      test(
        'enforces PRAGMA foreign_keys = ON by rejecting orphaned child inserts',
        () async {
          final now = clock.now().toUtc();

          // Inserting AudioRecording for non-existent ExamAttempt must fail
          expect(
            () => db
                .into(db.audioRecordings)
                .insert(
                  AudioRecordingsCompanion.insert(
                    recordingId: 'rec-orphan-01',
                    attemptId: 'non-existent-attempt-uuid',
                    partIndex: 1,
                    localFilePath: '/tmp/part1.m4a',
                    durationMs: 45000,
                    createdAt: now,
                    updatedAt: now,
                  ),
                ),
            throwsA(isA<Exception>()),
          );
        },
      );

      test('cascades delete of child AudioRecordings when parent ExamAttempt is deleted', () async {
        final now = clock.now().toUtc();
        const attemptId = 'attempt-parent-uuid-001';

        // 1. Insert parent ExamAttempt
        await db
            .into(db.examAttempts)
            .insert(
              ExamAttemptsCompanion.insert(
                attemptId: attemptId,
                packId: 'ielts-speaking-seed-01',
                skill: SkillKind.speaking.name,
                status: AttemptStatus.inProgress.name,
                submissionJson: '{}',
                createdAt: now,
                updatedAt: now,
              ),
            );

        // 2. Insert 3 linked AudioRecordings
        for (var part = 1; part <= 3; part++) {
          await db
              .into(db.audioRecordings)
              .insert(
                AudioRecordingsCompanion.insert(
                  recordingId: 'rec-$attemptId-part-$part',
                  attemptId: attemptId,
                  partIndex: part,
                  localFilePath: '/tmp/part$part.m4a',
                  durationMs: 60000,
                  createdAt: now,
                  updatedAt: now,
                ),
              );
        }

        // Verify audio recordings exist
        final beforeDelete = await (db.select(
          db.audioRecordings,
        )..where((t) => t.attemptId.equals(attemptId))).get();
        expect(beforeDelete, hasLength(3));

        // 3. Delete parent ExamAttempt
        await (db.delete(
          db.examAttempts,
        )..where((t) => t.attemptId.equals(attemptId))).go();

        // 4. Verify child audio recordings were automatically deleted by SQLite CASCADE
        final afterDelete = await (db.select(
          db.audioRecordings,
        )..where((t) => t.attemptId.equals(attemptId))).get();
        expect(afterDelete, isEmpty);
      });
    },
  );
}
