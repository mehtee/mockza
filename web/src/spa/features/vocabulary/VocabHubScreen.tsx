import { Link } from '@tanstack/react-router';
import { useVirtualizer } from '@tanstack/react-virtual';
import { BookOpen, Flame, Play, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MzCard, MzSegmentedControl } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { VocabCardWithSrs } from '@/gateways/storage.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import { syncSeededVocabDeck } from '@/spa/vocab-sync';

export function VocabHubScreen() {
  const deps = useDeps();
  const t = createTranslator(deps.edition);
  const scrollParentRef = useRef<HTMLDivElement | null>(null);

  const [cards, setCards] = useState<readonly VocabCardWithSrs[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'mistake_to_deck' | 'seeded'>('all');

  useEffect(() => {
    let mounted = true;
    const todaySerial = deps.clock.todaySerialDay();

    async function hydrate() {
      const [allRes, dueRes] = await Promise.all([
        deps.vocabStore.getAllCards(),
        deps.vocabStore.getDueCards(todaySerial, 500),
      ]);
      if (!mounted) return;
      if (allRes.ok) setCards(allRes.value);
      if (dueRes.ok) setDueCount(dueRes.value.length);

      const summary = await syncSeededVocabDeck(deps.catalog, deps.vocabStore);
      if (!mounted || !summary) return;
      if (summary.insertedCount > 0 || summary.updatedCount > 0) {
        const [refreshedAll, refreshedDue] = await Promise.all([
          deps.vocabStore.getAllCards(),
          deps.vocabStore.getDueCards(todaySerial, 500),
        ]);
        if (!mounted) return;
        if (refreshedAll.ok) setCards(refreshedAll.value);
        if (refreshedDue.ok) setDueCount(refreshedDue.value.length);
      }
    }
    void hydrate();
    return () => {
      mounted = false;
    };
  }, [deps.catalog, deps.clock, deps.vocabStore]);

  const filteredCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return cards.filter(({ card }) => {
      if (sourceFilter !== 'all' && card.sourceKind !== sourceFilter) return false;
      if (query) {
        const hay = `${card.headword} ${card.definition} ${card.topicTag} ${card.glossFa ?? ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [cards, searchQuery, sourceFilter]);

  const masteredCount = useMemo(
    () => cards.filter((c) => c.srs.state === 'mastered').length,
    [cards],
  );

  const rowVirtualizer = useVirtualizer({
    count: filteredCards.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 92,
    overscan: 6,
    initialRect: { width: 920, height: 560 },
    observeElementRect: (instance, cb) => {
      const el = instance.scrollElement;
      if (!el) return undefined;
      const rect = el.getBoundingClientRect();
      cb({
        width: rect.width > 0 ? rect.width : 920,
        height: rect.height > 0 ? rect.height : 560,
      });
      if (typeof ResizeObserver !== 'function') return undefined;
      const ro = new ResizeObserver((entries) => {
        const entry = entries[0]?.contentRect;
        if (entry && entry.height > 0) {
          cb({ width: entry.width, height: entry.height });
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    },
  });

  return (
    <div data-testid="vocab-hub-screen" className="mx-auto flex max-w-6xl flex-col gap-5 pb-12 text-start">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('vocabHubTitle')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('vocabHubSubtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/vocabulary/review"
            data-testid="vocab-start-review-cta"
            className="inline-flex h-10 items-center gap-2 rounded-[var(--mz-radius-control)] bg-primary px-4 text-xs font-semibold text-on-primary hover:bg-primary-pressed"
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {dueCount > 0
                ? t('vocabStartDueReviewCta', { count: dueCount })
                : t('vocabStudyAheadCta')}
            </span>
          </Link>
        </div>
      </div>

      {/* Summary KPI + Filter Bar */}
      <MzCard variant="default" padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span
              data-testid="vocab-due-counter"
              className="inline-flex items-center gap-1.5 rounded-[var(--mz-radius-pill)] bg-amber-bg px-3 py-1 text-xs font-semibold text-warning"
            >
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('vocabStateDueCount', { count: dueCount })}</span>
            </span>
            <span
              data-testid="vocab-mastered-counter"
              className="inline-flex items-center gap-1.5 rounded-[var(--mz-radius-pill)] bg-mint-bg px-3 py-1 text-xs font-semibold text-success"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('vocabStateMasteredCount', { count: masteredCount })}</span>
            </span>
            <span className="text-xs font-mono-exam text-text-secondary" data-testid="vocab-total-counter">
              {filteredCards.length} / {cards.length}
            </span>
          </div>

          <MzSegmentedControl<'all' | 'mistake_to_deck' | 'seeded'>
            ariaLabel="Card Source Filter"
            value={sourceFilter}
            onChange={setSourceFilter}
            options={[
              { value: 'all', label: t('vocabFilterAll') },
              { value: 'mistake_to_deck', label: t('vocabFilterMistakeDeck') },
              { value: 'seeded', label: t('vocabFilterSeeded') },
            ]}
          />
        </div>

        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
            aria-hidden="true"
          />
          <input
            type="search"
            data-testid="vocab-search-input"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('vocabSearchPlaceholder')}
            className="h-9 w-full rounded-[var(--mz-radius-control)] border border-border-subtle bg-canvas ps-9 pe-3 text-xs text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none"
          />
        </div>
      </MzCard>

      {/* Virtualized Deck Viewport */}
      {filteredCards.length === 0 ? (
        <MzCard variant="alt">
          <p className="py-8 text-center text-sm text-text-secondary">
            {t('vocabEmptyDeckMessage')}
          </p>
        </MzCard>
      ) : (
        <div
          ref={scrollParentRef}
          data-testid="vocab-virtual-viewport"
          className="h-[520px] overflow-y-auto rounded-[var(--mz-radius-card)] border border-border-subtle bg-bg-raised p-3"
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const entry = filteredCards[virtualRow.index];
              if (!entry) return null;
              const { card, srs } = entry;
              return (
                <div
                  key={card.cardId}
                  data-testid={`vocab-row-${card.cardId}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="pb-2"
                >
                  <div className="flex h-full items-center justify-between gap-4 rounded-[var(--mz-radius-control)] border border-border-subtle bg-canvas px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <LtrExamBoundary>
                          <span className="text-sm font-bold text-text-primary">
                            {card.headword}
                          </span>
                        </LtrExamBoundary>
                        {card.ipa ? (
                          <LtrExamBoundary>
                            <span className="font-mono-exam text-[11px] text-text-tertiary">
                              {card.ipa}
                            </span>
                          </LtrExamBoundary>
                        ) : null}
                        <span className="rounded-[var(--mz-radius-pill)] bg-surface-alt px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                          {srs.state}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-text-secondary">
                        {card.definition}
                      </p>
                      {deps.edition === 'irn' && card.glossFa ? (
                        <p className="mt-0.5 truncate text-xs font-medium text-primary">
                          {card.glossFa}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        to="/vocabulary/$wordId"
                        params={{ wordId: card.cardId }}
                        data-testid={`vocab-inspect-${card.cardId}`}
                        className="inline-flex h-8 items-center gap-1 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-2.5 text-xs font-semibold text-text-primary hover:bg-surface-hover"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                        <span>{t('vocabInspectWordAction')}</span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
