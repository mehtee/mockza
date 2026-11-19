import type { SupportedExamId } from '@mockza/domain';
import type { ICatalogMediaGateway } from '@/gateways/catalog.gateway';
import type { IVocabSrsStore, SeedDeckUpsertSummary } from '@/gateways/storage.gateway';

const inFlightVocabSyncByStore = new WeakMap<
  IVocabSrsStore,
  Promise<SeedDeckUpsertSummary | null>
>();

/**
 * Fetches seeded vocabulary cards from `/v1/vocab/deck` and merges them into Dexie
 * without clobbering existing SM-2 repetition/interval/due-day states.
 * Deduplicates concurrent sync calls and skips redundant network downloads when
 * seeded cards are already hydrated in the local store.
 */
export async function syncSeededVocabDeck(
  catalog: ICatalogMediaGateway,
  vocabStore: IVocabSrsStore,
  defaultExamId: SupportedExamId = 'ielts_academic',
): Promise<SeedDeckUpsertSummary | null> {
  const existingTask = inFlightVocabSyncByStore.get(vocabStore);
  if (existingTask) {
    return existingTask;
  }

  const task = (async (): Promise<SeedDeckUpsertSummary | null> => {
    const existingRes = await vocabStore.getAllCards();
    if (
      existingRes.ok &&
      existingRes.value.some((entry) => entry.card.sourceKind === 'seeded')
    ) {
      return { insertedCount: 0, updatedCount: 0 };
    }

    const res = await catalog.syncVocabDeck(defaultExamId);
    if (!res.ok || res.value.length === 0) {
      return null;
    }
    const upsertRes = await vocabStore.upsertSeededDeckPreservingSrs(res.value);
    return upsertRes.ok ? upsertRes.value : null;
  })().finally(() => {
    inFlightVocabSyncByStore.delete(vocabStore);
  });

  inFlightVocabSyncByStore.set(vocabStore, task);
  return task;
}
