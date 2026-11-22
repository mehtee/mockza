import {
  assignVocabWaves,
  type AuthoringTier,
  type CanonicalTopicKey,
  DEFAULT_DAILY_NEW_CAP,
  mapLegacyVocabTopicTag,
  type ReviewQuality,
  scheduleSm2Review,
} from '@mockza/domain';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, Mic } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { InlineListenButton } from '@/components/speech/InlineListenButton';
import { SpeechPracticeDrawer } from '@/components/speech/SpeechPracticeDrawer';
import { MzButton, MzCard } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { VocabCardWithSrs, VocabReviewRating } from '@/gateways/storage.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import { syncSeededVocabDeck } from '@/spa/vocab-sync';

function mapSourceForWave(
  sk: VocabCardWithSrs['card']['sourceKind'],
): 'seeded' | 'mistake_to_deck' | 'evaluation_upgrade' | 'drop_extract' {
  if (sk === 'register_shifter') return 'evaluation_upgrade';
  if (sk === 'drop_anything') return 'drop_extract';
  if (sk === 'mistake_to_deck') return 'mistake_to_deck';
  return 'seeded';
}

const RATING_SPECS: readonly {
  readonly rating: VocabReviewRating;
  readonly quality: ReviewQuality;
  readonly shortcutKey: string;
}[] = [
  { rating: 0, quality: 'again', shortcutKey: '1' },
  { rating: 1, quality: 'hard', shortcutKey: '2' },
  { rating: 2, quality: 'good', shortcutKey: '3' },
  { rating: 3, quality: 'easy', shortcutKey: '4' },
];

export function VocabReviewScreen() {
  const deps = useDeps();
  const t = createTranslator(deps.edition);

  const [queue, setQueue] = useState<readonly VocabCardWithSrs[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [practiceOpen, setPracticeOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const todaySerial = deps.clock.todaySerialDay();

    async function hydrate() {
      const loadQueue = async () => {
        const [dueRes, profileRes, logsRes, pRes] = await Promise.all([
          deps.vocabStore.getDueCards(todaySerial, 350),
          deps.attemptStore.getUserProfile(),
          deps.vocabStore.listVocabReviewLogs({ limit: 300 }),
          deps.personalization ? deps.personalization.getState() : Promise.resolve(null),
        ]);
        if (!mounted) return;

        const unlockedWave = pRes && pRes.ok ? pRes.value.profile.vocabUnlockedWave : 1;
        const dailyCap = pRes && pRes.ok ? pRes.value.profile.dailyNewVocabCap : DEFAULT_DAILY_NEW_CAP;
        const favoriteTopics =
          pRes && pRes.ok
            ? pRes.value.profile.favoriteTopics
            : (profileRes.ok && profileRes.value?.favoriteTopics) || [];
        const examId = profileRes.ok && profileRes.value ? profileRes.value.examId : 'ielts_academic';
        const targetBand = profileRes.ok && profileRes.value ? profileRes.value.targetBand : 7.0;

        // Track how many new cards were already reviewed today (respect daily new cap unless reviewing already-seen cards)
        const reviewedTodayIds = new Set(
          logsRes.ok
            ? logsRes.value.filter((l) => l.reviewedDaySerial === todaySerial).map((l) => l.cardId)
            : [],
        );
        const remainingNewBudget = Math.max(0, dailyCap - reviewedTodayIds.size);

        if (dueRes.ok && dueRes.value.length > 0) {
          const waves = assignVocabWaves({
            cards: dueRes.value.map((entry) => ({
              cardId: entry.card.cardId,
              headword: entry.card.headword,
              canonicalTopicKey: entry.card.canonicalTopic
                ? (entry.card.canonicalTopic as CanonicalTopicKey)
                : mapLegacyVocabTopicTag(entry.card.topicTag),
              legacyTopicTag: entry.card.topicTag,
              cefrLevel: (entry.card.cefrLevel as AuthoringTier | undefined) ?? 'B2',
              baseWaveOrder: entry.card.baseWaveOrder,
              sourceKind: mapSourceForWave(entry.card.sourceKind),
              repetitions: entry.srs.repetitions,
              dueSerialDay: entry.srs.dueSerialDay,
              isMastered: entry.srs.state === 'mastered',
              entry,
            })),
            favoriteTopics,
            examId,
            currentBand: pRes && pRes.ok ? pRes.value.liveBand.currentBand : null,
            targetBand,
            activeWeaknessKeys: pRes && pRes.ok ? pRes.value.weaknesses.map((w) => w.canonicalKey) : [],
            unlockedWave,
          });
          const reviewQueue: VocabCardWithSrs[] = [];
          let newAdded = 0;
          for (const assigned of waves.assigned) {
            const entry = assigned.card.entry;
            const isUserCard = entry.card.sourceKind !== 'seeded';
            if (!assigned.isUnlocked && !isUserCard) continue;
            if (entry.srs.repetitions === 0 && !isUserCard) {
              if (newAdded >= remainingNewBudget) continue;
              newAdded += 1;
            }
            reviewQueue.push(entry);
          }
          if (reviewQueue.length > 0) {
            setQueue(reviewQueue.slice(0, 40));
            return;
          }
        }
        const aheadRes = await deps.vocabStore.getAheadCards(25, todaySerial);
        if (!mounted) return;
        if (aheadRes.ok) {
          setQueue(aheadRes.value);
        }
      };

      await loadQueue();
      if (!mounted) return;
      setLoading(false);

      const summary = await syncSeededVocabDeck(deps.catalog, deps.vocabStore);
      if (!mounted || !summary) return;
      if (summary.insertedCount > 0 || summary.updatedCount > 0) {
        await loadQueue();
      }
    }
    void hydrate();
    return () => {
      mounted = false;
    };
  }, [deps.attemptStore, deps.catalog, deps.clock, deps.personalization, deps.vocabStore]);

  const BackIcon = deps.edition === 'irn' ? ArrowRight : ArrowLeft;
  const currentEntry = queue[currentIndex] ?? null;

  const ratingLabelFor = (quality: ReviewQuality) => {
    switch (quality) {
      case 'again':
        return t('vocabRateAgain');
      case 'hard':
        return t('vocabRateHard');
      case 'good':
        return t('vocabRateGood');
      case 'easy':
        return t('vocabRateEasy');
    }
  };

  const intervalPreviews = useMemo(() => {
    if (!currentEntry) return null;
    const todaySerial = deps.clock.todaySerialDay();
    return RATING_SPECS.map((spec) => {
      const next = scheduleSm2Review({
        current: {
          repetitions: currentEntry.srs.repetitions,
          intervalDays: currentEntry.srs.intervalDays,
          easeFactorMilli: currentEntry.srs.easeFactorMilli,
          dueDay: currentEntry.srs.dueSerialDay,
        },
        quality: spec.quality,
        today: todaySerial,
      });
      return { ...spec, intervalDays: next.intervalDays };
    });
  }, [currentEntry, deps.clock]);

  const handleRate = useCallback(
    async (rating: VocabReviewRating) => {
      if (!currentEntry) return;
      const todaySerial = deps.clock.todaySerialDay();
      const nowMs = deps.clock.nowMs();

      const srsRes = await deps.vocabStore.recordReview({
        cardId: currentEntry.card.cardId,
        rating,
        todaySerialDay: todaySerial,
        nowMs,
      });
      await deps.attemptStore.incrementDailyStudyLog({
        serialDay: todaySerial,
        addSeconds: 20,
        addCompletedItems: 1,
      });

      if (srsRes.ok) {
        const srs = srsRes.value;
        const normalizedSource =
          currentEntry.card.sourceKind === 'register_shifter'
            ? 'evaluation_upgrade'
            : currentEntry.card.sourceKind === 'drop_anything'
              ? 'drop_extract'
              : currentEntry.card.sourceKind;
        const syncPayload = {
          cards: [
            {
              cardId: srs.cardId,
              easeFactorMilli: srs.easeFactorMilli,
              intervalDays: srs.intervalDays,
              repetitions: srs.repetitions,
              dueSerialDay: srs.dueSerialDay,
              lapses: rating === 0 ? 1 : 0,
              sourceKind: normalizedSource,
              lastReviewedAt: new Date(nowMs).toISOString(),
              ...(normalizedSource !== 'seeded'
                ? {
                    cardSnapshotJson: {
                      cardId: currentEntry.card.cardId,
                      examId: currentEntry.card.examId,
                      headword: currentEntry.card.headword,
                      definition: currentEntry.card.definition,
                      glossFa: currentEntry.card.glossFa ?? null,
                      topicTag: currentEntry.card.topicTag,
                      contextSentence: currentEntry.card.contextSentence ?? '',
                    },
                  }
                : {}),
            },
          ],
        };
        await deps.syncOutbox.enqueue({
          idempotencyKey: `vocab.srs:${srs.cardId}:${nowMs}`,
          actionType: 'vocab.srs_batch',
          entityKind: 'vocab_log',
          payloadJson: JSON.stringify(syncPayload),
        });
        void deps.syncOutbox.flushPending();
      }

      setReviewedCount((c) => c + 1);
      setIsFlipped(false);
      setCurrentIndex((idx) => idx + 1);
    },
    [currentEntry, deps.attemptStore, deps.clock, deps.syncOutbox, deps.vocabStore],
  );

  // Keyboard shortcuts: Space flips card, 1-4 rates recall
  useEffect(() => {
    if (!currentEntry) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      if (event.code === 'Space' || event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        setIsFlipped((prev) => !prev);
        return;
      }

      if (isFlipped && ['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault();
        const rating = (Number(event.key) - 1) as VocabReviewRating;
        void handleRate(rating);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentEntry, handleRate, isFlipped]);

  if (loading) {
    return (
      <div data-testid="vocab-review-screen" className="p-6 text-sm text-text-secondary">
        Loading SM-2 queue...
      </div>
    );
  }

  if (!currentEntry) {
    return (
      <div data-testid="vocab-review-screen" className="mx-auto flex max-w-2xl flex-col gap-5 py-8 text-start">
        <MzCard variant="hero" data-testid="vocab-session-complete">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            <h1 className="text-xl font-bold">{t('vocabSessionCompleteTitle')}</h1>
          </div>
          <p className="mt-2 text-sm text-text-secondary">
            {t('vocabSessionReviewedCount', { count: reviewedCount })}
          </p>
          <div className="mt-5">
            <Link
              to="/vocabulary"
              data-testid="vocab-back-hub-link"
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--mz-radius-control)] bg-primary px-4 text-xs font-semibold text-on-primary hover:bg-primary-pressed"
            >
              <BackIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('vocabBackToHubAction')}</span>
            </Link>
          </div>
        </MzCard>
      </div>
    );
  }

  return (
    <div data-testid="vocab-review-screen" className="mx-auto flex max-w-3xl flex-col gap-5 py-4 text-start">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t('vocabReviewTitle')}</h1>
          <p className="text-xs text-text-secondary">
            {isFlipped ? t('vocabReviewRateHint') : t('vocabReviewFlipHint')}
          </p>
        </div>
        <span className="font-mono-exam text-xs font-bold text-primary">
          {currentIndex + 1} / {queue.length}
        </span>
      </div>

      <MzCard variant="hero" data-testid="vocab-flashcard-stage">
        <div className="flex flex-col items-start gap-4">
          <div className="flex w-full items-baseline justify-between gap-2">
            <LtrExamBoundary>
              <h2 data-testid="vocab-card-headword" className="text-3xl font-bold text-text-primary">
                {currentEntry.card.headword}
              </h2>
            </LtrExamBoundary>
            {currentEntry.card.ipa ? (
              <LtrExamBoundary>
                <span className="font-mono-exam text-sm text-text-tertiary">
                  {currentEntry.card.ipa}
                </span>
              </LtrExamBoundary>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-[var(--mz-radius-pill)] bg-canvas/70 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              {currentEntry.card.topicTag}
            </span>
            <span className="rounded-[var(--mz-radius-pill)] border border-border-subtle bg-surface-alt px-2.5 py-0.5 text-[11px] font-medium text-text-secondary">
              {t('vocabWhyThisWordPrefix')}:{' '}
              {currentEntry.card.sourceKind !== 'seeded'
                ? currentEntry.card.sourceKind.replace(/_/g, ' ')
                : `${currentEntry.card.cefrLevel ?? 'B2'} · ${currentEntry.card.canonicalTopic ?? currentEntry.card.topicTag}`}
            </span>
            <InlineListenButton
              text={currentEntry.card.headword}
              sourceContext="vocab"
              testId="vocab-review-listen-word"
              size="sm"
            />
            <button
              type="button"
              data-testid="vocab-review-practice-pronunciation"
              onClick={() => setPracticeOpen(true)}
              className="inline-flex h-7 items-center gap-1 rounded-[var(--mz-radius-compact)] border border-primary/50 bg-primary/10 px-2.5 text-[11px] font-semibold text-primary hover:bg-primary/20"
            >
              <Mic className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('vocabPracticePronunciationCta')}</span>
            </button>
          </div>

          {!isFlipped ? (
            <div className="mt-4 flex w-full justify-center">
              <MzButton
                variant="primary"
                size="lg"
                data-testid="vocab-reveal-btn"
                leadingIcon={<Eye className="h-4 w-4" aria-hidden="true" />}
                onClick={() => setIsFlipped(true)}
              >
                {t('vocabRevealAnswerAction')}
              </MzButton>
            </div>
          ) : (
            <div data-testid="vocab-card-back" className="mt-2 flex w-full flex-col gap-3 border-t border-border-subtle pt-4">
              <p className="text-base font-semibold text-text-primary">
                {currentEntry.card.definition}
              </p>
              {deps.edition === 'irn' && currentEntry.card.glossFa ? (
                <p className="text-sm font-bold text-primary">{currentEntry.card.glossFa}</p>
              ) : null}
              {currentEntry.card.contextSentence ? (
                <div className="flex flex-col gap-2">
                  <LtrExamBoundary>
                    <blockquote className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas/70 p-3 text-xs italic text-text-secondary">
                      {currentEntry.card.contextSentence}
                    </blockquote>
                  </LtrExamBoundary>
                  <div>
                    <InlineListenButton
                      text={currentEntry.card.contextSentence}
                      sourceContext="vocab"
                      testId="vocab-review-listen-sentence"
                      size="sm"
                    />
                  </div>
                </div>
              ) : null}

              {intervalPreviews ? (
                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {intervalPreviews.map((btn) => (
                    <button
                      key={btn.rating}
                      type="button"
                      data-testid={`vocab-rate-${btn.quality}`}
                      onClick={() => void handleRate(btn.rating)}
                      className="flex flex-col items-center rounded-[var(--mz-radius-control)] border border-border-subtle bg-canvas px-3 py-2.5 text-center transition-colors hover:border-primary hover:bg-surface-hover"
                    >
                      <span className="text-xs font-bold text-text-primary">
                        [{btn.shortcutKey}] {ratingLabelFor(btn.quality)}
                      </span>
                      <span className="mt-0.5 font-mono-exam text-[11px] text-primary">
                        {t('vocabIntervalDaysLabel', { days: btn.intervalDays })}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </MzCard>

      <SpeechPracticeDrawer
        open={practiceOpen}
        onClose={() => setPracticeOpen(false)}
        targetText={currentEntry.card.contextSentence || currentEntry.card.headword}
        practiceKind={currentEntry.card.contextSentence ? 'sentence' : 'word'}
        sourceRefType="vocab_card"
        sourceRefId={currentEntry.card.cardId}
        examTrack={currentEntry.card.examId}
      />
    </div>
  );
}
