import { scheduleSm2Review, type ReviewQuality } from '@mockza/domain';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, CheckCircle2, Eye } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MzButton, MzCard } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { VocabCardWithSrs, VocabReviewRating } from '@/gateways/storage.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';

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

  useEffect(() => {
    let mounted = true;
    const todaySerial = deps.clock.todaySerialDay();

    async function hydrate() {
      const dueRes = await deps.vocabStore.getDueCards(todaySerial, 100);
      if (!mounted) return;
      if (dueRes.ok && dueRes.value.length > 0) {
        setQueue(dueRes.value);
        setLoading(false);
        return;
      }
      const aheadRes = await deps.vocabStore.getAheadCards(25, todaySerial);
      if (!mounted) return;
      if (aheadRes.ok) {
        setQueue(aheadRes.value);
      }
      setLoading(false);
    }
    void hydrate();
    return () => {
      mounted = false;
    };
  }, [deps.clock, deps.vocabStore]);

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

      await deps.vocabStore.recordReview({
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

      setReviewedCount((c) => c + 1);
      setIsFlipped(false);
      setCurrentIndex((idx) => idx + 1);
    },
    [currentEntry, deps.attemptStore, deps.clock, deps.vocabStore],
  );

  // Keyboard shortcuts: Space flips card, 1-4 rates recall
  useEffect(() => {
    if (!currentEntry) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      if (event.code === 'Space' || event.key === ' ') {
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
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--mz-radius-control)] bg-primary px-4 text-xs font-semibold text-on-primary hover:bg-primary-strong"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
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

          <span className="rounded-[var(--mz-radius-pill)] bg-canvas/70 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            {currentEntry.card.topicTag}
          </span>

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
                <LtrExamBoundary>
                  <blockquote className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas/70 p-3 text-xs italic text-text-secondary">
                    {currentEntry.card.contextSentence}
                  </blockquote>
                </LtrExamBoundary>
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
    </div>
  );
}
