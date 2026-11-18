import { create } from 'zustand';

export type AudioPlaybackMode = 'exam_linear_locked' | 'study_interactive';

export interface AudioStoreState {
  readonly playbackMode: AudioPlaybackMode;
  readonly activeTrackKey: string | null;
  readonly isPlaying: boolean;
  readonly currentTimeSec: number;
  readonly durationSec: number;
  readonly playbackRate: number;
  readonly isRecording: boolean;
  readonly micLevelRms: number;
  readonly setPlaybackMode: (mode: AudioPlaybackMode) => void;
  readonly setActiveTrack: (trackKey: string | null, durationSec?: number) => void;
  readonly setPlaybackState: (patch: {
    readonly isPlaying?: boolean;
    readonly currentTimeSec?: number;
    readonly durationSec?: number;
    readonly playbackRate?: number;
  }) => void;
  readonly setRecordingState: (patch: {
    readonly isRecording?: boolean;
    readonly micLevelRms?: number;
  }) => void;
  readonly resetAudio: () => void;
}

export const useAudioStore = create<AudioStoreState>((set) => ({
  playbackMode: 'exam_linear_locked',
  activeTrackKey: null,
  isPlaying: false,
  currentTimeSec: 0,
  durationSec: 0,
  playbackRate: 1,
  isRecording: false,
  micLevelRms: 0,
  setPlaybackMode: (mode) =>
    set((state) => ({
      playbackMode: mode,
      playbackRate: mode === 'exam_linear_locked' ? 1 : state.playbackRate,
    })),
  setActiveTrack: (trackKey, durationSec = 0) =>
    set({
      activeTrackKey: trackKey,
      isPlaying: false,
      currentTimeSec: 0,
      durationSec: Math.max(0, durationSec),
    }),
  setPlaybackState: (patch) =>
    set((state) => {
      const nextRate =
        state.playbackMode === 'exam_linear_locked'
          ? 1
          : (patch.playbackRate ?? state.playbackRate);
      return {
        isPlaying: patch.isPlaying ?? state.isPlaying,
        currentTimeSec: patch.currentTimeSec ?? state.currentTimeSec,
        durationSec: patch.durationSec ?? state.durationSec,
        playbackRate: nextRate,
      };
    }),
  setRecordingState: (patch) =>
    set((state) => ({
      isRecording: patch.isRecording ?? state.isRecording,
      micLevelRms: Math.min(1, Math.max(0, patch.micLevelRms ?? state.micLevelRms)),
    })),
  resetAudio: () =>
    set({
      playbackMode: 'exam_linear_locked',
      activeTrackKey: null,
      isPlaying: false,
      currentTimeSec: 0,
      durationSec: 0,
      playbackRate: 1,
      isRecording: false,
      micLevelRms: 0,
    }),
}));
