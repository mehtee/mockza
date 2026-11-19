import { Check } from 'lucide-react';
import { useId } from 'react';

export interface MzCheckboxProps {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly label: string;
  readonly description?: string;
  readonly disabled?: boolean;
  readonly id?: string;
  readonly testId?: string;
}

export function MzCheckbox({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  id,
  testId,
}: MzCheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <label
      htmlFor={inputId}
      className={[
        'flex items-start gap-3 rounded-[var(--mz-radius-control)] border p-3.5 text-start transition-colors',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        checked
          ? 'border-primary bg-surface-alt'
          : 'border-border-subtle bg-bg-raised hover:bg-surface-hover',
      ].join(' ')}
    >
      <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          id={inputId}
          type="checkbox"
          data-testid={testId}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={[
            'flex h-5 w-5 items-center justify-center rounded-[var(--mz-radius-compact)] border transition-colors',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50',
            checked
              ? 'border-primary bg-primary text-on-primary'
              : 'border-border-strong bg-canvas text-transparent',
          ].join(' ')}
        >
          <Check className="h-3.5 w-3.5 stroke-[2.75]" />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-text-primary">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-text-secondary">{description}</span>
        ) : null}
      </span>
    </label>
  );
}
