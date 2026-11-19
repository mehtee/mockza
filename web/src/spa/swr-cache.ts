import { normalizeSupportedExamId, type SerialDay, type SupportedExamId } from '@mockza/domain';
import type { EditionCode } from '@/edition/edition-config';
import type { ICatalogMediaGateway } from '@/gateways/catalog.gateway';
import type { DiagnosticSessionDto } from '@/gateways/diagnostic.gateway';
import type {
  CatalogPackRecord,
  CompletedAttemptRecord,
  UserProfileRecord,
  VocabCardWithSrs,
} from '@/gateways/storage.gateway';

export const TRACK_CHANGED_EVENT = 'mockza:track-changed';

export interface HomeSwrSnapshot {
  readonly profile: UserProfileRecord | null;
  readonly attempts: readonly CompletedAttemptRecord[];
  readonly studyDays: readonly SerialDay[];
  readonly dueCards: readonly VocabCardWithSrs[];
  readonly latestDiagnostic: DiagnosticSessionDto | null;
}

const memoryCatalogByGateway = new WeakMap<ICatalogMediaGateway, readonly CatalogPackRecord[]>();
const memoryHomeByStore = new WeakMap<object, HomeSwrSnapshot>();
const memoryVocabByStore = new WeakMap<object, readonly VocabCardWithSrs[]>();
const inFlightCatalogSync = new WeakMap<
  ICatalogMediaGateway,
  Promise<readonly CatalogPackRecord[] | null>
>();

function isPersistentBrowser(): boolean {
  return typeof window !== 'undefined' && import.meta.env?.MODE !== 'test';
}

function trackStorageKey(edition: EditionCode): string {
  return `mockza:swr:track:v1:${edition}`;
}

function catalogStorageKey(edition: EditionCode): string {
  return `mockza:swr:catalog:v1:${edition}`;
}

function stripHeavyPackFields(pack: CatalogPackRecord): CatalogPackRecord {
  return {
    ...pack,
    bundleJson: null,
    cachedMediaInline: null,
  };
}

export function readSwrTrack(edition: EditionCode): SupportedExamId | null {
  if (!isPersistentBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(trackStorageKey(edition));
    return raw ? normalizeSupportedExamId(raw) : null;
  } catch {
    return null;
  }
}

export function writeSwrTrack(edition: EditionCode, examId: SupportedExamId): void {
  if (!isPersistentBrowser()) return;
  try {
    window.localStorage.setItem(trackStorageKey(edition), examId);
  } catch {
    // Ignore storage quota or private-mode errors.
  }
}

export function notifyTrackChanged(edition: EditionCode, examId: SupportedExamId): void {
  writeSwrTrack(edition, examId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<{ readonly examId: SupportedExamId }>(TRACK_CHANGED_EVENT, {
        detail: { examId },
      }),
    );
  }
}

export function subscribeTrackChanged(listener: (examId: SupportedExamId) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    const custom = event as CustomEvent<{ readonly examId?: SupportedExamId }>;
    if (custom.detail?.examId) {
      listener(custom.detail.examId);
    }
  };
  window.addEventListener(TRACK_CHANGED_EVENT, handler);
  return () => {
    window.removeEventListener(TRACK_CHANGED_EVENT, handler);
  };
}

export function readSwrCatalogPacks(
  catalog: ICatalogMediaGateway,
  edition: EditionCode,
): readonly CatalogPackRecord[] {
  const mem = memoryCatalogByGateway.get(catalog);
  if (mem && mem.length > 0) return mem;
  if (!isPersistentBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(catalogStorageKey(edition));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CatalogPackRecord[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      memoryCatalogByGateway.set(catalog, parsed);
      return parsed;
    }
  } catch {
    // Ignore malformed snapshot.
  }
  return [];
}

export function writeSwrCatalogPacks(
  catalog: ICatalogMediaGateway,
  edition: EditionCode,
  packs: readonly CatalogPackRecord[],
): void {
  if (packs.length === 0) return;
  memoryCatalogByGateway.set(catalog, packs);
  if (!isPersistentBrowser()) return;
  try {
    const slim = packs.map(stripHeavyPackFields);
    window.localStorage.setItem(catalogStorageKey(edition), JSON.stringify(slim));
  } catch {
    // Ignore storage quota errors.
  }
}

export function ensureCatalogSynced(
  catalog: ICatalogMediaGateway,
  edition: EditionCode,
): Promise<readonly CatalogPackRecord[] | null> {
  const existing = inFlightCatalogSync.get(catalog);
  if (existing) return existing;

  const task = catalog
    .syncCatalogManifest()
    .then((res) => {
      if (res.ok && res.value.length > 0) {
        writeSwrCatalogPacks(catalog, edition, res.value);
        return res.value;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => {
      inFlightCatalogSync.delete(catalog);
    });

  inFlightCatalogSync.set(catalog, task);
  return task;
}

export function readSwrHomeSnapshot(store: object): HomeSwrSnapshot | null {
  return memoryHomeByStore.get(store) ?? null;
}

export function writeSwrHomeSnapshot(store: object, snapshot: HomeSwrSnapshot): void {
  memoryHomeByStore.set(store, snapshot);
}

export function readSwrVocabCards(store: object): readonly VocabCardWithSrs[] {
  return memoryVocabByStore.get(store) ?? [];
}

export function writeSwrVocabCards(store: object, cards: readonly VocabCardWithSrs[]): void {
  if (cards.length > 0) {
    memoryVocabByStore.set(store, cards);
  }
}
