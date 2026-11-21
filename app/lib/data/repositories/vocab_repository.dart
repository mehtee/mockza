import 'package:clock/clock.dart';
import 'package:drift/drift.dart';
import 'package:meta/meta.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/core/vocab/sm2_scheduler.dart';
import 'package:mockza/data/db/app_database.dart';

/// Domain representation of a vocabulary flashcard paired with SRS state.
@immutable
class VocabDeckCard {
  /// Creates a [VocabDeckCard].
  const new({
    required this.cardId,
    required this.headword,
    required this.ipa,
    required this.definition,
    required this.topicTag,
    required this.schedule,
    this.glossFa,
    this.contextSentence,
    this.usageNote,
    this.sourceSkill,
    this.sourceAttemptId,
  });

  /// Card primary identifier.
  final String cardId;

  /// Target English word or phrase.
  final String headword;

  /// Optional IPA string.
  final String? ipa;

  /// Definition + usage note.
  final String definition;

  /// Optional concise Persian meaning/gloss (`IRN` Sanjia edition).
  final String? glossFa;

  /// Topic grouping (`environment`, `work`, `health`, etc.).
  final String topicTag;

  /// Current SM-2 scheduling state.
  final SrsCardState schedule;

  /// High-band model context sentence.
  final String? contextSentence;

  /// Register / collocation usage guidance.
  final String? usageNote;

  /// Source skill where mistake was captured.
  final String? sourceSkill;

  /// Source attempt identifier.
  final String? sourceAttemptId;
}

/// Repository persisting SRS vocabulary cards and applying pure SM-2 transitions.
final class VocabRepository {
  /// Creates a [VocabRepository].
  const new({
    required this._db,
    required this._clock,
  });

  final AppDatabase _db;
  final Clock _clock;

  /// Streams due vocabulary cards for the current UTC [SerialDay].
  Stream<List<VocabDeckCard>> watchDueCards({int limit = 200}) {
    final today = SerialDay.fromUtcDateTime(_clock.now());
    return _db.vocabDao
        .watchDueCards(today.value, limit: limit)
        .map(
          (rows) => rows
              .map(
                (row) => VocabDeckCard(
                  cardId: row.cardId,
                  headword: row.headword,
                  ipa: row.ipa,
                  definition: row.definition,
                  glossFa: row.glossFa,
                  topicTag: row.topicTag,
                  contextSentence: row.contextSentence,
                  usageNote: row.usageNote,
                  sourceSkill: row.sourceSkill,
                  sourceAttemptId: row.sourceAttemptId,
                  schedule: SrsCardState(
                    repetitions: row.repetitions,
                    intervalDays: row.intervalDays,
                    easeFactorMilli: row.easeFactorMilli,
                    dueDay: SerialDay(row.dueDay),
                  ),
                ),
              )
              .toList(growable: false),
        );
  }

  /// Streams all cards currently in the vocabulary bank.
  Stream<List<VocabDeckCard>> watchAllCards({int limit = 1000}) =>
      _db.vocabDao.watchAllCards(limit: limit).map(_mapRowsToDeckCards);

  /// Streams earliest-due cards for "Review Ahead" practice regardless of today's due date.
  Stream<List<VocabDeckCard>> watchAheadCards({int limit = 200}) =>
      _db.vocabDao.watchAheadCards(limit: limit).map(_mapRowsToDeckCards);

  /// Fetches a one-shot snapshot of due vocabulary cards for the current UTC [SerialDay].
  Future<List<VocabDeckCard>> getDueCards({int limit = 200}) async {
    final today = SerialDay.fromUtcDateTime(_clock.now());
    final rows = await _db.vocabDao.getDueCards(today.value, limit: limit);
    return _mapRowsToDeckCards(rows);
  }

  /// Fetches a one-shot snapshot of earliest-due cards for "Review Ahead" practice.
  Future<List<VocabDeckCard>> getAheadCards({int limit = 200}) async {
    final rows = await _db.vocabDao.getAheadCards(limit: limit);
    return _mapRowsToDeckCards(rows);
  }

  List<VocabDeckCard> _mapRowsToDeckCards(List<VocabCardRow> rows) => rows
      .map(
        (row) => VocabDeckCard(
          cardId: row.cardId,
          headword: row.headword,
          ipa: row.ipa,
          definition: row.definition,
          glossFa: row.glossFa,
          topicTag: row.topicTag,
          contextSentence: row.contextSentence,
          usageNote: row.usageNote,
          sourceSkill: row.sourceSkill,
          sourceAttemptId: row.sourceAttemptId,
          schedule: SrsCardState(
            repetitions: row.repetitions,
            intervalDays: row.intervalDays,
            easeFactorMilli: row.easeFactorMilli,
            dueDay: SerialDay(row.dueDay),
          ),
        ),
      )
      .toList(growable: false);

  /// Inserts newly synced vocabulary deck cards from `/v1/vocab/deck` while keeping SM-2 state.
  Future<void> insertSyncedDeckCards(List<Map<String, dynamic>> rawCards) {
    final now = _clock.now().toUtc();
    final today = SerialDay.fromUtcDateTime(now);
    final companions = rawCards
        .map(
          (c) => VocabCardsCompanion.insert(
            cardId: ((c['cardId'] ?? c['wordId']) as String?) ?? '',
            headword: (c['headword'] as String?) ?? '',
            ipa: Value(c['ipa'] as String?),
            definition: (c['definition'] as String?) ?? '',
            glossFa: Value(c['glossFa'] as String?),
            topicTag: (c['topicTag'] as String?) ?? 'academic',
            contextSentence: Value(c['contextSentence'] as String?),
            easeFactorMilli: Value(
              (c['easeFactorMilli'] as num?)?.toInt() ?? 2500,
            ),
            dueDay: today.value,
            dueDaySerial: Value(today.value),
            createdAt: now,
            updatedAt: now,
          ),
        )
        .toList(growable: false);
    return _db.vocabDao.upsertSyncedCardsPreservingSchedule(companions);
  }

  /// Applies [quality] via [Sm2Scheduler] and persists the updated due date with review log.
  Future<SrsCardState> recordReview({
    required VocabDeckCard card,
    required ReviewQuality quality,
  }) async {
    final now = _clock.now().toUtc();
    final today = SerialDay.fromUtcDateTime(now);
    final next = Sm2Scheduler.schedule(
      current: card.schedule,
      quality: quality,
      today: today,
    );

    final logId = 'log-${card.cardId}-${now.millisecondsSinceEpoch}';
    await _db.vocabDao.recordReviewTransaction(
      cardId: card.cardId,
      repetitions: next.repetitions,
      intervalDays: next.intervalDays,
      easeFactorMilli: next.easeFactorMilli,
      easeFactor: next.easeFactor,
      dueDay: next.dueDay.value,
      reviewedDaySerial: today.value,
      rating: quality.sm2Grade,
      now: now,
      logId: logId,
    );
    return next;
  }

  /// 1-tap capture of an exam mistake or lexical upgrade directly into the active SRS review deck
  /// without clobbering existing SM-2 schedule progress if the card already exists (`TD-46`).
  Future<void> captureMistakeToDeck({
    required String cardId,
    required String headword,
    required String definition,
    required String topicTag,
    String? glossFa,
    String? ipa,
    String? contextSentence,
    String? usageNote,
    String? sourceSkill,
    String? sourceAttemptId,
    String? sourceRefLabel,
  }) async {
    final now = _clock.now().toUtc();
    final today = SerialDay.fromUtcDateTime(now);
    final existing = await _db.vocabDao.getCardById(cardId);

    await _db.vocabDao.upsertCard(
      VocabCardsCompanion.insert(
        cardId: cardId,
        headword: headword,
        ipa: Value(ipa ?? existing?.ipa),
        definition: definition,
        glossFa: Value(glossFa ?? existing?.glossFa),
        topicTag: topicTag,
        repetitions: Value(existing?.repetitions ?? 0),
        intervalDays: Value(existing?.intervalDays ?? 0),
        dueDay: existing?.dueDay ?? today.value,
        dueDaySerial: Value(existing?.dueDaySerial ?? today.value),
        easeFactorMilli: Value(existing?.easeFactorMilli ?? 2500),
        easeFactor: Value(existing?.easeFactor ?? 2.5),
        contextSentence: Value(contextSentence ?? existing?.contextSentence),
        usageNote: Value(usageNote ?? existing?.usageNote),
        sourceSkill: Value(sourceSkill ?? existing?.sourceSkill),
        sourceAttemptId: Value(sourceAttemptId ?? existing?.sourceAttemptId),
        sourceRefLabel: Value(sourceRefLabel ?? existing?.sourceRefLabel),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      ),
    );
  }

  /// Seeds a card into the deck if it does not yet exist, preserving SM-2 schedule if present (`TD-46`).
  Future<void> upsertSeedCard({
    required String cardId,
    required String headword,
    required String definition,
    required String topicTag,
    String? ipa,
    String? contextSentence,
  }) async {
    final now = _clock.now().toUtc();
    final today = SerialDay.fromUtcDateTime(now);
    final existing = await _db.vocabDao.getCardById(cardId);
    await _db.vocabDao.upsertCard(
      VocabCardsCompanion.insert(
        cardId: cardId,
        headword: headword,
        ipa: Value(ipa ?? existing?.ipa),
        definition: definition,
        topicTag: topicTag,
        contextSentence: Value(contextSentence ?? existing?.contextSentence),
        repetitions: Value(existing?.repetitions ?? 0),
        intervalDays: Value(existing?.intervalDays ?? 0),
        dueDay: existing?.dueDay ?? today.value,
        dueDaySerial: Value(existing?.dueDaySerial ?? today.value),
        easeFactorMilli: Value(existing?.easeFactorMilli ?? 2500),
        easeFactor: Value(existing?.easeFactor ?? 2.5),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      ),
    );
  }
}
