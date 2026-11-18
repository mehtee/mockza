import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export interface BdiLtrProps extends Omit<ComponentPropsWithoutRef<'bdi'>, 'dir'> {
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * Wraps inline LTR fragments (scores, times, identifiers, Latin terms)
 * inside Persian RTL prose so bidirectional reordering never scrambles punctuation.
 */
export function BdiLtr({ children, className, ...rest }: BdiLtrProps) {
  const mergedClassName = className
    ? `font-en tabular-nums ${className}`
    : 'font-en tabular-nums';

  return (
    <bdi {...rest} dir="ltr" className={mergedClassName}>
      {children}
    </bdi>
  );
}
