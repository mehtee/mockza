import {
  assignVocabWaves,
  type AuthoringTier,
  DEFAULT_DAILY_NEW_CAP,
  mapLegacyVocabTopicTag,
  type CanonicalTopicKey,
} from '@mockza/domain';
import { Link } from '@tanstack/react-router';
import { useVirtualizer } from '@tanstack/react-virtual';
import { BookOpen, Flame, Lock, Mic, Play, Search, Sparkles, Unlock } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { InlineListenButton } from '@/components/speech/InlineListenButton';
import { SpeechPracticeDrawer } from '@/components/speech/SpeechPracticeDrawer';
import { MzButton, MzCard, MzSegmentedControl } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { PersonalizationStateDto } from '@/gateways/personalization.gateway';
import type { VocabCardWithSrs } from '@/gateways/storage.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import { readSwrVocabCards, writeSwrVocabCards } from '@/spa/swr-cache';
import { syncSeededVocabDeck } from '@/spa/vocab-sync';

function mapSourceKindForWaves(
  sk: VocabCardWithSrs['card']['sourceKind'],
): 'seeded' | 'mistake_to_deck' | 'evaluation_upgrade' | 'drop_extract' {
  if (sk === 'register_shifter') return 'evaluation_upgrade';
  if (sk === 'drop_anything') return 'drop_extract';
  if (sk === 'mistake_to_deck') return 'mistake_to_deck';
  return 'seeded';
}

export function VocabHubScreen() {
  const deps = useDeps();
  const t = createTranslator(deps.edition);
  const scrollParentRef = useRef<HTMLDivElement | null>(null);

  const [cards, setCards] = useState<readonly VocabCardWithSrs[]>(() =>
    readSwrVocabCards(deps.vocabStore),
  );
  const [dueCount, setDueCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [vocabTab, setVocabTab] = useState<'wave' | 'mistakes' | 'full'>('wave');
  const [personalization, setPersonalization] = useState<PersonalizationStateDto | null>(null);
  const [favoriteTopics, setFavoriteTopics] = useState<readonly string[]>([]);
  const [examId, setExamId] = useState<VocabCardWithSrs['card']['examId']>('ielts_academic');
  const [targetBand, setTargetBand] = useState<number>(7.0);
  const [unlockedWave, setUnlockedWave] = useState<number>(1);
  const [dailyNewUsedToday, setDailyNewUsedToday] = useState<number>(0);
  const [showLockedWaves, setShowLockedWaves] = useState<boolean>(false);
  const [practiceCard, setPracticeCard] = useState<VocabCardWithSrs | null>(null);

  useEffect(() => {
    let mounted = true;
    const todaySerial = deps.clock.todaySerialDay();

    async function hydrate() {
      const [allRes, dueRes, profileRes, logsRes, pRes] = await Promise.all([
        deps.vocabStore.getAllCards(),
        deps.vocabStore.getDueCards(todaySerial, 500),
        deps.attemptStore.getUserProfile(),
        deps.vocabStore.listVocabReviewLogs({ limit: 200 }),
        deps.personalization ? deps.personalization.getState() : Promise.resolve(null),
      ]);
      if (!mounted) return;
      if (profileRes.ok && profileRes.value) {
        setExamId(profileRes.value.examId);
        setTargetBand(profileRes.value.targetBand);
        if (profileRes.value.favoriteTopics) {
          setFavoriteTopics(profileRes.value.favoriteTopics);
        }
      }
      if (pRes && pRes.ok) {
        setPersonalization(pRes.value);
        setUnlockedWave(pRes.value.profile.vocabUnlockedWave);
        setFavoriteTopics(pRes.value.profile.favoriteTopics);
        setTargetBand(pRes.value.profile.targetBand);
      }
      if (logsRes.ok) {
        const seenToday = new Set(
          logsRes.value
            .filter((l) => l.reviewedDaySerial === todaySerial)
            .map((l) => l.cardId),
        );
        setDailyNewUsedToday(Math.min(DEFAULT_DAILY_NEW_CAP, seenToday.size));
      }
      if (allRes.ok) {
        setCards(allRes.value);
        writeSwrVocabCards(deps.vocabStore, allRes.value);
      }
      if (dueRes.ok) setDueCount(dueRes.value.length);

      const summary = await syncSeededVocabDeck(deps.catalog, deps.vocabStore);
      if (!mounted || !summary) return;
      if (summary.insertedCount > 0 || summary.updatedCount > 0) {
        const [refreshedAll, refreshedDue] = await Promise.all([
          deps.vocabStore.getAllCards(),
          deps.vocabStore.getDueCards(todaySerial, 500),
        ]);
        if (!mounted) return;
        if (refreshedAll.ok) {
          setCards(refreshedAll.value);
          writeSwrVocabCards(deps.vocabStore, refreshedAll.value);
        }
        if (refreshedDue.ok) setDueCount(refreshedDue.value.length);
      }
    }
    void hydrate();
    return () => {
      mounted = false;
    };
  }, [deps.attemptStore, deps.catalog, deps.clock, deps.personalization, deps.vocabStore]);

  const waveResult = useMemo(() => {
    const waveInputs = cards.map((entry) => ({
      cardId: entry.card.cardId,
      headword: entry.card.headword,
      canonicalTopicKey: entry.card.canonicalTopic
        ? (entry.card.canonicalTopic as CanonicalTopicKey)
        : mapLegacyVocabTopicTag(entry.card.topicTag),
      legacyTopicTag: entry.card.topicTag,
      cefrLevel: (entry.card.cefrLevel as AuthoringTier | undefined) ?? 'B2',
      baseWaveOrder: entry.card.baseWaveOrder,
      sourceKind: mapSourceKindForWaves(entry.card.sourceKind),
      repetitions: entry.srs.repetitions,
      dueSerialDay: entry.srs.dueSerialDay,
      isMastered: entry.srs.state === 'mastered',
      entry,
    }));
    return assignVocabWaves({
      cards: waveInputs,
      favoriteTopics,
      examId,
      currentBand: personalization?.liveBand.currentBand ?? null,
      targetBand,
      activeWeaknessKeys: personalization?.weaknesses.map((w) => w.canonicalKey) ?? [],
      unlockedWave,
    });
  }, [cards, examId, favoriteTopics, personalization, targetBand, unlockedWave]);

  const unlockedCardCount = useMemo(
    () => waveResult.assigned.filter((a) => a.isUnlocked).length,
    [waveResult.assigned],
  );

  const handleUnlockNextWave = async () => {
    const nextWave = Math.min(waveResult.totalWaves, unlockedWave + 1);
    setUnlockedWave(nextWave);
    if (deps.personalization) {
      const res = await deps.personalization.updateProfile({ unlockNextVocabWave: true });
      if (res.ok) {
        setPersonalization(res.value);
        setUnlockedWave(res.value.profile.vocabUnlockedWave);
      }
    }
  };

  const filteredCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return waveResult.assigned
      .filter((item) => {
        const entry = item.card.entry;
        if (vocabTab === 'mistakes') {
          if (entry.card.sourceKind === 'seeded') return false;
        } else if (vocabTab === 'wave') {
          if (!showLockedWaves && !query && !item.isUnlocked && entry.card.sourceKind === 'seeded') {
            return false;
          }
        }
        if (query) {
          const hay = `${entry.card.headword} ${entry.card.definition} ${entry.card.topicTag} ${entry.card.glossFa ?? ''}`.toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      })
      .map((item) => ({ ...item.card.entry, isWaveUnlocked: item.isUnlocked, waveNumber: item.waveNumber }));
  }, [searchQuery, showLockedWaves, vocabTab, waveResult.assigned]);

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

      {/* Progressive Wave Banner (15 words/wave, 10 new/day cap) */}
      <MzCard variant="hero" padding="sm" data-testid="vocab-wave-banner">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-bold text-primary">
              {t('vocabWaveHeading', {
                wave: unlockedWave,
                unlocked: unlockedCardCount,
                total: cards.length,
              })}
            </p>
            <p className="text-[11px] text-text-secondary">
              {t('vocabDailyNewCapLabel', {
                used: personalization
                  ? Math.max(0, DEFAULT_DAILY_NEW_CAP - personalization.vocabWaveSummary.dailyNewRemaining)
                  : dailyNewUsedToday,
                cap: personalization?.profile.dailyNewVocabCap ?? DEFAULT_DAILY_NEW_CAP,
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {unlockedWave < waveResult.totalWaves ? (
              <MzButton
                variant="secondary"
                size="sm"
                data-testid="vocab-unlock-next-wave"
                leadingIcon={<Unlock className="h-3.5 w-3.5" aria-hidden="true" />}
                onClick={() => void handleUnlockNextWave()}
              >
                {t('vocabUnlockNextWaveCta')}
              </MzButton>
            ) : null}
            <button
              type="button"
              data-testid="vocab-preview-all-waves"
              onClick={() => {
                setShowLockedWaves((prev) => !prev);
                setVocabTab((prev) => (prev === 'full' ? 'wave' : 'full'));
              }}
              className="inline-flex h-8 items-center gap-1 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-2.5 text-[11px] font-semibold text-text-secondary hover:text-text-primary"
            >
              <Lock className="h-3 w-3" aria-hidden="true" />
              <span>
                {showLockedWaves
                  ? t('vocabShowUnlockedOnlyLabel')
                  : t('vocabPreviewAllWavesLabel')}
              </span>
            </button>
          </div>
        </div>
        {personalization?.vocabWaveSummary.readyToUnlockNext && unlockedWave < waveResult.totalWaves ? (
          <p className="mt-2 rounded-[var(--mz-radius-compact)] bg-mint-bg px-2.5 py-1 text-xs font-semibold text-success">
            {t('vocabWaveAutoUnlockedToast', { wave: unlockedWave, next: unlockedWave + 1 })}
          </p>
        ) : null}
      </MzCard>

      {/* 3-Tab Vocabulary Hub Switcher */}
      <MzSegmentedControl<'wave' | 'mistakes' | 'full'>
        ariaLabel="Vocabulary View"
        value={vocabTab}
        onChange={(nextTab) => {
          setVocabTab(nextTab);
          if (nextTab === 'full') setShowLockedWaves(true);
          if (nextTab === 'wave') setShowLockedWaves(false);
        }}
        options={[
          { value: 'wave', label: t('vocabTabTodaysWave') },
          { value: 'mistakes', label: t('vocabTabSavedMistakes') },
          { value: 'full', label: t('vocabTabFullDeck') },
        ]}
      />

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

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <InlineListenButton
                        text={card.headword}
                        sourceContext="vocab"
                        showSlowToggle={false}
                        testId={`vocab-listen-${card.cardId}`}
                        size="sm"
                      />
                      <button
                        type="button"
                        data-testid={`vocab-practice-${card.cardId}`}
                        onClick={() => setPracticeCard({ card, srs })}
                        className="inline-flex h-7 items-center gap-1 rounded-[var(--mz-radius-compact)] border border-primary/40 bg-primary/10 px-2 text-[11px] font-semibold text-primary hover:bg-primary/20"
                      >
                        <Mic className="h-3 w-3" aria-hidden="true" />
                      </button>
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

      <SpeechPracticeDrawer
        open={practiceCard !== null}
        onClose={() => setPracticeCard(null)}
        targetText={practiceCard?.card.contextSentence || practiceCard?.card.headword || ''}
        practiceKind={practiceCard?.card.contextSentence ? 'sentence' : 'word'}
        sourceRefType="vocab_card"
        sourceRefId={practiceCard?.card.cardId}
        examTrack={examId}
      />
    </div>
  );
}
