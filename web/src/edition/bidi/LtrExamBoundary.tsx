import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export interface LtrExamBoundaryProps
  extends Omit<ComponentPropsWithoutRef<'div'>, 'dir' | 'lang'> {
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * Isolates English exam passages, blanks (`____`), option letters (`A.`–`D.`),
 * timers (`19:45`), SVG charts, and band scores (`7.5`) in strict LTR mode
 * inside `IRN` RTL chrome.
 */
export function LtrExamBoundary({
  className,
  children,
  style,
  ...rest
}: LtrExamBoundaryProps) {
  const mergedClassName = [
    'font-en isolate [unicode-bidi:isolate] text-start tabular-nums',
    className,
  ]
    .filter((token): token is string => Boolean(token && token.length > 0))
    .join(' ');

  return (
    <div
      {...rest}
      dir="ltr"
      lang="en"
      className={mergedClassName}
      style={{ ...style, unicodeBidi: 'isolate' }}
    >
      {children}
    </div>
  );
}
