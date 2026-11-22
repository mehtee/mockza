import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, Mic } from 'lucide-react';
import { useEffect, useState } from 'react';
import { InlineListenButton } from '@/components/speech/InlineListenButton';
import { SpeechPracticeDrawer } from '@/components/speech/SpeechPracticeDrawer';
import { MzBanner, MzButton, MzCard } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { formatSerialDay } from '@/edition/calendar/jalali-edge';
import type { VocabCardWithSrs } from '@/gateways/storage.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';

export interface VocabWordDetailScreenProps {
  readonly wordId: string;
}

export function VocabWordDetailScreen({ wordId }: VocabWordDetailScreenProps) {
  const deps = useDeps();
  const t = createTranslator(deps.edition);

  const BackIcon = deps.edition === 'irn' ? ArrowRight : ArrowLeft;
  const [entry, setEntry] = useState<VocabCardWithSrs | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    void deps.vocabStore.getAllCards().then((res) => {
      if (!mounted) return;
      if (res.ok) {
        const match = res.value.find(
          (c) => c.card.cardId === wordId || c.card.headword.toLowerCase() === wordId.toLowerCase(),
        );
        if (match) {
          setEntry(match);
        } else {
          setNotFound(true);
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, [deps.vocabStore, wordId]);

  if (!entry) {
    return (
      <div data-testid="vocab-word-detail-screen" className="p-6 text-sm text-text-secondary">
        {notFound ? <MzBanner tone="warning">Vocabulary card not found.</MzBanner> : 'Loading word...'}
      </div>
    );
  }

  const { card, srs } = entry;

  return (
    <div data-testid="vocab-word-detail-screen" className="mx-auto flex max-w-3xl flex-col gap-5 pb-12 text-start">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-primary">{t('vocabWordDetailTitle')}</p>
        <Link
          to="/vocabulary"
          className="inline-flex h-8 items-center gap-1 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3 text-xs font-semibold text-text-primary hover:bg-surface-hover"
        >
          <BackIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t('vocabBackToHubAction')}</span>
        </Link>
      </div>

      <MzCard variant="hero">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <LtrExamBoundary>
            <h1 className="text-3xl font-bold text-text-primary">{card.headword}</h1>
            {card.ipa ? <p className="mt-1 font-mono-exam text-sm text-text-tertiary">{card.ipa}</p> : null}
          </LtrExamBoundary>
          <div className="flex flex-wrap items-center gap-2">
            <InlineListenButton
              text={card.headword}
              sourceContext="vocab"
              testId="vocab-detail-listen-headword"
              size="sm"
            />
            <MzButton
              variant="primary"
              size="sm"
              data-testid="vocab-detail-practice-btn"
              onClick={() => setPracticeOpen(true)}
              leadingIcon={<Mic className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              {t('vocabPracticePronunciationCta')}
            </MzButton>
          </div>
        </div>
        <p className="mt-3 text-sm text-text-primary">{card.definition}</p>
        {deps.edition === 'irn' && card.glossFa ? (
          <p className="mt-2 text-base font-bold text-primary">{card.glossFa}</p>
        ) : null}
        {card.contextSentence ? (
          <div className="mt-4 space-y-2">
            <LtrExamBoundary>
              <blockquote className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas/70 p-3 text-xs italic text-text-secondary">
                {card.contextSentence}
              </blockquote>
            </LtrExamBoundary>
            <InlineListenButton
              text={card.contextSentence}
              sourceContext="vocab"
              testId="vocab-detail-listen-sentence"
              size="sm"
            />
          </div>
        ) : null}
      </MzCard>

      <div className="grid gap-4 md:grid-cols-2">
        <MzCard variant="default">
          <h2 className="text-sm font-bold text-text-primary">{t('vocabParaphrasesTitle')}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {card.paraphraseHints.map((hint) => (
              <span
                key={hint}
                className="rounded-[var(--mz-radius-pill)] border border-border-subtle bg-bg-raised px-3 py-1 text-xs text-text-primary"
              >
                <LtrExamBoundary>{hint}</LtrExamBoundary>
              </span>
            ))}
          </div>
          {card.usageNote ? (
            <p className="mt-3 text-xs text-text-secondary">{card.usageNote}</p>
          ) : null}
        </MzCard>

        <MzCard variant="default" data-testid="vocab-srs-schedule-card">
          <h2 className="text-sm font-bold text-text-primary">{t('vocabSrsScheduleTitle')}</h2>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-text-tertiary">State</dt>
              <dd className="font-semibold text-primary uppercase">{srs.state}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">Repetitions</dt>
              <dd className="font-mono-exam font-semibold text-text-primary">{srs.repetitions}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">Interval</dt>
              <dd className="font-mono-exam font-semibold text-text-primary">
                {t('vocabIntervalDaysLabel', { days: srs.intervalDays })}
              </dd>
            </div>
            <div>
              <dt className="text-text-tertiary">Next Due</dt>
              <dd className="font-mono-exam font-semibold text-text-primary">
                {formatSerialDay(srs.dueSerialDay, deps.edition)}
              </dd>
            </div>
          </dl>
        </MzCard>
      </div>

      <SpeechPracticeDrawer
        open={practiceOpen}
        onClose={() => setPracticeOpen(false)}
        targetText={card.contextSentence || card.headword}
        practiceKind={card.contextSentence ? 'sentence' : 'word'}
        sourceRefType="vocab_card"
        sourceRefId={card.cardId}
        examTrack={card.examId}
      />
    </div>
  );
}
