import type { SupportedExamId } from '@mockza/domain';
import type { ICatalogMediaGateway } from '@/gateways/catalog.gateway';
import type { IVocabSrsStore, SeedDeckUpsertSummary } from '@/gateways/storage.gateway';

/**
 * Fetches seeded vocabulary cards from `/v1/vocab/deck` and merges them into Dexie
 * without clobbering existing SM-2 repetition/interval/due-day states.
 */
export async function syncSeededVocabDeck(
  catalog: ICatalogMediaGateway,
  vocabStore: IVocabSrsStore,
  defaultExamId: SupportedExamId = 'ielts_academic',
): Promise<SeedDeckUpsertSummary | null> {
  const res = await catalog.syncVocabDeck(defaultExamId);
  if (!res.ok || res.value.length === 0) {
    return null;
  }
  const upsertRes = await vocabStore.upsertSeededDeckPreservingSrs(res.value);
  return upsertRes.ok ? upsertRes.value : null;
}
