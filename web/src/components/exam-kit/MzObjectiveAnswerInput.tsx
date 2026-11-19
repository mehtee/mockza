import {
  countObjectiveWords,
  normalizeObjectiveQuestionType,
  type ObjectiveQuestionType,
  parseObjectiveChoiceOption,
} from '@mockza/domain';
import { Check } from 'lucide-react';
import { type ReactElement, useEffect } from 'react';
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

type MzTranslator = ReturnType<typeof createTranslator>;

interface ObjectiveRendererContext {
  readonly canonicalType: ObjectiveQuestionType;
  readonly question: ObjectiveQuestionInputSpec;
  readonly value: string;
  readonly onChange: (nextValue: string) => void;
  readonly disabled: boolean;
  readonly enableNumberShortcuts: boolean;
  readonly spellCheck: boolean;
  readonly t: MzTranslator;
}

type ObjectiveRendererFn = (ctx: ObjectiveRendererContext) => ReactElement;

function getBinaryLabels(canonicalType: ObjectiveQuestionType, options: readonly string[]): readonly string[] {
  if (canonicalType === 'tfng') return ['TRUE', 'FALSE', 'NOT GIVEN'];
  if (canonicalType === 'ynng') return ['YES', 'NO', 'NOT GIVEN'];
  return options.length > 0 ? options : ['REAL', 'NOT REAL'];
}

function renderBinaryChoice({
  canonicalType,
  question,
  value,
  onChange,
  disabled,
  enableNumberShortcuts,
}: ObjectiveRendererContext): ReactElement {
  const binaryLabels = getBinaryLabels(canonicalType, question.options ?? []);
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

function renderChoiceList({
  canonicalType,
  question,
  value,
  onChange,
  disabled,
  t,
}: ObjectiveRendererContext): ReactElement {
  const options = question.options ?? [];
  const acceptedVariants = question.acceptedVariants ?? [];
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

function renderReorderSequence({
  canonicalType,
  question,
  value,
  onChange,
  disabled,
}: ObjectiveRendererContext): ReactElement {
  return (
    <div data-testid={`objective-input-${question.number}`} data-question-type={canonicalType}>
      <MzSequenceOrderControl
        options={question.options ?? []}
        currentValue={value}
        onChanged={onChange}
        disabled={disabled}
      />
    </div>
  );
}

function inferWordSlotCount(question: ObjectiveQuestionInputSpec): number {
  const firstVariant = question.acceptedVariants?.[0]?.trim();
  if (firstVariant && firstVariant.length > 0) return firstVariant.length;
  const blankMatch = question.prompt.match(/_+/);
  if (blankMatch && blankMatch[0].length >= 2) return blankMatch[0].length;
  return 0;
}

function renderFreeTextOrWordCompletion(ctx: ObjectiveRendererContext): ReactElement {
  const { canonicalType, question, value, onChange, disabled, spellCheck, t } = ctx;
  const isWordCompletion = canonicalType === 'word_completion';
  const isDictation = canonicalType === 'dictation';
  const maxWords = question.maxWords ?? (isDictation ? 25 : isWordCompletion ? 1 : 3);
  const usedWords = countObjectiveWords(value);
  const overWordLimit = !isDictation && usedWords > maxWords;
  const slotCount = isWordCompletion ? inferWordSlotCount(question) : 0;

  const placeholder = isWordCompletion
    ? t('examKitTypeWordHint')
    : isDictation
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
            : isDictation
              ? t('examKitTranscribeHint')
              : t('examKitMaxWordsLimit', { count: maxWords })}
        </span>
      </div>

      {slotCount > 0 ? (
        <div
          data-testid={`word-completion-slots-${question.number}`}
          aria-hidden="true"
          className="flex flex-wrap gap-1"
        >
          {Array.from({ length: slotCount }, (_, idx) => {
            const ch = value[idx];
            return (
              <span
                key={idx}
                className={[
                  'inline-flex h-7 w-6 items-center justify-center rounded border font-mono-exam text-xs font-bold',
                  ch
                    ? 'border-primary bg-surface-alt text-text-primary'
                    : 'border-border-subtle bg-canvas text-text-tertiary',
                ].join(' ')}
              >
                {ch ?? '_'}
              </span>
            );
          })}
        </div>
      ) : null}

      <LtrExamBoundary>
        {isDictation ? (
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

// Open-Closed renderer registry keyed by canonical domain question type
const OBJECTIVE_RENDERER_REGISTRY: Partial<Record<ObjectiveQuestionType, ObjectiveRendererFn>> = {
  tfng: renderBinaryChoice,
  ynng: renderBinaryChoice,
  binary_choice: renderBinaryChoice,
  mcq_single: renderChoiceList,
  mcq_multi: renderChoiceList,
  matching_headings: renderChoiceList,
  reorder_sequence: renderReorderSequence,
  word_completion: renderFreeTextOrWordCompletion,
  dictation: renderFreeTextOrWordCompletion,
  summary_gap_fill: renderFreeTextOrWordCompletion,
  short_answer: renderFreeTextOrWordCompletion,
};

function resolveObjectiveRenderer(
  canonicalType: ObjectiveQuestionType,
  options: readonly string[],
): ObjectiveRendererFn {
  if (canonicalType === 'reorder_sequence' && options.length === 0) {
    return renderFreeTextOrWordCompletion;
  }
  const registered = OBJECTIVE_RENDERER_REGISTRY[canonicalType];
  if (registered) {
    if (registered === renderChoiceList && options.length === 0) {
      return renderFreeTextOrWordCompletion;
    }
    return registered;
  }
  return options.length > 0 ? renderChoiceList : renderFreeTextOrWordCompletion;
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

  const isBinaryType =
    canonicalType === 'tfng' || canonicalType === 'ynng' || canonicalType === 'binary_choice';
  const binaryLabels: readonly string[] | null = isBinaryType
    ? getBinaryLabels(canonicalType, options)
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

      let index = -1;
      const numeric = Number(event.key);
      if (Number.isInteger(numeric) && numeric >= 1) {
        index = numeric - 1;
      } else if (/^[a-z]$/i.test(event.key)) {
        index = event.key.toUpperCase().charCodeAt(0) - 65;
      }
      if (index < 0) return;

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

  const renderFn = resolveObjectiveRenderer(canonicalType, options);
  return renderFn({
    canonicalType,
    question,
    value,
    onChange,
    disabled,
    enableNumberShortcuts,
    spellCheck,
    t,
  });
}
