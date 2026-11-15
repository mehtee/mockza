import 'package:clock/clock.dart';
import 'package:drift/drift.dart';
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

  group('Drift Tier 2 SQLite: OutboxSyncQueue ordering and backoff', () {
    test('enqueues outbox sync operations and dequeues in strict chronological order', () async {
      final now = clock.now().toUtc();

      // Enqueue 3 operations with different nextAttemptAt timestamps
      await db
          .into(db.outboxSyncQueue)
          .insert(
            OutboxSyncQueueCompanion.insert(
              actionType: 'evaluate_writing',
              payloadJson: '{"attemptId":"att-02"}',
              nextAttemptAt: now.add(const Duration(seconds: 30)),
              createdAt: now,
              updatedAt: now,
            ),
          );

      await db
          .into(db.outboxSyncQueue)
          .insert(
            OutboxSyncQueueCompanion.insert(
              actionType: 'evaluate_speaking',
              payloadJson: '{"attemptId":"att-01"}',
              nextAttemptAt: now.add(const Duration(seconds: 5)), // Earliest
              createdAt: now,
              updatedAt: now,
            ),
          );

      await db
          .into(db.outboxSyncQueue)
          .insert(
            OutboxSyncQueueCompanion.insert(
              actionType: 'sync_log',
              payloadJson: '{"logId":"log-01"}',
              nextAttemptAt: now.add(const Duration(minutes: 5)),
              createdAt: now,
              updatedAt: now,
            ),
          );

      // Dequeue ready items where nextAttemptAt <= now + 10s
      final readyCutoff = now.add(const Duration(seconds: 10));
      final readyItems =
          await (db.select(db.outboxSyncQueue)
                ..where(
                  (t) => t.nextAttemptAt.isSmallerOrEqualValue(readyCutoff),
                )
                ..orderBy([
                  (t) => OrderingTerm.asc(t.nextAttemptAt),
                  (t) => OrderingTerm.asc(t.id),
                ]))
              .get();

      expect(readyItems, hasLength(1));
      expect(readyItems.single.actionType, 'evaluate_speaking');
      expect(readyItems.single.retryCount, 0);

      // Simulate failure on evaluate_speaking -> increment retryCount and schedule exponential backoff
      final failedItem = readyItems.single;
      final nextRetryCount = failedItem.retryCount + 1;
      // Exponential backoff: 2^retryCount * 5 seconds
      final backoffSeconds = (1 << nextRetryCount) * 5;
      final nextRetryAt = now.add(Duration(seconds: backoffSeconds));

      await (db.update(
        db.outboxSyncQueue,
      )..where((t) => t.id.equals(failedItem.id))).write(
        OutboxSyncQueueCompanion(
          retryCount: Value(nextRetryCount),
          nextAttemptAt: Value(nextRetryAt),
          updatedAt: Value(now),
        ),
      );

      final updated = await (db.select(
        db.outboxSyncQueue,
      )..where((t) => t.id.equals(failedItem.id))).getSingle();

      expect(updated.retryCount, 1);
      expect(updated.nextAttemptAt.toUtc(), nextRetryAt);

      // Simulate success on writing item -> remove from queue
      await (db.delete(
        db.outboxSyncQueue,
      )..where((t) => t.actionType.equals('evaluate_writing'))).go();

      final remaining = await db.select(db.outboxSyncQueue).get();
      expect(remaining, hasLength(2));
      expect(
        remaining.map((r) => r.actionType),
        isNot(contains('evaluate_writing')),
      );
    });
  });
}
