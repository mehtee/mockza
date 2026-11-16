import 'package:clock/clock.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/core/vocab/sm2_scheduler.dart';
import 'package:mockza/data/db/app_database.dart';
import 'package:mockza/data/repositories/vocab_repository.dart';
import 'package:test/test.dart';

import '../support/fakes.dart';

void main() {
  late AppDatabase db;
  late Clock clock;
  late VocabRepository repository;

  setUp(() {
    db = createTestDatabase();
    clock = fixedTestClock();
    repository = VocabRepository(db: db, clock: clock);
  });

  tearDown(() async {
    await db.close();
  });

  test('seeds due vocab card and reschedules interval on review', () async {
    await repository.upsertSeedCard(
      cardId: 'c1',
      headword: 'ubiquitous',
      definition: 'present everywhere simultaneously',
      topicTag: 'technology',
      ipa: '/juːˈbɪk.wɪ.təs/',
    );

    final due = await repository.watchDueCards().first;
    expect(due, hasLength(1));
    expect(due.single.headword, 'ubiquitous');

    final next = await repository.recordReview(
      card: due.single,
      quality: ReviewQuality.good,
    );
    expect(next.repetitions, 1);
    expect(next.intervalDays, 1);
    expect(
      next.dueDay,
      SerialDay.fromUtcDateTime(clock.now()).addDays(1),
    );
  });

  test('RR-20: sync updates definition and metadata while preserving SM-2 schedule', () async {
    await repository.insertSyncedDeckCards([
      <String, dynamic>{
        'cardId': 'sync-c1',
        'headword': 'mitigate',
        'ipa': '/ˈmɪt.ɪ.ɡeɪt/',
        'definition': 'old definition',
        'topicTag': 'environment',
        'contextSentence': 'Old sentence.',
      },
    ]);

    final due = await repository.watchDueCards().first;
    expect(due, hasLength(1));
    final reviewed = await repository.recordReview(
      card: due.single,
      quality: ReviewQuality.easy,
    );
    expect(reviewed.repetitions, 1);
    expect(reviewed.intervalDays, greaterThan(0));

    // Re-sync from server with updated definition, IPA, topicTag, and contextSentence.
    await repository.insertSyncedDeckCards([
      <String, dynamic>{
        'cardId': 'sync-c1',
        'headword': 'mitigate',
        'ipa': '/ˈmɪt.ɪ.ɡeɪt/',
        'definition': 'make less severe or harmful',
        'topicTag': 'policy',
        'contextSentence': 'Targeted subsidies can mitigate energy costs.',
      },
    ]);

    final updated = await db.vocabDao.getCardById('sync-c1');
    expect(updated, isNotNull);
    expect(updated!.definition, 'make less severe or harmful');
    expect(updated.topicTag, 'policy');
    expect(
      updated.contextSentence,
      'Targeted subsidies can mitigate energy costs.',
    );
    // Schedule progress preserved!
    expect(updated.repetitions, reviewed.repetitions);
    expect(updated.intervalDays, reviewed.intervalDays);
    expect(updated.easeFactorMilli, reviewed.easeFactorMilli);
    expect(updated.dueDay, reviewed.dueDay.value);
  });
}
