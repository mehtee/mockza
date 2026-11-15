import 'package:clock/clock.dart';
import 'package:drift/drift.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/data/db/app_database.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:test/test.dart';

import '../support/fakes.dart';

void main() {
  late AppDatabase db;
  late Clock clock;
  late AttemptRepository repository;

  setUp(() async {
    db = createTestDatabase();
    clock = fixedTestClock();
    repository = AttemptRepository(db: db, clock: clock);
  });

  tearDown(() async {
    await db.close();
  });

  group(
    'Drift Tier 2 SQLite: Keyset Cursor Pagination across 100+ attempts',
    () {
      test('fetches attempts ordered newest-first and supports keyset cursor pagination', () async {
        final baseTime = DateTime.utc(2026, 1, 1, 12);
        const totalAttempts = 120;

        // 1. Insert 120 synthetic attempts with monotonic sequential timestamps
        for (var i = 1; i <= totalAttempts; i++) {
          final timestamp = baseTime.add(Duration(minutes: i));
          final skill = switch (i % 4) {
            0 => SkillKind.speaking,
            1 => SkillKind.writing,
            2 => SkillKind.reading,
            _ => SkillKind.listening,
          };

          await db
              .into(db.examAttempts)
              .insert(
                ExamAttemptsCompanion.insert(
                  attemptId: 'attempt-${i.toString().padLeft(3, '0')}',
                  packId: 'pack-${(i % 5) + 1}',
                  skill: skill.name,
                  status: AttemptStatus.scored.name,
                  submissionJson: '{"index": $i}',
                  overallBand: Value(6.0 + (i % 7) * 0.5),
                  createdAt: timestamp,
                  updatedAt: timestamp,
                ),
              );
        }

        // 2. Stream recent attempts with default limit = 20
        final firstPage = await repository.watchRecentAttempts().first;
        expect(firstPage, hasLength(20));
        // First item must be the newest (i = 120)
        expect(firstPage.first.attemptId, 'attempt-120');
        expect(firstPage.last.attemptId, 'attempt-101');

        // 3. Test keyset cursor pagination query directly via database query:
        // Page 2: WHERE updatedAt < cursor ORDER BY updatedAt DESC LIMIT 20
        final cursor = firstPage.last.updatedAt;
        final secondPageRows =
            await (db.select(db.examAttempts)
                  ..where((t) => t.updatedAt.isSmallerThanValue(cursor))
                  ..orderBy([(t) => OrderingTerm.desc(t.updatedAt)])
                  ..limit(20))
                .get();

        expect(secondPageRows, hasLength(20));
        expect(secondPageRows.first.attemptId, 'attempt-100');
        expect(secondPageRows.last.attemptId, 'attempt-081');

        // Page 3:
        final cursor2 = secondPageRows.last.updatedAt;
        final thirdPageRows =
            await (db.select(db.examAttempts)
                  ..where((t) => t.updatedAt.isSmallerThanValue(cursor2))
                  ..orderBy([(t) => OrderingTerm.desc(t.updatedAt)])
                  ..limit(20))
                .get();

        expect(thirdPageRows, hasLength(20));
        expect(thirdPageRows.first.attemptId, 'attempt-080');
        expect(thirdPageRows.last.attemptId, 'attempt-061');

        // Total distinct collected across 3 pages = 60 with zero duplicates
        final collectedIds = <String>{
          ...firstPage.map((a) => a.attemptId),
          ...secondPageRows.map((r) => r.attemptId),
          ...thirdPageRows.map((r) => r.attemptId),
        };
        expect(collectedIds, hasLength(60));
      });
    },
  );
}
