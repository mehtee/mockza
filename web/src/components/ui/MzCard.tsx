import type { HTMLAttributes, ReactNode } from 'react';

export type MzCardVariant = 'default' | 'raised' | 'alt' | 'hero';

export interface MzCardProps extends HTMLAttributes<HTMLDivElement> {
  readonly variant?: MzCardVariant;
  readonly padding?: 'none' | 'sm' | 'md' | 'lg';
  readonly children: ReactNode;
}

const VARIANT_CLASSES: Record<MzCardVariant, string> = {
  default: 'bg-surface border border-border-subtle',
  raised: 'bg-bg-raised border border-border-subtle',
  alt: 'bg-surface-alt border border-border-strong',
  hero: 'border border-border-strong [background:var(--mz-gradient-hero)]',
};

const PADDING_CLASSES: Record<'none' | 'sm' | 'md' | 'lg', string> = {
  none: '',
  sm: 'p-3.5',
  md: 'p-5',
  lg: 'p-6',
};

export function MzCard({
  variant = 'default',
  padding = 'md',
  className = '',
  children,
  ...rest
}: MzCardProps) {
  return (
    <div
      {...rest}
      className={[
        'rounded-[var(--mz-radius-card)] text-start',
        VARIANT_CLASSES[variant],
        PADDING_CLASSES[padding],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
