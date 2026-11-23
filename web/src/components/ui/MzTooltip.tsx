import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface MzTooltipProps {
  readonly label: string;
  readonly enabled?: boolean;
  readonly dir?: 'ltr' | 'rtl';
  readonly sideOffset?: number;
  readonly className?: string;
  readonly children: ReactNode;
}

interface TooltipPosition {
  readonly top: number;
  readonly inlineStart: number;
}

/**
 * Minimal, theme-aware portal tooltip anchored to inline-end of desktop rail items.
 * Uses CSS logical properties (insetInlineStart) so placement adapts automatically in LTR and RTL
 * without clipping inside overflow-constrained sidebars.
 */
export function MzTooltip({
  label,
  enabled = true,
  dir = 'ltr',
  sideOffset = 18,
  className = '',
  children,
}: MzTooltipProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const clearPendingOpen = useCallback(() => {
    if (openTimerRef.current !== null) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearPendingOpen();
    setVisible(false);
    setOpen(false);
  }, [clearPendingOpen]);

  const measureAndShow = useCallback(() => {
    const el = anchorRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const inlineStart =
      dir === 'rtl'
        ? Math.max(8, window.innerWidth - rect.left + sideOffset)
        : rect.right + sideOffset;
    const top = Math.min(
      window.innerHeight - 24,
      Math.max(24, rect.top + rect.height / 2),
    );

    setPosition({ top, inlineStart });
    setOpen(true);
  }, [dir, sideOffset]);

  const handleMouseEnter = useCallback(() => {
    if (!enabled) return;
    clearPendingOpen();
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null;
      measureAndShow();
    }, 65);
  }, [clearPendingOpen, enabled, measureAndShow]);

  const handleFocus = useCallback(() => {
    if (!enabled) return;
    clearPendingOpen();
    measureAndShow();
  }, [clearPendingOpen, enabled, measureAndShow]);

  useEffect(() => {
    if (!enabled) {
      hide();
    }
  }, [enabled, hide]);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    const onScrollOrResize = () => hide();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [hide, open]);

  useEffect(() => clearPendingOpen, [clearPendingOpen]);

  const canPortal =
    enabled && open && position !== null && typeof document !== 'undefined';

  return (
    <div
      ref={anchorRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={hide}
      onFocus={handleFocus}
      onBlur={hide}
      onPointerDown={hide}
      className={className}
    >
      {children}
      {canPortal && position
        ? createPortal(
            <div
              role="tooltip"
              dir={dir}
              style={{ top: position.top, insetInlineStart: position.inlineStart }}
              className={[
                'pointer-events-none fixed z-50 hidden -translate-y-1/2 items-center lg:flex',
                'transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none',
                visible
                  ? 'opacity-100 translate-x-0'
                  : dir === 'rtl'
                    ? 'opacity-0 translate-x-1'
                    : 'opacity-0 -translate-x-1',
              ].join(' ')}
            >
              <span className="relative inline-flex items-center rounded-[var(--mz-radius-compact)] bg-[var(--mz-text-primary)] px-2.5 py-1.5 text-xs font-medium leading-none text-[var(--mz-bg-canvas)] whitespace-nowrap shadow-[0_6px_18px_rgba(0,0,0,0.16)]">
                <span
                  aria-hidden="true"
                  className="absolute -start-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 rounded-[1px] bg-[var(--mz-text-primary)]"
                />
                <span className="relative">{label}</span>
              </span>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
