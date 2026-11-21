import { Link } from '@tanstack/react-router';
import { BookmarkPlus, CheckCircle2, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MzCard } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { DroppedContentItem } from '@/gateways/linguistic.gateway';
import { useDeps } from '@/spa/deps';
import type { SupportedExamId } from '@mockza/domain';

export interface DropDrillScreenProps {
  readonly dropId: string;
}

export function DropDrillScreen({ dropId }: DropDrillScreenProps) {
  const deps = useDeps();
  const isRtl = deps.edition === 'irn';
  const [drop, setDrop] = useState<DroppedContentItem | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [clozeInput, setClozeInput] = useState('');
  const [savedHeadwords, setSavedHeadwords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void deps.linguistic.getDropById(dropId).then((res) => {
      if (res.ok) setDrop(res.value);
      setLoading(false);
    });
  }, [deps, dropId]);

  const handleSavePhrase = async (headword: string, defEn: string, glossFa?: string | null, example?: string) => {
    const now = deps.clock.nowMs();
    await deps.vocabStore.upsertMistakeCard({
      cardId: `drop-${dropId.slice(0, 8)}-${headword.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28)}`,
      examId: 'ielts_academic' as SupportedExamId,
      headword,
      ipa: null,
      definition: defEn,
      glossFa: glossFa ?? null,
      topicTag: drop?.detectedTopics[0] ?? 'drop_anything',
      sourceKind: 'drop_anything',
      tags: ['drop_anything'],
      contextSentence: example ?? null,
      paraphraseHints: [],
      usageNote: defEn,
      sourceSkill: drop?.inputKind === 'audio' ? 'listening' : 'reading',
      sourceAttemptId: dropId,
      sourceRefLabel: drop?.sourceDomainOrLabel ?? 'Drop Anything',
      createdAtMs: now,
      updatedAtMs: now,
    });
    setSavedHeadwords((prev) => (prev.includes(headword) ? prev : [...prev, headword]));
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl py-10 text-sm text-text-secondary">
        {isRtl ? 'در حال بارگذاری میکرودریل...' : 'Loading 2-Min Micro-Drill...'}
      </div>
    );
  }

  if (!drop) {
    return (
      <div className="mx-auto max-w-4xl py-10 text-sm text-text-secondary">
        {isRtl ? 'محتوای ارسالی پیدا نشد.' : 'Dropped content not found.'}
      </div>
    );
  }

  const clozeCorrect =
    clozeInput.trim().toLowerCase() === drop.drillPayload.clozeAnswer.trim().toLowerCase();

  return (
    <div data-testid="drop-drill-screen" className="mx-auto flex max-w-4xl flex-col gap-6 pb-10 text-start">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {drop.sourceDomainOrLabel} · CEFR {drop.cefrEstimate}
          </p>
          <LtrExamBoundary className="font-editorial mt-1 block text-3xl text-text-primary">
            {drop.title}
          </LtrExamBoundary>
        </div>
        <Link
          to="/drop"
          className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3 py-1.5 text-xs font-semibold text-primary hover:bg-surface-hover"
        >
          {isRtl ? 'ارسال محتوای جدید' : 'New Drop'}
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">
          {isRtl ? 'اصطلاحات استخراج‌شده برای سطح شما' : 'Extracted Natural Expressions'}
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {drop.extractedPhrases.map((p) => {
            const isSaved = savedHeadwords.includes(p.headword);
            return (
              <MzCard key={p.headword} variant="default">
                <div className="flex items-start justify-between gap-2">
                  <LtrExamBoundary className="font-mono-exam text-base font-bold text-primary">
                    {p.headword} {p.ipa ? <span className="ms-1 text-xs font-normal text-text-secondary">{p.ipa}</span> : null}
                  </LtrExamBoundary>
                  <button
                    type="button"
                    data-testid={`save-drop-phrase-${p.headword}`}
                    disabled={isSaved}
                    onClick={() =>
                      void handleSavePhrase(p.headword, p.definitionEn, p.glossFa, p.exampleSentence)
                    }
                    className="inline-flex items-center gap-1 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-2.5 py-1 text-[11px] font-semibold text-primary disabled:opacity-60"
                  >
                    {isSaved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
                    <span>{isSaved ? (isRtl ? 'در دِک ذخیره شد' : 'Saved') : isRtl ? 'افزودن به SM-2' : 'Save SM-2'}</span>
                  </button>
                </div>
                <LtrExamBoundary className="mt-1.5 block text-xs text-text-primary">
                  {p.definitionEn}
                </LtrExamBoundary>
                {isRtl && p.glossFa ? (
                  <p className="mt-1 text-xs font-medium text-primary">{p.glossFa}</p>
                ) : null}
                <LtrExamBoundary className="mt-2 block rounded bg-bg-raised p-2 text-xs italic text-text-secondary">
                  “{p.exampleSentence}”
                </LtrExamBoundary>
              </MzCard>
            );
          })}
        </div>
      </section>

      <MzCard variant="hero" data-testid="drop-2min-drill-card">
        <h2 className="text-sm font-semibold text-text-primary">
          {isRtl ? 'میکرودریل ۲ دقیقه‌ای فعال' : '2-Minute Active Micro-Drill'}
        </h2>

        <div className="mt-4 space-y-5">
          <div>
            <p className="text-xs font-semibold text-text-secondary">
              {isRtl ? '۱. درک مطلب سریع' : '1. Comprehension Check'}
            </p>
            <LtrExamBoundary className="mt-1 block text-sm font-medium text-text-primary">
              {drop.drillPayload.comprehensionPrompt}
            </LtrExamBoundary>
            <div className="mt-2 flex flex-col gap-2">
              {drop.drillPayload.comprehensionOptions.map((opt, idx) => {
                const picked = selectedIdx === idx;
                const isRight = idx === drop.drillPayload.correctOptionIndex;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSelectedIdx(idx)}
                    className={`rounded-[var(--mz-radius-compact)] border px-3 py-2 text-start text-xs ${
                      picked
                        ? isRight
                          ? 'border-success bg-mint-bg font-semibold text-success'
                          : 'border-danger bg-danger/10 text-danger'
                        : 'border-border-subtle bg-bg-surface text-text-primary hover:bg-surface-hover'
                    }`}
                  >
                    <LtrExamBoundary>{opt}</LtrExamBoundary>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-text-secondary">
              {isRtl ? '۲. بازگویی و جای‌گذاری ساختار' : '2. Paraphrase Recall'}
            </p>
            <LtrExamBoundary className="mt-1 block text-sm text-text-primary">
              {drop.drillPayload.clozeSentence}
            </LtrExamBoundary>
            <input
              type="text"
              dir="ltr"
              value={clozeInput}
              onChange={(e) => setClozeInput(e.target.value)}
              placeholder="Type missing expression..."
              className="mt-2 h-9 w-full max-w-sm rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-surface px-3 text-xs text-text-primary"
            />
            {clozeCorrect ? (
              <span className="ms-2 inline-flex items-center gap-1 text-xs font-semibold text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> Exact match!
              </span>
            ) : null}
          </div>

          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
              <Volume2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span>{isRtl ? '۳. سایه‌گویی (Shadowing)' : '3. Aloud Shadowing Prompt'}</span>
            </p>
            <LtrExamBoundary className="mt-1 block rounded bg-bg-raised p-2.5 text-sm text-text-primary">
              {drop.drillPayload.shadowingPrompt}
            </LtrExamBoundary>
          </div>
        </div>
      </MzCard>
    </div>
  );
}
