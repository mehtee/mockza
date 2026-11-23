import { create } from 'zustand';

export const DEFAULT_SPLIT_RATIO = 50;
export const MIN_SPLIT_RATIO = 40;
export const MAX_SPLIT_RATIO = 65;

const SIDEBAR_STORAGE_KEY = 'mockza:layout:sidebar-collapsed:v1';

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readStoredSidebarCollapsed(): boolean {
  if (!canUseBrowserStorage()) return false;
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeStoredSidebarCollapsed(collapsed: boolean): void {
  if (!canUseBrowserStorage()) return;
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    // Ignore storage quota or private-mode errors.
  }
}

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
  sidebarCollapsed: readStoredSidebarCollapsed(),
  splitPaneRatios: {},
  shortcutLegendOpen: false,
  toggleSidebar: () =>
    set((state) => {
      const next = !state.sidebarCollapsed;
      writeStoredSidebarCollapsed(next);
      return { sidebarCollapsed: next };
    }),
  setSidebarCollapsed: (collapsed) => {
    writeStoredSidebarCollapsed(collapsed);
    set({ sidebarCollapsed: collapsed });
  },
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

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (event) => {
    if (event.key === SIDEBAR_STORAGE_KEY) {
      useLayoutStore.setState({ sidebarCollapsed: event.newValue === '1' });
    }
  });
}
