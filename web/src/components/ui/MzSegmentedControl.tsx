export interface MzSegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly badge?: string;
}

export interface MzSegmentedControlProps<T extends string> {
  readonly options: readonly MzSegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (nextValue: T) => void;
  readonly ariaLabel: string;
  readonly fullWidth?: boolean;
  readonly className?: string;
}

export function MzSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  fullWidth = false,
  className = '',
}: MzSegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={[
        fullWidth
          ? 'flex w-full max-w-full flex-wrap gap-1 rounded-3xl border border-border-subtle bg-bg-raised p-1 sm:grid sm:grid-flow-col sm:auto-cols-fr'
          : 'inline-flex max-w-full flex-nowrap overflow-x-auto no-scrollbar rounded-[var(--mz-radius-pill)] border border-border-subtle bg-bg-raised p-1',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={[
              'inline-flex min-h-10 max-w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--mz-radius-pill)] px-3.5 py-1.5 text-xs font-semibold transition-colors sm:text-sm',
              fullWidth ? 'flex-1' : '',
              selected
                ? 'bg-primary text-on-primary'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
            ].join(' ')}
          >
            <span>{option.label}</span>
            {option.badge && (
              <span
                className={[
                  'rounded-[var(--mz-radius-pill)] px-1.5 py-0.5 text-[11px] font-semibold',
                  selected ? 'bg-on-primary/15 text-on-primary' : 'bg-surface-alt text-text-tertiary',
                ].join(' ')}
              >
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
