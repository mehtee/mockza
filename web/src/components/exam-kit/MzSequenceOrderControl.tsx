import { normalizeObjectiveSequence, parseObjectiveChoiceOption } from '@mockza/domain';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { useMemo, useState } from 'react';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { getActiveEditionCode } from '@/edition/edition-config';
import { createTranslator } from '@/i18n';
import { useOptionalDeps } from '@/spa/deps';

export interface SequenceStepDescriptor {
  readonly token: string;
  readonly displayText: string;
}

export interface MzSequenceOrderControlProps {
  readonly options: readonly string[];
  readonly currentValue: string;
  readonly onChanged: (nextSequence: string) => void;
  readonly disabled?: boolean;
}

export function buildOrderedSequenceSteps(
  options: readonly string[],
  currentValue: string,
): readonly SequenceStepDescriptor[] {
  const baseSteps: SequenceStepDescriptor[] = options.map((rawOption, index) => {
    const parsed = parseObjectiveChoiceOption({
      questionType: 'reorder_sequence',
      rawOption,
      index,
      acceptedVariants: [],
    });
    return {
      token: parsed.label.toUpperCase(),
      displayText: parsed.displayText,
    };
  });

  const normalized = normalizeObjectiveSequence(currentValue);
  if (!normalized) {
    return baseSteps;
  }

  const wantedTokens = normalized.split('|').filter(Boolean);
  const byToken = new Map(baseSteps.map((step) => [step.token, step] as const));
  const ordered: SequenceStepDescriptor[] = [];
  const used = new Set<string>();

  for (const token of wantedTokens) {
    const found = byToken.get(token);
    if (found && !used.has(token)) {
      ordered.push(found);
      used.add(token);
    }
  }
  for (const step of baseSteps) {
    if (!used.has(step.token)) {
      ordered.push(step);
    }
  }
  return ordered;
}

export function MzSequenceOrderControl({
  options,
  currentValue,
  onChanged,
  disabled = false,
}: MzSequenceOrderControlProps) {
  const deps = useOptionalDeps();
  const edition = deps?.edition ?? getActiveEditionCode();
  const t = createTranslator(edition);

  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const steps = useMemo(
    () => buildOrderedSequenceSteps(options, currentValue),
    [currentValue, options],
  );

  const commitOrder = (nextSteps: readonly SequenceStepDescriptor[]) => {
    const joined = nextSteps.map((s) => s.token).join('|');
    onChanged(joined);
  };

  const moveStep = (fromIndex: number, toIndex: number) => {
    if (disabled) return;
    if (toIndex < 0 || toIndex >= steps.length || fromIndex === toIndex) return;
    const copy = [...steps];
    const [moved] = copy.splice(fromIndex, 1);
    if (!moved) return;
    copy.splice(toIndex, 0, moved);
    commitOrder(copy);
  };

  return (
    <div data-testid="sequence-order-control" className="flex flex-col gap-2">
      <p className="text-xs text-text-secondary">{t('examKitSequenceHint')}</p>
      <LtrExamBoundary>
        <ol className="flex flex-col gap-2">
          {steps.map((step, index) => (
            <li
              key={step.token}
              data-testid={`sequence-step-${step.token}`}
              draggable={!disabled}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={() => {
                if (dragIndex !== null) {
                  moveStep(dragIndex, index);
                }
                setDragIndex(null);
              }}
              onKeyDown={(event) => {
                if (event.altKey && event.key === 'ArrowUp') {
                  event.preventDefault();
                  moveStep(index, index - 1);
                } else if (event.altKey && event.key === 'ArrowDown') {
                  event.preventDefault();
                  moveStep(index, index + 1);
                }
              }}
              tabIndex={disabled ? -1 : 0}
              className="flex items-center justify-between gap-3 rounded-[var(--mz-radius-control)] border border-border-subtle bg-bg-raised px-3 py-2.5 text-sm text-text-primary transition-colors hover:border-border-strong focus-visible:border-primary focus-visible:outline-none"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <GripVertical className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden="true" />
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border-strong bg-surface-alt font-mono-exam text-xs font-bold text-primary">
                  {step.token}
                </span>
                <span className="min-w-0 flex-1 text-start">{step.displayText}</span>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  data-testid={`sequence-up-${step.token}`}
                  aria-label={`${t('examKitMoveUpAction')} ${step.token}`}
                  disabled={disabled || index === 0}
                  onClick={() => moveStep(index, index - 1)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-border-subtle bg-canvas text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-40"
                >
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  data-testid={`sequence-down-${step.token}`}
                  aria-label={`${t('examKitMoveDownAction')} ${step.token}`}
                  disabled={disabled || index === steps.length - 1}
                  onClick={() => moveStep(index, index + 1)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-border-subtle bg-canvas text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-40"
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      </LtrExamBoundary>
    </div>
  );
}
