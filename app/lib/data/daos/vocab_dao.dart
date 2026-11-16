import 'package:drift/drift.dart';
import 'package:mockza/data/db/app_database.dart';
import 'package:mockza/data/db/tables/core_tables.dart';

part 'vocab_dao.g.dart';

/// Data access object for [VocabCards] SRS deck queries, reviews, and logs.
@DriftAccessor(tables: [VocabCards, VocabReviewLogs])
class VocabDao extends DatabaseAccessor<AppDatabase> with _$VocabDaoMixin {
  /// Creates a [VocabDao].
  new(super.attachedDatabase);

  /// Streams due vocabulary cards on or before [todaySerialDay].
  Stream<List<VocabCardRow>> watchDueCards(
    int todaySerialDay, {
    int limit = 200,
  }) =>
      (select(vocabCards)
            ..where((t) => t.dueDay.isSmallerOrEqualValue(todaySerialDay))
            ..orderBy([(t) => OrderingTerm.asc(t.dueDay)])
            ..limit(limit))
          .watch();

  /// Streams all cards currently in the deck.
  Stream<List<VocabCardRow>> watchAllCards({int limit = 1000}) =>
      (select(vocabCards)
            ..orderBy([(t) => OrderingTerm.asc(t.headword)])
            ..limit(limit))
          .watch();

  /// Streams cards ordered earliest-due first for "Review Ahead" practice.
  Stream<List<VocabCardRow>> watchAheadCards({int limit = 200}) =>
      (select(vocabCards)
            ..orderBy([(t) => OrderingTerm.asc(t.dueDay)])
            ..limit(limit))
          .watch();

  /// Fetches a snapshot of due vocabulary cards on or before [todaySerialDay].
  Future<List<VocabCardRow>> getDueCards(
    int todaySerialDay, {
    int limit = 200,
  }) =>
      (select(vocabCards)
            ..where((t) => t.dueDay.isSmallerOrEqualValue(todaySerialDay))
            ..orderBy([(t) => OrderingTerm.asc(t.dueDay)])
            ..limit(limit))
          .get();

  /// Fetches a snapshot of cards ordered earliest-due first for "Review Ahead".
  Future<List<VocabCardRow>> getAheadCards({int limit = 200}) =>
      (select(vocabCards)
            ..orderBy([(t) => OrderingTerm.asc(t.dueDay)])
            ..limit(limit))
          .get();

  /// Upserts synced deck cards while preserving any existing SM-2 user progress (`RR-20`).
  Future<void> upsertSyncedCardsPreservingSchedule(
    List<VocabCardsCompanion> cards,
  ) => batch((b) {
    for (final card in cards) {
      b.insert(
        vocabCards,
        card,
        onConflict: DoUpdate(
          (old) => VocabCardsCompanion(
            headword: card.headword,
            ipa: card.ipa,
            definition: card.definition,
            topicTag: card.topicTag,
            contextSentence: card.contextSentence,
            updatedAt: card.updatedAt,
          ),
        ),
      );
    }
  });

  /// Legacy alias preserving caller compatibility (`RR-20`).
  Future<void> insertMissingCardsBatch(List<VocabCardsCompanion> cards) =>
      upsertSyncedCardsPreservingSchedule(cards);

  /// Looks up a single card by its unique identifier.
  Future<VocabCardRow?> getCardById(String cardId) => (select(
    vocabCards,
  )..where((t) => t.cardId.equals(cardId))).getSingleOrNull();

  /// Inserts or updates a vocabulary card.
  Future<void> upsertCard(VocabCardsCompanion card) =>
      into(vocabCards).insertOnConflictUpdate(card);

  /// Updates SM-2 scheduling columns for [cardId].
  Future<void> updateSchedule({
    required String cardId,
    required int repetitions,
    required int intervalDays,
    required double easeFactor,
    required int dueDay,
    required DateTime updatedAt,
    int? easeFactorMilli,
    int? dueDaySerial,
  }) => (update(vocabCards)..where((t) => t.cardId.equals(cardId))).write(
    VocabCardsCompanion(
      repetitions: Value(repetitions),
      intervalDays: Value(intervalDays),
      easeFactor: Value(easeFactor),
      easeFactorMilli: Value(easeFactorMilli ?? (easeFactor * 1000).round()),
      dueDay: Value(dueDay),
      dueDaySerial: Value(dueDaySerial ?? dueDay),
      updatedAt: Value(updatedAt),
    ),
  );

  /// Records an SM-2 review event and appends an immutable [VocabReviewLogs] row in a transaction.
  Future<void> recordReviewTransaction({
    required String cardId,
    required int repetitions,
    required int intervalDays,
    required int easeFactorMilli,
    required double easeFactor,
    required int dueDay,
    required int reviewedDaySerial,
    required int rating,
    required DateTime now,
    required String logId,
  }) => transaction(() async {
    // 1. Update card state
    await updateSchedule(
      cardId: cardId,
      repetitions: repetitions,
      intervalDays: intervalDays,
      easeFactor: easeFactor,
      easeFactorMilli: easeFactorMilli,
      dueDay: dueDay,
      dueDaySerial: dueDay,
      updatedAt: now,
    );

    // 2. Append review log
    await into(vocabReviewLogs).insert(
      VocabReviewLogsCompanion.insert(
        logId: logId,
        cardId: cardId,
        rating: rating,
        reviewedDaySerial: reviewedDaySerial,
        reviewedAtUtcMs: now.millisecondsSinceEpoch,
      ),
    );
  });
}
