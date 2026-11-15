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
}
