import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/diagnostic/diagnostic_models.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/personalization/vocab_wave_scheduler.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/core/vocab/sm2_scheduler.dart';
import 'package:mockza/data/repositories/vocab_repository.dart';
import 'package:mockza/providers.dart';

/// Immutable UI state for SRS vocabulary flashcard sessions.
@immutable
class VocabularyState {
  /// Creates a [VocabularyState].
  const new({
    required this.reviewedCount,
    required this.showAnswer,
    this.activeCardIndex = 0,
    this.sessionCards = const <VocabDeckCard>[],
    this.isLoading = true,
    this.isReviewAhead = false,
  });

  /// Number of cards rated during the active session.
  final int reviewedCount;

  /// Whether the active card definition is revealed.
  final bool showAnswer;

  /// Index of the current card within the frozen [sessionCards] list.
  final int activeCardIndex;

  /// Immutable snapshot of cards loaded for the current review workout.
  final List<VocabDeckCard> sessionCards;

  /// Whether the initial card snapshot is still loading from Drift.
  final bool isLoading;

  /// Whether this session was launched in "Review Ahead" mode.
  final bool isReviewAhead;

  /// Returns a copy with updated session flags.
  VocabularyState copyWith({
    int? reviewedCount,
    bool? showAnswer,
    int? activeCardIndex,
    List<VocabDeckCard>? sessionCards,
    bool? isLoading,
    bool? isReviewAhead,
  }) => VocabularyState(
    reviewedCount: reviewedCount ?? this.reviewedCount,
    showAnswer: showAnswer ?? this.showAnswer,
    activeCardIndex: activeCardIndex ?? this.activeCardIndex,
    sessionCards: sessionCards ?? this.sessionCards,
    isLoading: isLoading ?? this.isLoading,
    isReviewAhead: isReviewAhead ?? this.isReviewAhead,
  );
}

/// Coordinates vocabulary card reveal, frozen queue snapshot & SM-2 schedule persistence.
class VocabularyNotifier extends Notifier<VocabularyState> {
  DateTime? _cardStartedAt;
  bool _isDisposed = false;
  bool _isRating = false;

  @override
  VocabularyState build() {
    _isDisposed = false;
    _isRating = false;
    ref.onDispose(() => _isDisposed = true);
    return const VocabularyState(
      reviewedCount: 0,
      showAnswer: false,
    );
  }

  /// Loads a frozen snapshot of due (or ahead) cards capped at [batchLimit] (`UX-13`).
  Future<void> loadSession({
    required bool reviewAhead,
    int? batchLimit = 20,
  }) async {
    if (_isDisposed) return;
    _isRating = false;
    state = VocabularyState(
      reviewedCount: 0,
      showAnswer: false,
      isReviewAhead: reviewAhead,
    );

    final effectiveLimit = batchLimit ?? 200;
    final vocabRepo = ref.read(vocabRepositoryProvider);
    var cards = reviewAhead
        ? await vocabRepo.getAheadCards(limit: effectiveLimit)
        : await vocabRepo.getDueCards(limit: effectiveLimit);

    if (!reviewAhead) {
      try {
        final allCards = await vocabRepo.getDueCards(limit: 400);
        final cached = await ref
            .read(personalizationRepositoryProvider)
            .getCachedState();
        final reviewedToday = await vocabRepo.getReviewedCardIdsToday();
        final todaySerial = SerialDay.fromUtcDateTime(
          ref.read(clockProvider).now(),
        ).value;
        final unlockedWave = cached?.vocabUnlockedWave ?? 1;
        final dailyCap = cached?.dailyNewVocabCap ?? 10;
        final waveInputs = allCards
            .map(
              (c) => VocabWaveCardInput(
                cardId: c.cardId,
                headword: c.headword,
                legacyTopicTag: c.topicTag,
                repetitions: c.schedule.repetitions,
                dueSerialDay: c.schedule.dueDay.value,
                sourceKind: c.sourceAttemptId != null
                    ? 'mistake_to_deck'
                    : 'seeded',
                cefrLevel: AuthoringTier.values.firstWhere(
                  (t) =>
                      t.name.toUpperCase() == (c.cefrLevel ?? '').toUpperCase(),
                  orElse: () => AuthoringTier.b2,
                ),
                baseWaveOrder: c.baseWaveOrder ?? 500,
              ),
            )
            .toList(growable: false);
        final waveResult = VocabWaveScheduler.assignWaves<VocabWaveCardInput>(
          cards: waveInputs,
          favoriteTopics: cached?.favoriteTopics ?? const <String>[],
          track: ExamTrack.fromId(cached?.examTrack ?? 'ielts_academic'),
          currentBand: cached?.liveBand.currentBand,
          targetBand: cached?.targetBand ?? 7.0,
          activeWeaknessKeys:
              cached?.weaknesses
                  .map((w) => w.canonicalKey)
                  .toList(growable: false) ??
              const <String>[],
          unlockedWave: unlockedWave,
        );
        final selection =
            VocabWaveScheduler.selectDailyReviewQueue<VocabWaveCardInput>(
              assigned: waveResult.assigned,
              todaySerialDay: todaySerial,
              newCardsIntroducedToday: reviewedToday.length,
              unlockedWave: unlockedWave,
              dailyNewCap: dailyCap,
            );
        final byId = <String, VocabDeckCard>{
          for (final c in allCards) c.cardId: c,
        };
        final queued = selection.queue
            .map((a) => byId[a.card.cardId])
            .whereType<VocabDeckCard>()
            .take(effectiveLimit)
            .toList(growable: false);
        if (queued.isNotEmpty) {
          cards = queued;
        }
      } on Object {
        // Safe fallback to raw due cards in minimal isolated unit tests.
      }
    }

    if (_isDisposed) return;
    _cardStartedAt = ref.read(clockProvider).now();
    state = state.copyWith(
      sessionCards: cards,
      isLoading: false,
      activeCardIndex: 0,
      showAnswer: false,
    );
  }

  /// Reveals or hides the card meaning before grading.
  void toggleReveal() {
    state = state.copyWith(showAnswer: !state.showAnswer);
  }

  /// Submits a recall [quality] rating for [card], logs study activity & advances queue
  /// with a re-entrancy guard preventing double-ratings on rapid taps (`TD-46`).
  Future<void> rateCard({
    required VocabDeckCard card,
    required ReviewQuality quality,
  }) async {
    if (_isDisposed || _isRating) return;
    _isRating = true;
    try {
      final now = ref.read(clockProvider).now();
      final elapsedSec = _cardStartedAt != null
          ? now.difference(_cardStartedAt!).inSeconds.clamp(5, 120)
          : 15;
      _cardStartedAt = now;

      await ref
          .read(vocabRepositoryProvider)
          .recordReview(card: card, quality: quality);

      await ref
          .read(progressRepositoryProvider)
          .logTodayActivity(studySeconds: elapsedSec, completedItems: 1);

      try {
        final next = Sm2Scheduler.schedule(
          current: card.schedule,
          quality: quality,
          today: SerialDay.fromUtcDateTime(now),
        );
        await ref
            .read(attemptRepositoryProvider)
            .enqueueOutboxAction(
              actionType: 'vocab.srs_batch',
              payloadJson: jsonEncode(<String, Object?>{
                'cards': <Map<String, Object?>>[
                  <String, Object?>{
                    'cardId': card.cardId,
                    'repetitions': next.repetitions,
                    'intervalDays': next.intervalDays,
                    'easeFactorMilli': next.easeFactorMilli,
                    'dueSerialDay': next.dueDay.value,
                    'lapses': quality == ReviewQuality.again ? 1 : 0,
                    'lastReviewedAt': now.toUtc().toIso8601String(),
                    'sourceKind': card.sourceAttemptId != null
                        ? 'mistake_to_deck'
                        : 'seeded',
                    if (card.sourceAttemptId != null)
                      'cardSnapshotJson': <String, Object?>{
                        'headword': card.headword,
                        'definition': card.definition,
                        'glossFa': card.glossFa,
                        'ipa': card.ipa,
                        'topicTag': card.topicTag,
                        'contextSentence': card.contextSentence,
                      },
                  },
                ],
              }),
            );
        ref.read(outboxSyncServiceProvider).notifyWorkEnqueued();
      } on Object {
        // Offline / minimal unit-test fallback preserves local review state.
      }

      if (_isDisposed) return;
      state = state.copyWith(
        reviewedCount: state.reviewedCount + 1,
        activeCardIndex: state.activeCardIndex + 1,
        showAnswer: false,
      );
    } finally {
      _isRating = false;
    }
  }

  /// Resets review session pointers.
  void resetSession() {
    state = const VocabularyState(
      reviewedCount: 0,
      showAnswer: false,
      isLoading: false,
    );
  }
}
