import {
  countObjectiveWords,
  normalizeObjectiveQuestionType,
  type ObjectiveQuestionType,
  parseObjectiveChoiceOption,
} from '@mockza/domain';
import { Check } from 'lucide-react';
import { useEffect } from 'react';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { getActiveEditionCode } from '@/edition/edition-config';
import { createTranslator } from '@/i18n';
import { useOptionalDeps } from '@/spa/deps';
import { MzSequenceOrderControl } from './MzSequenceOrderControl';

export interface ObjectiveQuestionInputSpec {
  readonly questionId: string;
  readonly number: number;
  readonly questionType: ObjectiveQuestionType | string;
  readonly prompt: string;
  readonly options?: readonly string[];
  readonly acceptedVariants?: readonly string[];
  readonly maxWords?: number;
}

export interface MzObjectiveAnswerInputProps {
  readonly question: ObjectiveQuestionInputSpec;
  readonly value: string;
  readonly onChange: (nextValue: string) => void;
  readonly disabled?: boolean;
  readonly enableNumberShortcuts?: boolean;
  readonly spellCheck?: boolean;
}

export function toggleMultiChoiceValue(currentValue: string, optionValue: string): string {
  const existing = currentValue
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const set = new Set(existing);
  if (set.has(optionValue)) {
    set.delete(optionValue);
  } else {
    set.add(optionValue);
  }
  return Array.from(set).sort().join(', ');
}

export function MzObjectiveAnswerInput({
  question,
  value,
  onChange,
  disabled = false,
  enableNumberShortcuts = false,
  spellCheck = false,
}: MzObjectiveAnswerInputProps) {
  const deps = useOptionalDeps();
  const edition = deps?.edition ?? getActiveEditionCode();
  const t = createTranslator(edition);

  const canonicalType = normalizeObjectiveQuestionType(question.questionType);
  const options = question.options ?? [];
  const acceptedVariants = question.acceptedVariants ?? [];

  const binaryLabels: readonly string[] | null =
    canonicalType === 'tfng'
      ? ['TRUE', 'FALSE', 'NOT GIVEN']
      : canonicalType === 'ynng'
        ? ['YES', 'NO', 'NOT GIVEN']
        : canonicalType === 'binary_choice'
          ? options.length > 0
            ? options
            : ['REAL', 'NOT REAL']
          : null;

  const isChoiceWithOptions =
    binaryLabels === null && canonicalType !== 'reorder_sequence' && options.length > 0;

  useEffect(() => {
    if (!enableNumberShortcuts || disabled) return;
    if (binaryLabels === null && !isChoiceWithOptions) return;

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const numeric = Number(event.key);
      if (!Number.isInteger(numeric) || numeric < 1) return;
      const index = numeric - 1;

      if (binaryLabels !== null) {
        const picked = binaryLabels[index];
        if (picked !== undefined) {
          event.preventDefault();
          onChange(picked);
        }
        return;
      }

      if (isChoiceWithOptions) {
        const rawOpt = options[index];
        if (rawOpt === undefined) return;
        const parsed = parseObjectiveChoiceOption({
          questionType: canonicalType,
          rawOption: rawOpt,
          index,
          acceptedVariants,
        });
        event.preventDefault();
        if (canonicalType === 'mcq_multi') {
          onChange(toggleMultiChoiceValue(value, parsed.value));
        } else {
          onChange(parsed.value);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    acceptedVariants,
    binaryLabels,
    canonicalType,
    disabled,
    enableNumberShortcuts,
    isChoiceWithOptions,
    onChange,
    options,
    value,
  ]);

  if (binaryLabels !== null) {
    return (
      <LtrExamBoundary>
        <div
          data-testid={`objective-input-${question.number}`}
          data-question-type={canonicalType}
          role="radiogroup"
          aria-label={question.prompt}
          className="flex flex-wrap gap-2"
        >
          {binaryLabels.map((label, idx) => {
            const selected = value.trim().toUpperCase() === label.trim().toUpperCase();
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                data-testid={`choice-${question.number}-${label}`}
                onClick={() => onChange(label)}
                className={[
                  'inline-flex items-center gap-2 rounded-[var(--mz-radius-pill)] border px-4 py-2 text-xs font-semibold transition-colors',
                  selected
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-border-subtle bg-bg-raised text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                ].join(' ')}
              >
                {enableNumberShortcuts ? (
                  <kbd className="rounded bg-canvas/20 px-1.5 py-0.5 font-mono-exam text-[10px]">
                    {idx + 1}
                  </kbd>
                ) : null}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </LtrExamBoundary>
    );
  }

  if (canonicalType === 'reorder_sequence' && options.length > 0) {
    return (
      <div data-testid={`objective-input-${question.number}`} data-question-type={canonicalType}>
        <MzSequenceOrderControl
          options={options}
          currentValue={value}
          onChanged={onChange}
          disabled={disabled}
        />
      </div>
    );
  }

  if (options.length > 0) {
    const isMulti = canonicalType === 'mcq_multi';
    const selectedSet = new Set(
      value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );

    return (
      <LtrExamBoundary>
        <div
          data-testid={`objective-input-${question.number}`}
          data-question-type={canonicalType}
          className="flex flex-col gap-2"
        >
          {isMulti ? (
            <p className="text-xs text-text-secondary">{t('examKitSelectMultipleHint')}</p>
          ) : null}

          <div
            role={isMulti ? 'group' : 'radiogroup'}
            aria-label={question.prompt}
            className="flex flex-col gap-2"
          >
            {options.map((rawOpt, index) => {
              const parsed = parseObjectiveChoiceOption({
                questionType: canonicalType,
                rawOption: rawOpt,
                index,
                acceptedVariants,
              });
              const isSelected = isMulti
                ? selectedSet.has(parsed.value) ||
                  selectedSet.has(parsed.label) ||
                  selectedSet.has(rawOpt)
                : value === parsed.value || value === parsed.label || value === rawOpt;

              return (
                <button
                  key={`${parsed.label}-${index}`}
                  type="button"
                  role={isMulti ? 'checkbox' : 'radio'}
                  aria-checked={isSelected}
                  disabled={disabled}
                  data-testid={`choice-${question.number}-${parsed.value}`}
                  onClick={() =>
                    isMulti
                      ? onChange(toggleMultiChoiceValue(value, parsed.value))
                      : onChange(parsed.value)
                  }
                  className={[
                    'flex items-center justify-between gap-3 rounded-[var(--mz-radius-control)] border px-3.5 py-2.5 text-start text-sm transition-colors',
                    isSelected
                      ? 'border-primary bg-surface-alt text-text-primary'
                      : 'border-border-subtle bg-bg-raised text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                  ].join(' ')}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={[
                        'inline-flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded border px-1.5 font-mono-exam text-xs font-bold',
                        isSelected
                          ? 'border-primary bg-primary text-on-primary'
                          : 'border-border-strong bg-surface-alt text-text-primary',
                      ].join(' ')}
                    >
                      {parsed.label}
                    </span>
                    <span className="min-w-0 text-start">{parsed.displayText}</span>
                  </span>

                  {isSelected ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </LtrExamBoundary>
    );
  }

  // Free text entry: summary_gap_fill, short_answer, word_completion, dictation
  const maxWords =
    question.maxWords ?? (canonicalType === 'dictation' ? 25 : 3);
  const usedWords = countObjectiveWords(value);
  const overWordLimit = canonicalType !== 'dictation' && usedWords > maxWords;

  const placeholder =
    canonicalType === 'word_completion'
      ? t('examKitTypeWordHint')
      : canonicalType === 'dictation'
        ? t('examKitTranscribeHint')
        : t('examKitTypeAnswerHint');

  return (
    <div
      data-testid={`objective-input-${question.number}`}
      data-question-type={canonicalType}
      className="flex flex-col gap-1.5"
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={overWordLimit ? 'font-semibold text-error' : 'text-text-secondary'}>
          {overWordLimit
            ? t('examKitWordLimitExceeded', { used: usedWords, max: maxWords })
            : canonicalType === 'dictation'
              ? t('examKitTranscribeHint')
              : t('examKitMaxWordsLimit', { count: maxWords })}
        </span>
      </div>

      <LtrExamBoundary>
        {canonicalType === 'dictation' ? (
          <textarea
            rows={3}
            dir="ltr"
            data-testid={`text-answer-${question.number}`}
            value={value}
            disabled={disabled}
            spellCheck={spellCheck}
            autoComplete="off"
            autoCorrect="off"
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-[var(--mz-radius-control)] border border-border-subtle bg-bg-raised px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none"
          />
        ) : (
          <input
            type="text"
            dir="ltr"
            data-testid={`text-answer-${question.number}`}
            value={value}
            disabled={disabled}
            spellCheck={spellCheck}
            autoComplete="off"
            autoCorrect="off"
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            className="h-10 w-full rounded-[var(--mz-radius-control)] border border-border-subtle bg-bg-raised px-3.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none"
          />
        )}
      </LtrExamBoundary>
    </div>
  );
}
