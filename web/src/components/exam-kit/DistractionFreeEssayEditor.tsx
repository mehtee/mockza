import { CheckCircle2, Lock } from 'lucide-react';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { getActiveEditionCode } from '@/edition/edition-config';
import { createTranslator } from '@/i18n';
import { useOptionalDeps } from '@/spa/deps';

export interface DistractionFreeEssayEditorProps {
  readonly value: string;
  readonly onChange: (nextValue: string) => void;
  readonly examMode?: 'exam' | 'study';
  readonly minWords?: number;
  readonly maxWords?: number | null;
  readonly requiresSingleSentence?: boolean;
  readonly disabled?: boolean;
  readonly draftSaved?: boolean;
  readonly placeholder?: string;
}

export function countEssayWords(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

export function countEssaySentences(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return 0;
  const parts = trimmed
    .split(/[.!?]+(?:\s|$)/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return Math.max(1, parts.length);
}

export function DistractionFreeEssayEditor({
  value,
  onChange,
  examMode = 'exam',
  minWords = 150,
  maxWords = null,
  requiresSingleSentence = false,
  disabled = false,
  draftSaved = false,
  placeholder,
}: DistractionFreeEssayEditorProps) {
  const deps = useOptionalDeps();
  const edition = deps?.edition ?? getActiveEditionCode();
  const t = createTranslator(edition);

  const wordCount = countEssayWords(value);
  const sentenceCount = countEssaySentences(value);
  const isExamLocked = examMode === 'exam';
  const meetsMinWords = wordCount >= minWords;
  const exceedsMaxWords = maxWords !== null && wordCount > maxWords;
  const violatesSingleSentence = requiresSingleSentence && sentenceCount > 1;
  const progressPercent = minWords > 0 ? Math.min(100, Math.round((wordCount / minWords) * 100)) : 100;

  return (
    <div data-testid="distraction-free-essay-editor" className="flex h-full flex-col gap-3">
      {/* Status & Word/Sentence Rule Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3.5 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span
            data-testid="essay-word-count"
            className={[
              'font-semibold',
              exceedsMaxWords
                ? 'text-error'
                : meetsMinWords
                  ? 'text-success'
                  : 'text-text-primary',
            ].join(' ')}
          >
            {t('essayWordsCountLabel', { count: wordCount })}
          </span>

          {minWords > 0 ? (
            <span className="text-text-secondary">
              {t('essayMinWordsTarget', { min: minWords })}
            </span>
          ) : null}

          {maxWords !== null ? (
            <span className={exceedsMaxWords ? 'font-semibold text-error' : 'text-text-secondary'}>
              {t('essayMaxWordsTarget', { max: maxWords })}
            </span>
          ) : null}

          {requiresSingleSentence ? (
            <span
              data-testid="essay-sentence-rule"
              className={
                violatesSingleSentence ? 'font-semibold text-error' : 'text-success font-medium'
              }
            >
              {violatesSingleSentence
                ? t('essaySingleSentenceRule', { count: sentenceCount })
                : t('essaySingleSentenceOk')}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2.5">
          {draftSaved ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t('essayDraftSavedLabel')}
            </span>
          ) : null}
          {isExamLocked ? (
            <span
              data-testid="essay-spellcheck-locked-badge"
              className="inline-flex items-center gap-1 rounded-[var(--mz-radius-pill)] border border-border-subtle bg-surface-alt px-2 py-0.5 text-[11px] font-medium text-text-secondary"
            >
              <Lock className="h-3 w-3" aria-hidden="true" />
              {t('essaySpellcheckLockedBadge')}
            </span>
          ) : null}
        </div>
      </div>

      {/* Min-word Progress Strip */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
        <div
          className={[
            'h-full rounded-full transition-all',
            exceedsMaxWords ? 'bg-error' : meetsMinWords ? 'bg-success' : 'bg-primary',
          ].join(' ')}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Isolated English Essay Textarea */}
      <LtrExamBoundary className="min-h-0 flex-1 flex flex-col">
        <textarea
          dir="ltr"
          data-testid="essay-editor-textarea"
          value={value}
          disabled={disabled}
          spellCheck={!isExamLocked}
          autoComplete={isExamLocked ? 'off' : 'on'}
          autoCorrect={isExamLocked ? 'off' : 'on'}
          autoCapitalize={isExamLocked ? 'off' : 'sentences'}
          data-gramm={isExamLocked ? 'false' : undefined}
          data-gramm_editor={isExamLocked ? 'false' : undefined}
          data-enable-grammarly={isExamLocked ? 'false' : undefined}
          data-lt-active={isExamLocked ? 'false' : undefined}
          placeholder={placeholder ?? 'Write your response here...'}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-[320px] w-full flex-1 resize-none rounded-[var(--mz-radius-control)] border border-border-subtle bg-bg-raised p-4 text-[15px] leading-[1.7] text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none"
        />
      </LtrExamBoundary>
    </div>
  );
}
