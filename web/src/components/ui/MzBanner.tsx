import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';

export type MzBannerTone = 'info' | 'warning' | 'danger' | 'success';

export interface MzBannerProps {
  readonly tone?: MzBannerTone;
  readonly title?: string;
  readonly children: ReactNode;
  readonly actions?: ReactNode;
  readonly className?: string;
}

const TONE_CLASSES: Record<MzBannerTone, string> = {
  info: 'border-focus/40 bg-blue-bg text-text-primary',
  warning: 'border-warning/40 bg-amber-bg text-text-primary',
  danger: 'border-error/45 bg-danger-bg text-text-primary',
  success: 'border-success/45 bg-mint-bg text-text-primary',
};

const TONE_ICON_COLOR: Record<MzBannerTone, string> = {
  info: 'text-focus',
  warning: 'text-warning',
  danger: 'text-error',
  success: 'text-success',
};

export function MzBanner({
  tone = 'info',
  title,
  children,
  actions,
  className = '',
}: MzBannerProps) {
  const Icon =
    tone === 'success'
      ? CheckCircle2
      : tone === 'warning'
        ? ShieldAlert
        : tone === 'danger'
          ? AlertCircle
          : Info;

  return (
    <div
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
      className={[
        'flex items-start gap-3 rounded-[var(--mz-radius-control)] border p-3.5 text-start',
        TONE_CLASSES[tone],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Icon className={['mt-0.5 h-4 w-4 shrink-0', TONE_ICON_COLOR[tone]].join(' ')} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-semibold text-text-primary">{title}</p>}
        <div className={title ? 'mt-0.5 text-text-secondary' : 'text-text-primary'}>
          {children}
        </div>
        {actions && <div className="mt-2.5 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
