import { Eye, EyeOff } from 'lucide-react';
import { type InputHTMLAttributes, useId, useState } from 'react';

export interface MzTextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string | null;
  readonly allowPasswordToggle?: boolean;
  readonly showPasswordLabel?: string;
  readonly hidePasswordLabel?: string;
  readonly inputDir?: 'ltr' | 'rtl' | 'auto';
}

export function MzTextField({
  label,
  hint,
  error,
  allowPasswordToggle = false,
  showPasswordLabel = 'Show password',
  hidePasswordLabel = 'Hide password',
  inputDir,
  type = 'text',
  id,
  className = '',
  ...rest
}: MzTextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [revealed, setRevealed] = useState(false);

  const effectiveType =
    allowPasswordToggle && type === 'password' ? (revealed ? 'text' : 'password') : type;

  return (
    <div className="flex flex-col gap-1.5 text-start">
      <label
        htmlFor={fieldId}
        className="text-xs font-semibold tracking-wide text-text-secondary"
      >
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          {...rest}
          id={fieldId}
          type={effectiveType}
          dir={inputDir}
          aria-invalid={Boolean(error) || undefined}
          className={[
            'h-11 w-full rounded-[var(--mz-radius-control)] border bg-bg-raised px-3.5 text-sm text-text-primary placeholder:text-text-tertiary',
            'focus:border-focus focus:outline-none',
            error ? 'border-error' : 'border-border-subtle',
            allowPasswordToggle ? 'pe-11' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
        />
        {allowPasswordToggle && type === 'password' && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? hidePasswordLabel : showPasswordLabel}
            className="absolute end-2 inline-flex h-8 w-8 items-center justify-center rounded-[var(--mz-radius-compact)] text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            {revealed ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-error">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-text-tertiary">{hint}</p>
      )}
    </div>
  );
}
