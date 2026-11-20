import { GripVertical } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  type ImperativePanelGroupHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels';
import { getActiveEditionCode } from '@/edition/edition-config';
import { createTranslator } from '@/i18n';
import { useOptionalDeps } from '@/spa/deps';

export const SPLIT_MIN_PERCENT = 40;
export const SPLIT_MAX_PERCENT = 65;
export const SPLIT_DEFAULT_PERCENT = 50;

export function clampSplitRatioPercent(ratio01OrPercent: number): number {
  const asPercent = ratio01OrPercent <= 1 ? ratio01OrPercent * 100 : ratio01OrPercent;
  if (!Number.isFinite(asPercent)) {
    return SPLIT_DEFAULT_PERCENT;
  }
  return Math.min(SPLIT_MAX_PERCENT, Math.max(SPLIT_MIN_PERCENT, Math.round(asPercent)));
}

export interface SplitPaneWorkspaceProps {
  readonly viewKey: string;
  readonly leftPane: ReactNode;
  readonly rightPane: ReactNode;
  readonly initialRatio?: number;
  readonly onRatioChange?: (ratio01: number) => void;
  readonly leftLabel?: string;
  readonly rightLabel?: string;
  readonly className?: string;
}

export function SplitPaneWorkspace({
  viewKey,
  leftPane,
  rightPane,
  initialRatio,
  onRatioChange,
  leftLabel,
  rightLabel,
  className = '',
}: SplitPaneWorkspaceProps) {
  const deps = useOptionalDeps();
  const edition = deps?.edition ?? getActiveEditionCode();
  const t = createTranslator(edition);

  const workspaceRef = useRef<HTMLDivElement>(null);
  const [stacked, setStacked] = useState(false);
  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setStacked(entry.contentRect.width < 680);
    });
    observer.observe(workspace);
    return () => observer.disconnect();
  }, []);

  const groupRef = useRef<ImperativePanelGroupHandle | null>(null);
  const [leftPercent, setLeftPercent] = useState<number>(() =>
    clampSplitRatioPercent(initialRatio ?? 0.55),
  );
  const hydratedRef = useRef(false);

  const tryApplyLayout = useCallback((nextLeftPercent: number) => {
    try {
      groupRef.current?.setLayout([nextLeftPercent, 100 - nextLeftPercent]);
    } catch {
      // Unmeasured containers (such as headless JSDOM with 0px width) throw on setLayout.
    }
  }, []);

  useEffect(() => {
    if (!deps) {
      hydratedRef.current = true;
      return;
    }
    let mounted = true;
    void deps.attemptStore.getSplitPaneRatio(viewKey).then((res) => {
      if (!mounted) return;
      hydratedRef.current = true;
      if (res.ok && res.value !== null) {
        const clamped = clampSplitRatioPercent(res.value);
        setLeftPercent(clamped);
        tryApplyLayout(clamped);
      }
    });
    return () => {
      mounted = false;
    };
  }, [deps, tryApplyLayout, viewKey]);

  const persistPercent = useCallback(
    (rawPercent: number) => {
      const clamped = clampSplitRatioPercent(rawPercent);
      const ratio01 = Number((clamped / 100).toFixed(2));
      setLeftPercent(clamped);
      onRatioChange?.(ratio01);
      if (deps && hydratedRef.current) {
        void deps.attemptStore.saveSplitPaneRatio(viewKey, ratio01);
      }
    },
    [deps, onRatioChange, viewKey],
  );

  const handleLayout = useCallback(
    (sizes: number[]) => {
      const primary = sizes[0];
      if (primary === undefined) return;
      persistPercent(primary);
    },
    [persistPercent],
  );

  const handleResetSplit = useCallback(() => {
    hydratedRef.current = true;
    tryApplyLayout(SPLIT_DEFAULT_PERCENT);
    persistPercent(SPLIT_DEFAULT_PERCENT);
  }, [persistPercent, tryApplyLayout]);

  return (
    <div
      ref={workspaceRef}
      data-testid="split-pane-workspace"
      data-split-percent={leftPercent}
      className={['h-full w-full overflow-hidden', className].filter(Boolean).join(' ')}
    >
      <PanelGroup
        ref={groupRef}
        direction={stacked ? 'vertical' : 'horizontal'}
        onLayout={handleLayout}
        className="h-full w-full"
      >
        <Panel
          id={`${viewKey}-left`}
          order={1}
          defaultSize={leftPercent}
          minSize={SPLIT_MIN_PERCENT}
          maxSize={SPLIT_MAX_PERCENT}
          className="h-full min-w-0"
        >
          <section
            aria-label={leftLabel}
            data-testid="split-pane-left"
            className="h-full overflow-y-auto p-3 sm:p-5"
          >
            {leftPane}
          </section>
        </Panel>

        <PanelResizeHandle
          data-testid="split-pane-divider"
          title={t('workspaceResetSplitAction')}
          onDoubleClick={handleResetSplit}
          className={[
            'group relative flex shrink-0 items-center justify-center border-border-subtle bg-bg-raised transition-colors hover:bg-primary/15 focus-visible:bg-primary/20 focus-visible:outline-none',
            stacked ? 'h-3 cursor-row-resize border-y' : 'w-3 cursor-col-resize border-x',
          ].join(' ')}
        >
          <GripVertical
            className={`h-4 w-4 text-text-tertiary transition-colors group-hover:text-primary ${stacked ? 'rotate-90' : ''}`}
            aria-hidden="true"
          />
        </PanelResizeHandle>

        <Panel
          id={`${viewKey}-right`}
          order={2}
          defaultSize={100 - leftPercent}
          minSize={100 - SPLIT_MAX_PERCENT}
          maxSize={100 - SPLIT_MIN_PERCENT}
          className="h-full min-w-0"
        >
          <section
            aria-label={rightLabel}
            data-testid="split-pane-right"
            className="h-full overflow-y-auto p-3 sm:p-5"
          >
            {rightPane}
          </section>
        </Panel>
      </PanelGroup>
    </div>
  );
}
