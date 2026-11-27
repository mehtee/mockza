import { checkClozeAnswer, type SupportedExamId } from '@mockza/domain';
import { Link } from '@tanstack/react-router';
import { BookmarkPlus, CheckCircle2, HelpCircle, Mic, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SpeechPracticeDrawer } from '@/components/speech/SpeechPracticeDrawer';
import { MzCard } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { DroppedContentItem } from '@/gateways/linguistic.gateway';
import { recordCoachStudyActivity } from '@/spa/coach-activity';
import { useDeps } from '@/spa/deps';
import { speakEnglishPhrase, stopEnglishSpeech } from '@/components/speech-tts';

export interface DropDrillScreenProps {
  readonly dropId: string;
}

function buildClozeHint(answer: string): string {
  return answer
    .trim()
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w : `${w[0]}${'_'.repeat(w.length - 1)}`))
    .join(' ');
}

export function DropDrillScreen({ dropId }: DropDrillScreenProps) {
  const deps = useDeps();
  const isRtl = deps.edition === 'irn';
  const [examId, setExamId] = useState<SupportedExamId>('ielts_academic');
  const [drop, setDrop] = useState<DroppedContentItem | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [clozeInput, setClozeInput] = useState('');
  const [showClozeHint, setShowClozeHint] = useState(false);
  const [showClozeAnswer, setShowClozeAnswer] = useState(false);
  const [drillCompleted, setDrillCompleted] = useState(false);
  const [savedHeadwords, setSavedHeadwords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [practiceOpen, setPracticeOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([
      deps.attemptStore.getUserProfile(),
      deps.linguistic.getDropById(dropId),
    ]).then(([profileRes, dropRes]) => {
      if (!active) return;
      if (profileRes.ok && profileRes.value) setExamId(profileRes.value.examId);
      if (dropRes.ok) setDrop(dropRes.value);
      setLoading(false);
    });
    return () => {
      active = false;
      stopEnglishSpeech();
    };
  }, [deps, dropId]);

  const handleSavePhrase = async (headword: string, defEn: string, glossFa?: string | null, example?: string) => {
    const now = deps.clock.nowMs();
    await deps.vocabStore.upsertMistakeCard({
      cardId: `drop-${dropId.slice(0, 8)}-${headword.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28)}`,
      examId,
      headword,
      ipa: null,
      definition: defEn,
      glossFa: glossFa ?? null,
      topicTag: drop?.detectedTopics[0] ?? 'drop_anything',
      sourceKind: 'drop_anything',
      tags: ['drop_anything', examId],
      contextSentence: example ?? null,
      paraphraseHints: [],
      usageNote: defEn,
      sourceSkill: drop?.inputKind === 'audio' ? 'listening' : 'reading',
      sourceAttemptId: dropId,
      sourceRefLabel: drop?.sourceDomainOrLabel ?? 'Learn From Anything',
      createdAtMs: now,
      updatedAtMs: now,
    });
    setSavedHeadwords((prev) => (prev.includes(headword) ? prev : [...prev, headword]));
  };

  if (loading) {
    return (
      <div
        data-testid="drop-drill-loading"
        className="mx-auto w-full max-w-6xl py-10 text-sm text-text-secondary"
      >
        {isRtl ? 'در حال بارگذاری تمرین...' : 'Loading Quick Practice...'}
      </div>
    );
  }

  if (!drop) {
    return (
      <div
        data-testid="drop-drill-screen"
        className="mx-auto w-full max-w-6xl py-10 text-sm text-text-secondary"
      >
        {isRtl ? 'محتوای ارسالی پیدا نشد.' : 'Study material not found.'}
      </div>
    );
  }

  const clozeCorrect = checkClozeAnswer(clozeInput, drop.drillPayload.clozeAnswer);
  const compDone = selectedIdx !== null;

  return (
    <div data-testid="drop-drill-screen" className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10 text-start">
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
          {isRtl ? 'ارسال محتوای جدید' : 'Add Another Source'}
        </Link>
      </header>

      {/* 4-Step Progress Strip */}
      <div className="grid grid-cols-4 gap-2 text-[11px] font-semibold">
        {(
          [
            { label: isRtl ? '۱. اصطلاحات' : '1. Phrases', done: savedHeadwords.length > 0 },
            { label: isRtl ? '۲. درک مطلب' : '2. Comprehend', done: compDone },
            { label: isRtl ? '۳. جای‌گذاری' : '3. Fill Blank', done: clozeCorrect },
            { label: isRtl ? '۴. سایه‌گویی' : '4. Say Aloud', done: drillCompleted },
          ] as const
        ).map((s) => (
          <div
            key={s.label}
            className={`rounded-[var(--mz-radius-compact)] border px-2 py-1.5 text-center ${
              s.done
                ? 'border-success/50 bg-tint text-success'
                : 'border-border-subtle bg-bg-raised text-text-secondary'
            }`}
          >
            {s.done ? '✓ ' : ''}
            {s.label}
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">
          {isRtl ? 'اصطلاحات استخراج‌شده برای سطح شما' : 'Key Expressions Extracted for Your Level'}
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {drop.extractedPhrases.map((p) => {
            const isSaved = savedHeadwords.includes(p.headword);
            return (
              <MzCard key={p.headword} variant="default">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <LtrExamBoundary className="font-mono-exam text-base font-bold text-primary">
                    {p.headword} {p.ipa ? <span className="ms-1 text-xs font-normal text-text-secondary">{p.ipa}</span> : null}
                  </LtrExamBoundary>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => speakEnglishPhrase(`${p.headword}. ${p.exampleSentence}`, { rate: 1.0 })}
                      className="inline-flex h-7 items-center gap-1 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-2 text-[11px] font-semibold text-text-secondary hover:border-primary hover:text-primary"
                    >
                      <Volume2 className="h-3 w-3" aria-hidden="true" />
                      <span>1.0x</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => speakEnglishPhrase(`${p.headword}. ${p.exampleSentence}`, { rate: 0.8 })}
                      className="inline-flex h-7 items-center rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-2 text-[11px] font-semibold text-text-secondary hover:border-primary hover:text-primary"
                    >
                      0.8x
                    </button>
                    <button
                      type="button"
                      data-testid={`save-drop-phrase-${p.headword}`}
                      disabled={isSaved}
                      onClick={() =>
                        void handleSavePhrase(p.headword, p.definitionEn, p.glossFa, p.exampleSentence)
                      }
                      className="inline-flex h-7 items-center gap-1 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-2.5 text-[11px] font-semibold text-primary disabled:opacity-60"
                    >
                      {isSaved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
                      <span>
                        {isSaved
                          ? isRtl
                            ? 'در دفترچه ذخیره شد'
                            : 'Saved to Vocab Deck'
                          : isRtl
                            ? 'افزودن به دفترچه واژگان'
                            : 'Save to Vocab Deck'}
                      </span>
                    </button>
                  </div>
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
          {isRtl ? 'تمرین ۲ دقیقه‌ای فعال' : '2-Minute Active Quiz'}
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
            {compDone &&
            (drop.drillPayload.comprehensionExplanationEn || drop.drillPayload.comprehensionExplanationFa) ? (
              <p className="mt-2 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-surface p-2.5 text-xs text-text-secondary">
                {isRtl && drop.drillPayload.comprehensionExplanationFa
                  ? drop.drillPayload.comprehensionExplanationFa
                  : drop.drillPayload.comprehensionExplanationEn}
              </p>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-semibold text-text-secondary">
              {isRtl ? '۲. بازگویی و جای‌گذاری ساختار' : '2. Fill in the Blank'}
            </p>
            <LtrExamBoundary className="mt-1 block text-sm text-text-primary">
              {drop.drillPayload.clozeSentence}
            </LtrExamBoundary>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="text"
                dir="ltr"
                data-testid="drop-cloze-input"
                value={clozeInput}
                onChange={(e) => setClozeInput(e.target.value)}
                placeholder="Type missing expression..."
                className="h-9 w-full max-w-sm rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-surface px-3 text-xs text-text-primary"
              />
              <button
                type="button"
                data-testid="drop-cloze-hint-btn"
                onClick={() => setShowClozeHint((v) => !v)}
                className="inline-flex h-9 items-center gap-1 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-2.5 text-xs font-semibold text-text-secondary hover:text-primary"
              >
                <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isRtl ? 'راهنما' : 'Hint'}</span>
              </button>
              <button
                type="button"
                data-testid="drop-cloze-reveal-btn"
                onClick={() => setShowClozeAnswer((v) => !v)}
                className="inline-flex h-9 items-center rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-2.5 text-xs font-semibold text-text-secondary hover:text-primary"
              >
                {isRtl ? 'نمایش پاسخ' : 'Show Answer'}
              </button>
              {clozeCorrect ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {isRtl ? 'آفرین، درست است!' : 'Correct match!'}
                </span>
              ) : null}
            </div>
            {showClozeHint && !clozeCorrect ? (
              <p className="mt-1.5 font-mono text-xs text-primary">
                Hint: <LtrExamBoundary>{buildClozeHint(drop.drillPayload.clozeAnswer)}</LtrExamBoundary>
              </p>
            ) : null}
            {showClozeAnswer ? (
              <p className="mt-1.5 text-xs font-semibold text-text-primary">
                {isRtl ? 'پاسخ:' : 'Answer:'}{' '}
                <LtrExamBoundary className="font-mono text-primary">
                  {drop.drillPayload.clozeAnswer}
                </LtrExamBoundary>
              </p>
            ) : null}
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <Volume2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span>{isRtl ? '۳. تکرار با صدای بلند (Shadowing)' : '3. Say It Aloud (Shadowing)'}</span>
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => speakEnglishPhrase(drop.drillPayload.shadowingPrompt, { rate: 1.0 })}
                  className="inline-flex h-7 items-center gap-1 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-2 text-[11px] font-semibold text-text-primary hover:border-primary"
                >
                  <Volume2 className="h-3 w-3" aria-hidden="true" />
                  <span>1.0x</span>
                </button>
                <button
                  type="button"
                  onClick={() => speakEnglishPhrase(drop.drillPayload.shadowingPrompt, { rate: 0.8 })}
                  className="inline-flex h-7 items-center rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-2 text-[11px] font-semibold text-text-secondary hover:border-primary"
                >
                  0.8x
                </button>
                <button
                  type="button"
                  data-testid="drop-shadow-practice-btn"
                  onClick={() => setPracticeOpen(true)}
                  className="inline-flex h-7 items-center gap-1 rounded-[var(--mz-radius-compact)] border border-primary/50 bg-primary/10 px-2 text-[11px] font-semibold text-primary hover:bg-primary/20"
                >
                  <Mic className="h-3 w-3" aria-hidden="true" />
                  <span>{isRtl ? 'ضبط و تحلیل' : 'Practice'}</span>
                </button>
              </div>
            </div>
            <LtrExamBoundary className="mt-1 block rounded bg-bg-raised p-2.5 text-sm text-text-primary">
              {drop.drillPayload.shadowingPrompt}
            </LtrExamBoundary>

            <SpeechPracticeDrawer
              open={practiceOpen}
              onClose={() => setPracticeOpen(false)}
              targetText={drop.drillPayload.shadowingPrompt}
              practiceKind="sentence"
              sourceRefType="coach"
              sourceRefId={drop.dropId}
              examTrack={examId}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
            {!drillCompleted ? (
              <button
                type="button"
                data-testid="drop-complete-btn"
                onClick={() => {
                  setDrillCompleted(true);
                  void recordCoachStudyActivity(deps, 150, 1);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-[var(--mz-radius-compact)] bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-pressed"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>
                  {isRtl ? 'تکمیل تمرین و ثبت در کارنامه روزانه' : 'I Practised Aloud — Finish Quiz'}
                </span>
              </button>
            ) : (
              <div data-testid="drop-completion-summary" className="flex flex-wrap items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-success">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {isRtl
                    ? 'عالی! فعالیت امروز در روند روزانه شما ثبت شد.'
                    : 'Nice work! Logged to your daily streak & activity.'}
                </span>
                <Link to="/coach" className="font-semibold text-primary hover:underline">
                  {isRtl ? 'بازگشت به مربی هوشمند' : 'Back to Smart Coach'}
                </Link>
                <Link to="/vocabulary" className="font-semibold text-primary hover:underline">
                  {isRtl ? 'مرور دفترچه واژگان' : 'Review Vocab Deck'}
                </Link>
              </div>
            )}
          </div>
        </div>
      </MzCard>
    </div>
  );
}
