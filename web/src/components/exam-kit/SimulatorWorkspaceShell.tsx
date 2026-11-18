import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Keyboard,
  Pause,
  Play,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { MzButton, MzModal } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { getActiveEditionCode } from '@/edition/edition-config';
import { createTranslator } from '@/i18n';
import { useOptionalDeps } from '@/spa/deps';

export type WorkspaceTimerPhase = 'prep' | 'response' | 'paused' | 'expired';

export interface KeyboardShortcutHint {
  readonly keys: string;
  readonly description: string;
}

export interface SimulatorWorkspaceShellProps {
  readonly breadcrumb: string;
  readonly subtitle?: string;
  readonly remainingSeconds: number | null;
  readonly timerPhase?: WorkspaceTimerPhase;
  readonly examMode?: 'exam' | 'study';
  readonly isPaused?: boolean;
  readonly onTogglePause?: () => void;
  readonly onRequestExit?: () => void;
  readonly headerActions?: ReactNode;
  readonly shortcuts?: readonly KeyboardShortcutHint[];
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}

export function formatMmSs(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function SimulatorWorkspaceShell({
  breadcrumb,
  subtitle,
  remainingSeconds,
  timerPhase = 'response',
  examMode = 'exam',
  isPaused = false,
  onTogglePause,
  onRequestExit,
  headerActions,
  shortcuts = [],
  footer,
  children,
}: SimulatorWorkspaceShellProps) {
  const deps = useOptionalDeps();
  const edition = deps?.edition ?? getActiveEditionCode();
  const t = createTranslator(edition);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const isUrgent =
    remainingSeconds !== null && remainingSeconds <= 30 && timerPhase === 'response';
  const effectivePhase: WorkspaceTimerPhase = isPaused ? 'paused' : timerPhase;

  useEffect(() => {
    if (shortcuts.length === 0) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== '?' && !(event.key === '/' && event.shiftKey)) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return;
      }
      event.preventDefault();
      setShortcutsOpen((prev) => !prev);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcuts.length]);

  const ExitChevron = edition === 'irn' ? ChevronRight : ChevronLeft;

  return (
    <div
      data-testid="simulator-workspace-shell"
      className="flex h-[calc(100dvh-3rem)] min-h-[540px] flex-col overflow-hidden rounded-[var(--mz-radius-card)] border border-border-subtle bg-canvas text-start"
    >
      {/* Top Distraction-Free Chrome Bar */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-bg-raised px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          {onRequestExit ? (
            <button
              type="button"
              data-testid="workspace-exit-btn"
              onClick={onRequestExit}
              className="inline-flex h-8 items-center gap-1 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-2.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <ExitChevron className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('workspaceExitSessionAction')}</span>
            </button>
          ) : null}

          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-text-primary">{breadcrumb}</p>
            {subtitle ? (
              <p className="truncate text-[11px] text-text-secondary">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {headerActions}

          <span
            data-testid="workspace-mode-badge"
            className={[
              'rounded-[var(--mz-radius-pill)] border px-2.5 py-0.5 text-[11px] font-semibold',
              examMode === 'study'
                ? 'border-focus/40 bg-blue-bg text-focus'
                : 'border-border-subtle bg-surface-alt text-text-secondary',
            ].join(' ')}
          >
            {examMode === 'study' ? t('workspaceStudyModeBadge') : t('workspaceExamModeBadge')}
          </span>

          {remainingSeconds !== null ? (
            <div
              data-testid="workspace-timer-chip"
              data-phase={effectivePhase}
              data-urgent={isUrgent ? 'true' : 'false'}
              className={[
                'inline-flex items-center gap-2 rounded-[var(--mz-radius-control)] border px-3 py-1 transition-colors',
                isUrgent
                  ? 'border-error bg-danger-bg text-error'
                  : effectivePhase === 'prep'
                    ? 'border-primary/50 bg-surface-alt text-primary'
                    : 'border-border-subtle bg-surface-alt text-text-primary',
              ].join(' ')}
            >
              <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
              {effectivePhase === 'prep' ? (
                <span className="text-[11px] font-semibold">{t('workspacePrepPhaseBadge')}</span>
              ) : effectivePhase === 'expired' ? (
                <span className="text-[11px] font-semibold">{t('workspaceExpiredBadge')}</span>
              ) : null}
              <LtrExamBoundary>
                <span className="font-mono-exam text-sm font-bold tabular-nums">
                  {formatMmSs(remainingSeconds)}
                </span>
              </LtrExamBoundary>

              {examMode === 'study' && onTogglePause ? (
                <button
                  type="button"
                  data-testid="workspace-timer-pause-btn"
                  aria-label={
                    isPaused ? t('workspaceResumeTimerAction') : t('workspacePauseTimerAction')
                  }
                  onClick={onTogglePause}
                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-border-subtle bg-canvas text-text-primary hover:bg-surface-hover"
                >
                  {isPaused ? (
                    <Play className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Pause className="h-3 w-3" aria-hidden="true" />
                  )}
                </button>
              ) : null}
            </div>
          ) : null}

          {shortcuts.length > 0 ? (
            <button
              type="button"
              data-testid="workspace-shortcuts-btn"
              onClick={() => setShortcutsOpen(true)}
              aria-label={t('workspaceShortcutsHint')}
              className="inline-flex h-8 items-center gap-1.5 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{t('workspaceShortcutsHint')}</span>
            </button>
          ) : null}
        </div>
      </header>

      {/* Scroll-Isolated Body Region */}
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>

      {/* Bottom Action & Palette Footer */}
      {footer ? (
        <footer className="shrink-0 border-t border-border-subtle bg-bg-raised px-4 py-2.5">
          {footer}
        </footer>
      ) : null}

      {/* Keyboard Shortcuts Cheat-Sheet Modal */}
      {shortcuts.length > 0 ? (
        <MzModal
          open={shortcutsOpen}
          onOpenChange={setShortcutsOpen}
          title={t('workspaceShortcutsTitle')}
          footer={
            <MzButton variant="secondary" size="sm" onClick={() => setShortcutsOpen(false)}>
              {t('workspaceShortcutsCloseAction')}
            </MzButton>
          }
        >
          <ul className="flex flex-col gap-2 text-xs">
            {shortcuts.map((item) => (
              <li
                key={item.keys}
                className="flex items-center justify-between gap-3 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3 py-2"
              >
                <span className="text-text-secondary">{item.description}</span>
                <LtrExamBoundary>
                  <kbd className="rounded border border-border-strong bg-surface-alt px-2 py-0.5 font-mono-exam text-[11px] font-semibold text-text-primary">
                    {item.keys}
                  </kbd>
                </LtrExamBoundary>
              </li>
            ))}
          </ul>
        </MzModal>
      ) : null}
    </div>
  );
}
