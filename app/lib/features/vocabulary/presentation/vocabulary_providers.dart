import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/data/repositories/vocab_repository.dart';
import 'package:mockza/features/vocabulary/presentation/vocabulary_notifier.dart';
import 'package:mockza/providers.dart';

/// Provides [VocabularyState] via [VocabularyNotifier].
final NotifierProvider<VocabularyNotifier, VocabularyState>
vocabularyNotifierProvider =
    NotifierProvider<VocabularyNotifier, VocabularyState>(
      VocabularyNotifier.new,
    );

/// Streams vocabulary cards currently due for SRS review.
final StreamProvider<List<VocabDeckCard>> dueVocabCardsProvider =
    StreamProvider<List<VocabDeckCard>>(
      (ref) => ref.watch(vocabRepositoryProvider).watchDueCards(),
    );

/// Streams saved vocabulary cards available for ahead review.
final StreamProvider<List<VocabDeckCard>> aheadVocabCardsProvider =
    StreamProvider<List<VocabDeckCard>>(
      (ref) => ref.watch(vocabRepositoryProvider).watchAheadCards(),
    );

/// Streams all saved vocabulary cards for the vocabulary deck.
final StreamProvider<List<VocabDeckCard>> allVocabCardsProvider =
    StreamProvider<List<VocabDeckCard>>(
      (ref) => ref.watch(vocabRepositoryProvider).watchAllCards(),
    );

/// Filter selection state for vocabulary dashboard.
class VocabFilterNotifier extends Notifier<String> {
  @override
  String build() => 'All';

  /// Updates active skill/topic filter.
  void setFilter(String filter) {
    if (state == filter) return;
    state = filter;
  }
}

/// Provides active filter string for vocabulary deck.
final NotifierProvider<VocabFilterNotifier, String> vocabFilterProvider =
    NotifierProvider<VocabFilterNotifier, String>(VocabFilterNotifier.new);

/// Search query state for vocabulary deck.
class VocabSearchQueryNotifier extends Notifier<String> {
  @override
  String build() => '';

  /// Updates search text.
  void setQuery(String query) {
    if (state == query) return;
    state = query;
  }
}

/// Provides active search query string for vocabulary deck.
final NotifierProvider<VocabSearchQueryNotifier, String>
vocabSearchQueryProvider = NotifierProvider<VocabSearchQueryNotifier, String>(
  VocabSearchQueryNotifier.new,
);

/// Selected review session batch size (`15`, `20`, `30`, or `null` for all cards; default `20`).
class VocabBatchSizeNotifier extends Notifier<int?> {
  @override
  int? build() => 20;

  /// Selects a target card count per review session (`null` means all available).
  void setBatchSize(int? size) {
    if (state == size) return;
    state = size;
  }
}

/// Provides selected vocabulary review session batch limit (`UX-13`).
final NotifierProvider<VocabBatchSizeNotifier, int?> vocabBatchSizeProvider =
    NotifierProvider<VocabBatchSizeNotifier, int?>(
      VocabBatchSizeNotifier.new,
    );
