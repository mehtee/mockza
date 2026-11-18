import type {
  ActiveRecordingHandle,
  AudioInputDeviceInfo,
  AudioPlaybackMode,
  AudioPlaybackState,
  AudioSourceSpec,
  AudioTrackHandle,
  AudioTrackPlaybackStatus,
  IAudioPlayerGateway,
  IAudioRecorderGateway,
  LoopbackTestResult,
  MicPermissionStatus,
  MicPreflightStatus,
  RecordedClip,
  StartRecordingOptions,
} from '@/gateways/audio.gateway';
import { type AudioError, type Result, err, ok } from '@/gateways/result';

export interface FakeAudioRecorderOptions {
  readonly activeContentType?: string;
  readonly permission?: MicPermissionStatus;
  readonly devices?: readonly AudioInputDeviceInfo[];
  readonly simulatedPeakRms?: number;
  readonly simulatedDurationMs?: number;
}

export class FakeAudioRecorderAdapter implements IAudioRecorderGateway {
  readonly activeContentType: string;
  private permission: MicPermissionStatus;
  private devices: readonly AudioInputDeviceInfo[];
  private simulatedPeakRms: number;
  private simulatedDurationMs: number;

  constructor(options: FakeAudioRecorderOptions = {}) {
    this.activeContentType = (options.activeContentType ?? 'audio/mp4').split(';')[0] ?? 'audio/mp4';
    this.permission = options.permission ?? 'granted';
    this.devices = options.devices ?? [
      { deviceId: 'fake-mic-default', label: 'Fake Studio Microphone', isDefault: true },
    ];
    this.simulatedPeakRms = options.simulatedPeakRms ?? 0.35;
    this.simulatedDurationMs = options.simulatedDurationMs ?? 1200;
  }

  setPermission(permission: MicPermissionStatus): void {
    this.permission = permission;
  }

  setSimulatedPeakRms(rms: number): void {
    this.simulatedPeakRms = rms;
  }

  async checkMicPermissionAndDevices(): Promise<Result<MicPreflightStatus, AudioError>> {
    return ok({
      permission: this.permission,
      devices: this.devices,
      activeContentType: this.activeContentType,
    });
  }

  async runPreflightLoopbackTest(
    durationMs: number,
    onLevel: (rms01: number) => void,
  ): Promise<Result<LoopbackTestResult, AudioError>> {
    if (this.permission === 'denied') {
      return err({
        kind: 'audio',
        code: 'PERMISSION_DENIED',
        message: 'Microphone permission denied.',
      });
    }
    if (this.devices.length === 0) {
      return err({
        kind: 'audio',
        code: 'NO_MICROPHONE',
        message: 'No microphone devices available.',
      });
    }
    onLevel(this.simulatedPeakRms);
    return ok({
      blobUrl: 'blob:fake-loopback-audio',
      peakRms: this.simulatedPeakRms,
      isMutedWarning: this.simulatedPeakRms < 0.01,
      durationMs,
    });
  }

  async startRecording(
    options: StartRecordingOptions,
  ): Promise<Result<ActiveRecordingHandle, AudioError>> {
    if (this.permission === 'denied') {
      return err({
        kind: 'audio',
        code: 'PERMISSION_DENIED',
        message: 'Microphone permission denied.',
      });
    }
    if (this.devices.length === 0) {
      return err({
        kind: 'audio',
        code: 'NO_MICROPHONE',
        message: 'No microphone devices available.',
      });
    }

    let stopped = false;
    let cancelled = false;
    options.onLevel(this.simulatedPeakRms);

    return ok({
      stop: async (): Promise<Result<RecordedClip, AudioError>> => {
        if (stopped || cancelled) {
          return err({
            kind: 'audio',
            code: 'RECORDING_FAILED',
            message: 'Recording already stopped or cancelled.',
          });
        }
        stopped = true;
        const payload = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
        const blob = new Blob([payload], { type: this.activeContentType });
        return ok({
          blob,
          mimeType: this.activeContentType,
          strippedContentType: this.activeContentType,
          durationMs: this.simulatedDurationMs,
          byteLength: blob.size,
          peakRms: this.simulatedPeakRms,
          isMutedWarning: this.simulatedPeakRms < 0.01,
        });
      },
      cancel: (): void => {
        cancelled = true;
        stopped = true;
      },
    });
  }
}

export class FakeAudioPlayerAdapter implements IAudioPlayerGateway {
  private mode: AudioPlaybackMode = 'study_interactive';
  private readonly defaultDurationSec: number;

  constructor(options: { readonly initialMode?: AudioPlaybackMode; readonly defaultDurationSec?: number } = {}) {
    this.mode = options.initialMode ?? 'study_interactive';
    this.defaultDurationSec = options.defaultDurationSec ?? 60;
  }

  setPlaybackMode(mode: AudioPlaybackMode): void {
    this.mode = mode;
  }

  async loadSource(src: AudioSourceSpec): Promise<Result<AudioTrackHandle, AudioError>> {
    if (!src.fallbackUrl && !src.mediaKey) {
      return err({
        kind: 'audio',
        code: 'PLAYBACK_FAILED',
        message: 'Missing audio source.',
      });
    }

    const snapshottedMode = this.mode;
    let status: AudioTrackPlaybackStatus = 'ready';
    let currentTimeSec = 0;
    const durationSec = this.defaultDurationSec;
    let playbackRate = 1.0;
    let hasPlayedOnce = false;
    let disposed = false;
    const listeners = new Set<(state: AudioPlaybackState) => void>();

    const snapshot = (): AudioPlaybackState => ({
      mode: snapshottedMode,
      status,
      currentTimeSec,
      durationSec,
      playbackRate,
      hasPlayedOnce,
    });

    const emit = (): void => {
      if (disposed) return;
      const state = snapshot();
      for (const listener of listeners) {
        listener(state);
      }
    };

    return ok({
      play: async (): Promise<Result<void, AudioError>> => {
        if (disposed) {
          return err({ kind: 'audio', code: 'PLAYBACK_FAILED', message: 'Track disposed.' });
        }
        if (snapshottedMode === 'exam_linear_locked' && hasPlayedOnce) {
          return err({
            kind: 'audio',
            code: 'LOCKED_EXAM_PLAYBACK',
            message: 'Exam audio can only be played once in exam_linear_locked mode.',
          });
        }
        status = 'playing';
        emit();
        // Simulate completing linear playback in fake player so subsequent play() tests 1-play lock.
        currentTimeSec = durationSec;
        hasPlayedOnce = true;
        status = 'ended';
        emit();
        return ok(undefined);
      },

      pause: (): Result<void, AudioError> => {
        if (disposed) {
          return err({ kind: 'audio', code: 'PLAYBACK_FAILED', message: 'Track disposed.' });
        }
        if (status !== 'ended') {
          status = 'paused';
        }
        emit();
        return ok(undefined);
      },

      seek: (seconds: number): Result<void, AudioError> => {
        if (disposed) {
          return err({ kind: 'audio', code: 'PLAYBACK_FAILED', message: 'Track disposed.' });
        }
        if (snapshottedMode === 'exam_linear_locked') {
          return err({
            kind: 'audio',
            code: 'LOCKED_EXAM_PLAYBACK',
            message: 'Seeking is disabled in exam_linear_locked mode.',
          });
        }
        if (!Number.isFinite(seconds) || seconds < 0) {
          return err({ kind: 'audio', code: 'PLAYBACK_FAILED', message: 'Invalid seek target.' });
        }
        currentTimeSec = Math.min(seconds, durationSec);
        emit();
        return ok(undefined);
      },

      setSpeed: (rate: number): Result<void, AudioError> => {
        if (disposed) {
          return err({ kind: 'audio', code: 'PLAYBACK_FAILED', message: 'Track disposed.' });
        }
        if (snapshottedMode === 'exam_linear_locked' && Math.abs(rate - 1.0) > 1e-6) {
          return err({
            kind: 'audio',
            code: 'LOCKED_EXAM_PLAYBACK',
            message: 'Playback speed is locked to 1.0x in exam_linear_locked mode.',
          });
        }
        if (!Number.isFinite(rate) || rate <= 0) {
          return err({ kind: 'audio', code: 'PLAYBACK_FAILED', message: 'Invalid playback rate.' });
        }
        playbackRate = rate;
        emit();
        return ok(undefined);
      },

      subscribe: (listener: (state: AudioPlaybackState) => void): (() => void) => {
        listeners.add(listener);
        listener(snapshot());
        return () => {
          listeners.delete(listener);
        };
      },

      dispose: (): void => {
        disposed = true;
        listeners.clear();
      },
    });
  }
}
