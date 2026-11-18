import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type MzButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type MzButtonSize = 'sm' | 'md' | 'lg';

export interface MzButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: MzButtonVariant;
  readonly size?: MzButtonSize;
  readonly isLoading?: boolean;
  readonly fullWidth?: boolean;
  readonly leadingIcon?: ReactNode;
}

const VARIANT_CLASSES: Record<MzButtonVariant, string> = {
  primary:
    'bg-primary text-on-primary border border-transparent hover:bg-primary-pressed',
  secondary:
    'bg-surface-alt text-text-primary border border-border-strong hover:bg-surface-hover',
  ghost:
    'bg-transparent text-text-secondary border border-transparent hover:bg-surface-hover hover:text-text-primary',
  danger:
    'bg-danger-bg text-error border border-error/50 hover:bg-error/20',
};

const SIZE_CLASSES: Record<MzButtonSize, string> = {
  sm: 'h-9 px-3 text-xs gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-sm gap-2',
};

export function MzButton({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  leadingIcon,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: MzButtonProps) {
  const isDisabled = Boolean(disabled || isLoading);
  return (
    <button
      {...rest}
      type={type}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center rounded-[var(--mz-radius-control)] font-semibold transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        'disabled:cursor-not-allowed disabled:opacity-55',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
      ) : (
        leadingIcon && <span className="shrink-0">{leadingIcon}</span>
      )}
      <span>{children}</span>
    </button>
  );
}
