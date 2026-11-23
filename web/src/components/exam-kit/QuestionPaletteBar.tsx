import { Check } from 'lucide-react';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { getActiveEditionCode } from '@/edition/edition-config';
import { createTranslator } from '@/i18n';
import { useOptionalDeps } from '@/spa/deps';

export type QuestionPaletteVisualState =
  | 'current'
  | 'answered'
  | 'current_answered'
  | 'unanswered';

export interface QuestionPaletteItem {
  readonly index: number;
  readonly number: number;
  readonly isAnswered: boolean;
  readonly isFlagged?: boolean;
}

export interface QuestionPaletteBarProps {
  readonly items: readonly QuestionPaletteItem[];
  readonly activeIndex: number;
  readonly onSelectQuestion: (index: number) => void;
  readonly ariaLabel?: string;
}

export function resolveQuestionPaletteVisualState(
  isCurrent: boolean,
  isAnswered: boolean,
): QuestionPaletteVisualState {
  if (isCurrent && isAnswered) {
    return 'current_answered';
  }
  if (isCurrent) {
    return 'current';
  }
  if (isAnswered) {
    return 'answered';
  }
  return 'unanswered';
}

const STATE_BUTTON_CLASSES: Record<QuestionPaletteVisualState, string> = {
  // Active unanswered: primary border + subtle primary ring
  current:
    'border-2 border-primary bg-surface-alt text-primary font-bold ring-2 ring-primary/30',
  // Answered not active: emerald check badge + mint surface
  answered:
    'border border-success/55 bg-mint-bg text-success font-semibold hover:bg-mint-bg/80',
  // Current AND answered: distinct neutral-primary frame + inner mint check icon (never conflated!)
  current_answered:
    'border-2 border-primary bg-canvas text-text-primary font-bold ring-2 ring-primary/35',
  // Unanswered default
  unanswered:
    'border border-border-subtle bg-bg-raised text-text-secondary hover:bg-surface-hover hover:text-text-primary',
};

export function QuestionPaletteBar({
  items,
  activeIndex,
  onSelectQuestion,
  ariaLabel,
}: QuestionPaletteBarProps) {
  const deps = useOptionalDeps();
  const edition = deps?.edition ?? getActiveEditionCode();
  const t = createTranslator(edition);

  return (
    <LtrExamBoundary>
      <nav
        aria-label={ariaLabel ?? t('workspaceQuestionProgress', { current: activeIndex + 1, total: items.length })}
        data-testid="question-palette-bar"
        className="flex flex-nowrap items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
      >
        {items.map((item) => {
          const isCurrent = item.index === activeIndex;
          const visualState = resolveQuestionPaletteVisualState(isCurrent, item.isAnswered);
          const isFlagged = Boolean(item.isFlagged);

          return (
            <button
              key={item.index}
              type="button"
              data-testid={`palette-item-${item.number}`}
              data-palette-state={visualState}
              data-flagged={isFlagged ? 'true' : 'false'}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={t('paletteQuestionAriaLabel', { number: item.number })}
              onClick={() => onSelectQuestion(item.index)}
              className={[
                'relative inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center gap-1 rounded-[var(--mz-radius-compact)] px-2.5 font-mono-exam text-xs tabular-nums transition-all sm:min-h-8 sm:min-w-[2.25rem] sm:px-2',
                STATE_BUTTON_CLASSES[visualState],
              ].join(' ')}
            >
              <span>{item.number}</span>
              {visualState === 'answered' || visualState === 'current_answered' ? (
                <Check
                  data-testid={`palette-check-${item.number}`}
                  className="h-3 w-3 shrink-0 text-success stroke-[2.75]"
                  aria-hidden="true"
                />
              ) : null}
              {isFlagged ? (
                <span
                  data-testid={`palette-flag-${item.number}`}
                  aria-hidden="true"
                  className="absolute -top-1 end-0.5 h-2.5 w-2.5 rounded-full border border-canvas bg-warning"
                />
              ) : null}
            </button>
          );
        })}
      </nav>
    </LtrExamBoundary>
  );
}
