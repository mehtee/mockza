import { AlertTriangle, RotateCcw } from 'lucide-react';
import { BackArrowIcon } from '@/components/bidi/DirectionIcon';
import { MzButton, MzCard } from '@/components/ui';
import { getActiveEditionCode } from '@/edition/edition-config';
import { createTranslator } from '@/i18n';
import { useOptionalDeps } from '@/spa/deps';

export interface SimulatorLoadFallbackProps {
  readonly testId?: string;
  readonly onRetry?: () => void;
  readonly backTo?: '/practice' | '/home';
  readonly onBack?: () => void;
  readonly onHome?: () => void;
  readonly message?: string;
}

export function SimulatorLoadFallback({
  testId = 'simulator-load-fallback',
  onRetry,
  backTo = '/practice',
  onBack,
  onHome,
  message,
}: SimulatorLoadFallbackProps) {
  const deps = useOptionalDeps();
  const edition = deps?.edition ?? getActiveEditionCode();
  const t = createTranslator(edition);

  const backHref = backTo === '/home' ? '/app/home' : '/app/practice';

  return (
    <div data-testid={testId} className="mx-auto max-w-xl py-8">
      <MzCard variant="hero" className="border-warning/40 bg-bg-surface">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--mz-radius-compact)] bg-amber-bg text-warning">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-text-primary">{t('simLoadErrorTitle')}</h2>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              {message ?? t('rateLimitFriendlyError')}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          {onRetry ? (
            <MzButton
              type="button"
              variant="primary"
              size="md"
              data-testid={`${testId}-retry`}
              leadingIcon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
              onClick={onRetry}
            >
              {t('simRetryLoadAction')}
            </MzButton>
          ) : null}

          <a
            href={backHref}
            data-testid={`${testId}-back`}
            onClick={(event) => {
              if (onBack) {
                event.preventDefault();
                onBack();
              }
            }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--mz-radius-control)] border border-border-subtle bg-bg-raised px-4 text-sm font-semibold text-text-primary hover:bg-surface-hover"
          >
            <BackArrowIcon edition={edition} className="h-4 w-4" />
            <span>
              {backTo === '/home' ? t('simBackToHomeAction') : t('simBackToPracticeAction')}
            </span>
          </a>

          {backTo !== '/home' ? (
            <a
              href="/app/home"
              onClick={(event) => {
                if (onHome) {
                  event.preventDefault();
                  onHome();
                }
              }}
              className="inline-flex min-h-11 items-center rounded-[var(--mz-radius-control)] border border-transparent px-3 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            >
              {t('simBackToHomeAction')}
            </a>
          ) : null}
        </div>
      </MzCard>
    </div>
  );
}
