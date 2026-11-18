import { create } from 'zustand';

export const DEFAULT_SPLIT_RATIO = 50;
export const MIN_SPLIT_RATIO = 40;
export const MAX_SPLIT_RATIO = 65;

export function clampSplitRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) {
    return DEFAULT_SPLIT_RATIO;
  }
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio));
}

export interface LayoutStoreState {
  readonly sidebarCollapsed: boolean;
  readonly splitPaneRatios: Readonly<Record<string, number>>;
  readonly shortcutLegendOpen: boolean;
  readonly toggleSidebar: () => void;
  readonly setSidebarCollapsed: (collapsed: boolean) => void;
  readonly setSplitPaneRatio: (viewKey: string, ratio: number) => void;
  readonly getSplitPaneRatio: (viewKey: string, fallback?: number) => number;
  readonly setShortcutLegendOpen: (open: boolean) => void;
}

export const useLayoutStore = create<LayoutStoreState>((set, get) => ({
  sidebarCollapsed: false,
  splitPaneRatios: {},
  shortcutLegendOpen: false,
  toggleSidebar: () =>
    set((state) => ({
      sidebarCollapsed: !state.sidebarCollapsed,
    })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSplitPaneRatio: (viewKey, ratio) =>
    set((state) => ({
      splitPaneRatios: {
        ...state.splitPaneRatios,
        [viewKey]: clampSplitRatio(ratio),
      },
    })),
  getSplitPaneRatio: (viewKey, fallback = DEFAULT_SPLIT_RATIO) => {
    const stored = get().splitPaneRatios[viewKey];
    return stored !== undefined ? stored : clampSplitRatio(fallback);
  },
  setShortcutLegendOpen: (open) => set({ shortcutLegendOpen: open }),
}));
