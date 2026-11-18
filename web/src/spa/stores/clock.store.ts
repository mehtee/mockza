import { create } from 'zustand';

export interface ClockStoreState {
  readonly activeExamLock: boolean;
  readonly activeSessionLabel: string | null;
  readonly totalSeconds: number;
  readonly remainingSeconds: number;
  readonly isRunning: boolean;
  readonly startSessionTimer: (totalSeconds: number, label?: string | null) => void;
  readonly setRemainingSeconds: (seconds: number) => void;
  readonly tickSecond: () => void;
  readonly pauseTimer: () => void;
  readonly resumeTimer: () => void;
  readonly setActiveExamLock: (locked: boolean, label?: string | null) => void;
  readonly resetClock: () => void;
}

export const useClockStore = create<ClockStoreState>((set) => ({
  activeExamLock: false,
  activeSessionLabel: null,
  totalSeconds: 0,
  remainingSeconds: 0,
  isRunning: false,
  startSessionTimer: (totalSeconds, label = null) =>
    set({
      totalSeconds: Math.max(0, Math.floor(totalSeconds)),
      remainingSeconds: Math.max(0, Math.floor(totalSeconds)),
      isRunning: totalSeconds > 0,
      activeExamLock: true,
      activeSessionLabel: label,
    }),
  setRemainingSeconds: (seconds) =>
    set({
      remainingSeconds: Math.max(0, Math.floor(seconds)),
    }),
  tickSecond: () =>
    set((state) => {
      if (!state.isRunning || state.remainingSeconds <= 0) {
        return state;
      }
      const next = state.remainingSeconds - 1;
      return {
        remainingSeconds: next,
        isRunning: next > 0,
      };
    }),
  pauseTimer: () => set({ isRunning: false }),
  resumeTimer: () =>
    set((state) => ({
      isRunning: state.remainingSeconds > 0,
    })),
  setActiveExamLock: (locked, label = null) =>
    set((state) => ({
      activeExamLock: locked,
      activeSessionLabel: locked ? (label ?? state.activeSessionLabel) : null,
    })),
  resetClock: () =>
    set({
      activeExamLock: false,
      activeSessionLabel: null,
      totalSeconds: 0,
      remainingSeconds: 0,
      isRunning: false,
    }),
}));
