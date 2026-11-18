import type { AudioError, Result } from './result';

export type AudioPlaybackMode = 'exam_linear_locked' | 'study_interactive';

export type MicPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unavailable';

export interface AudioInputDeviceInfo {
  readonly deviceId: string;
  readonly label: string;
  readonly isDefault: boolean;
}

export interface MicPreflightStatus {
  readonly permission: MicPermissionStatus;
  readonly devices: readonly AudioInputDeviceInfo[];
  readonly activeContentType: string;
}

export interface LoopbackTestResult {
  readonly blobUrl: string;
  readonly peakRms: number;
  readonly isMutedWarning: boolean;
  readonly durationMs: number;
}

export interface RecordedClip {
  readonly blob: Blob;
  readonly mimeType: string;
  readonly strippedContentType: string;
  readonly durationMs: number;
  readonly byteLength: number;
  readonly peakRms: number;
  readonly isMutedWarning: boolean;
}

export interface StartRecordingOptions {
  readonly deviceId?: string;
  readonly maxDurationSec: number;
  readonly onLevel: (rms01: number) => void;
}

export interface ActiveRecordingHandle {
  stop(): Promise<Result<RecordedClip, AudioError>>;
  cancel(): void;
}

export interface IAudioRecorderGateway {
  readonly activeContentType: string;
  checkMicPermissionAndDevices(): Promise<Result<MicPreflightStatus, AudioError>>;
  runPreflightLoopbackTest(
    durationMs: number,
    onLevel: (rms01: number) => void,
  ): Promise<Result<LoopbackTestResult, AudioError>>;
  startRecording(options: StartRecordingOptions): Promise<Result<ActiveRecordingHandle, AudioError>>;
}

export type AudioTrackPlaybackStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error';

export interface AudioPlaybackState {
  readonly mode: AudioPlaybackMode;
  readonly status: AudioTrackPlaybackStatus;
  readonly currentTimeSec: number;
  readonly durationSec: number;
  readonly playbackRate: number;
  readonly hasPlayedOnce: boolean;
}

export interface AudioSourceSpec {
  readonly mediaKey: string;
  readonly fallbackUrl: string;
  readonly expectedSha256?: string;
}

export interface AudioTrackHandle {
  play(): Promise<Result<void, AudioError>>;
  pause(): Result<void, AudioError>;
  seek(seconds: number): Result<void, AudioError>;
  setSpeed(rate: number): Result<void, AudioError>;
  subscribe(listener: (state: AudioPlaybackState) => void): () => void;
  dispose(): void;
}

export interface IAudioPlayerGateway {
  setPlaybackMode(mode: AudioPlaybackMode): void;
  loadSource(src: AudioSourceSpec): Promise<Result<AudioTrackHandle, AudioError>>;
}
