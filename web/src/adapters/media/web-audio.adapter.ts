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

export const AUDIO_MIME_PROBE_ORDER = [
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
] as const;

export const MUTED_MIC_PEAK_RMS_THRESHOLD = 0.01;
const LEVEL_POLL_INTERVAL_MS = 16;

export function stripAudioMimeCodecs(mimeType: string): string {
  const base = mimeType.split(';')[0]?.trim().toLowerCase();
  return base && base.length > 0 ? base : 'audio/webm';
}

export function probeSupportedAudioMime(
  isTypeSupported?: (mime: string) => boolean,
): string {
  const checker =
    isTypeSupported ??
    ((mime: string): boolean => {
      if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
        return false;
      }
      try {
        return MediaRecorder.isTypeSupported(mime);
      } catch {
        return false;
      }
    });

  for (const candidate of AUDIO_MIME_PROBE_ORDER) {
    if (checker(candidate)) {
      return candidate;
    }
  }
  return 'audio/webm';
}

/**
 * Computes normalized `[0..1]` RMS amplitude from either float or byte time-domain samples.
 */
export function computeRms01FromTimeDomain(samples: Float32Array | Uint8Array): number {
  if (samples.length === 0) return 0;
  let sumSq = 0;
  if (samples instanceof Float32Array) {
    for (let i = 0; i < samples.length; i++) {
      const v = samples[i] ?? 0;
      sumSq += v * v;
    }
  } else {
    for (let i = 0; i < samples.length; i++) {
      const normalized = ((samples[i] ?? 128) - 128) / 128;
      sumSq += normalized * normalized;
    }
  }
  const rms = Math.sqrt(sumSq / samples.length);
  if (!Number.isFinite(rms)) return 0;
  return Math.max(0, Math.min(1, rms));
}

export interface AnalyserNodeLike {
  fftSize: number;
  readonly frequencyBinCount: number;
  getFloatTimeDomainData?(array: Float32Array<ArrayBuffer>): void;
  getByteTimeDomainData?(array: Uint8Array<ArrayBuffer>): void;
}

export interface AudioContextLike {
  readonly state?: string;
  resume?(): Promise<void>;
  close(): Promise<void>;
  createMediaStreamSource(stream: MediaStream): {
    connect(destination: AnalyserNodeLike): void;
    disconnect?(): void;
  };
  createAnalyser(): AnalyserNodeLike;
}

export interface MediaRecorderLike {
  readonly mimeType: string;
  readonly state: string;
  ondataavailable: ((event: { readonly data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
  start(timeslice?: number): void;
  stop(): void;
}

export interface WebAudioRecorderOptions {
  readonly isTypeSupported?: (mime: string) => boolean;
  readonly mediaDevices?: Pick<MediaDevices, 'enumerateDevices' | 'getUserMedia'> | null;
  readonly permissions?: Pick<Permissions, 'query'> | null;
  readonly createAudioContext?: () => AudioContextLike;
  readonly createMediaRecorder?: (
    stream: MediaStream,
    options: { mimeType: string },
  ) => MediaRecorderLike;
  readonly nowMs?: () => number;
}

function mapGetUserMediaError(cause: unknown): AudioError {
  const errName =
    typeof cause === 'object' && cause !== null && 'name' in cause
      ? String((cause as { name: unknown }).name)
      : '';
  const errMessage = cause instanceof Error ? cause.message : String(cause);

  if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
    return {
      kind: 'audio',
      code: 'PERMISSION_DENIED',
      message: `Microphone permission denied: ${errMessage}`,
    };
  }
  if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
    return {
      kind: 'audio',
      code: 'NO_MICROPHONE',
      message: `No microphone device found: ${errMessage}`,
    };
  }
  return {
    kind: 'audio',
    code: 'RECORDING_FAILED',
    message: `Unable to access microphone: ${errMessage}`,
  };
}

function stopMediaStream(stream: MediaStream): void {
  try {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  } catch {
    // Ignore track cleanup failures.
  }
}

export class WebAudioRecorderAdapter implements IAudioRecorderGateway {
  private readonly recorderMimeType: string;
  readonly activeContentType: string;
  private readonly options: WebAudioRecorderOptions;

  constructor(options: WebAudioRecorderOptions = {}) {
    this.options = options;
    this.recorderMimeType = probeSupportedAudioMime(options.isTypeSupported);
    this.activeContentType = stripAudioMimeCodecs(this.recorderMimeType);
  }

  private getMediaDevices(): Pick<MediaDevices, 'enumerateDevices' | 'getUserMedia'> | null {
    if (this.options.mediaDevices !== undefined) return this.options.mediaDevices;
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      return navigator.mediaDevices;
    }
    return null;
  }

  private async queryMicPermission(): Promise<MicPermissionStatus> {
    const permissions =
      this.options.permissions !== undefined
        ? this.options.permissions
        : typeof navigator !== 'undefined'
          ? navigator.permissions
          : null;
    if (!permissions || typeof permissions.query !== 'function') {
      return 'prompt';
    }
    try {
      const status = await permissions.query({ name: 'microphone' as PermissionName });
      if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
        return status.state;
      }
      return 'prompt';
    } catch {
      return 'prompt';
    }
  }

  async checkMicPermissionAndDevices(): Promise<Result<MicPreflightStatus, AudioError>> {
    const mediaDevices = this.getMediaDevices();
    if (!mediaDevices || typeof mediaDevices.enumerateDevices !== 'function') {
      return ok({
        permission: 'unavailable',
        devices: [],
        activeContentType: this.activeContentType,
      });
    }

    try {
      const [permission, rawDevices] = await Promise.all([
        this.queryMicPermission(),
        mediaDevices.enumerateDevices(),
      ]);

      const audioInputs: AudioInputDeviceInfo[] = rawDevices
        .filter((d) => d.kind === 'audioinput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${index + 1}`,
          isDefault: d.deviceId === 'default' || index === 0,
        }));

      const resolvedPermission: MicPermissionStatus =
        permission === 'prompt' && audioInputs.some((d) => d.label.length > 0 && !d.label.startsWith('Microphone '))
          ? 'granted'
          : permission;

      return ok({
        permission: resolvedPermission,
        devices: audioInputs,
        activeContentType: this.activeContentType,
      });
    } catch (cause) {
      return err(mapGetUserMediaError(cause));
    }
  }

  async runPreflightLoopbackTest(
    durationMs: number,
    onLevel: (rms01: number) => void,
  ): Promise<Result<LoopbackTestResult, AudioError>> {
    const boundedDurationMs = Math.max(100, Math.min(10_000, durationMs));
    const startRes = await this.startRecording({
      maxDurationSec: Math.ceil(boundedDurationMs / 1000) + 1,
      onLevel,
    });
    if (!startRes.ok) return startRes;

    const handle = startRes.value;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, boundedDurationMs);
    });

    const stopRes = await handle.stop();
    if (!stopRes.ok) return stopRes;

    const clip = stopRes.value;
    const blobUrl =
      typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(clip.blob)
        : '';

    return ok({
      blobUrl,
      peakRms: clip.peakRms,
      isMutedWarning: clip.isMutedWarning,
      durationMs: clip.durationMs,
    });
  }

  async startRecording(
    options: StartRecordingOptions,
  ): Promise<Result<ActiveRecordingHandle, AudioError>> {
    const mediaDevices = this.getMediaDevices();
    if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
      return err({
        kind: 'audio',
        code: 'NO_MICROPHONE',
        message: 'navigator.mediaDevices.getUserMedia is unavailable',
      });
    }

    let stream: MediaStream;
    try {
      stream = await mediaDevices.getUserMedia({
        audio: options.deviceId ? { deviceId: { exact: options.deviceId } } : true,
      });
    } catch (cause) {
      return err(mapGetUserMediaError(cause));
    }

    let recorder: MediaRecorderLike;
    try {
      if (this.options.createMediaRecorder) {
        recorder = this.options.createMediaRecorder(stream, {
          mimeType: this.recorderMimeType,
        });
      } else if (typeof MediaRecorder !== 'undefined') {
        recorder = new MediaRecorder(stream, {
          mimeType: this.recorderMimeType,
        }) as unknown as MediaRecorderLike;
      } else {
        stopMediaStream(stream);
        return err({
          kind: 'audio',
          code: 'CODEC_UNSUPPORTED',
          message: 'MediaRecorder API is unavailable in this environment',
        });
      }
    } catch (cause) {
      stopMediaStream(stream);
      return err({
        kind: 'audio',
        code: 'CODEC_UNSUPPORTED',
        message: `Failed to initialize MediaRecorder (${this.recorderMimeType}): ${cause instanceof Error ? cause.message : String(cause)}`,
      });
    }

    const nowMs = this.options.nowMs ?? (() => Date.now());
    const startedAtMs = nowMs();
    const chunks: Blob[] = [];
    let peakRms = 0;
    let isCancelled = false;
    let isStopped = false;
    let rafId: number | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let maxDurationTimer: ReturnType<typeof setTimeout> | null = null;

    let audioCtx: AudioContextLike | null = null;
    try {
      if (this.options.createAudioContext) {
        audioCtx = this.options.createAudioContext();
      } else if (typeof AudioContext !== 'undefined') {
        audioCtx = new AudioContext() as unknown as AudioContextLike;
      }
      if (audioCtx) {
        if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
          void audioCtx.resume().catch(() => {});
        }
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const floatBuffer = new Float32Array(analyser.fftSize);
        const byteBuffer = new Uint8Array(analyser.fftSize);

        const sampleRms = (): void => {
          if (isStopped || isCancelled) return;
          let rms = 0;
          if (typeof analyser.getFloatTimeDomainData === 'function') {
            analyser.getFloatTimeDomainData(floatBuffer);
            rms = computeRms01FromTimeDomain(floatBuffer);
          } else if (typeof analyser.getByteTimeDomainData === 'function') {
            analyser.getByteTimeDomainData(byteBuffer);
            rms = computeRms01FromTimeDomain(byteBuffer);
          }
          if (rms > peakRms) peakRms = rms;
          options.onLevel(rms);
        };

        if (typeof requestAnimationFrame === 'function') {
          const tick = (): void => {
            if (isStopped || isCancelled) return;
            sampleRms();
            rafId = requestAnimationFrame(tick);
          };
          rafId = requestAnimationFrame(tick);
        } else {
          intervalId = setInterval(sampleRms, LEVEL_POLL_INTERVAL_MS);
        }
      }
    } catch {
      // Proceed even if WebAudio AnalyserNode fails in constrained environments.
    }

    const cleanupResources = (): void => {
      if (rafId !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (maxDurationTimer !== null) {
        clearTimeout(maxDurationTimer);
        maxDurationTimer = null;
      }
      stopMediaStream(stream);
      if (audioCtx) {
        void audioCtx.close().catch(() => {});
        audioCtx = null;
      }
    };

    let stopResolve: ((result: Result<RecordedClip, AudioError>) => void) | null = null;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onerror = (cause) => {
      cleanupResources();
      if (stopResolve) {
        const resolve = stopResolve;
        stopResolve = null;
        resolve(
          err({
            kind: 'audio',
            code: 'RECORDING_FAILED',
            message: `MediaRecorder error: ${cause instanceof Error ? cause.message : String(cause)}`,
          }),
        );
      }
    };

    recorder.onstop = () => {
      cleanupResources();
      if (isCancelled) {
        if (stopResolve) {
          const resolve = stopResolve;
          stopResolve = null;
          resolve(
            err({
              kind: 'audio',
              code: 'RECORDING_FAILED',
              message: 'Recording cancelled',
            }),
          );
        }
        return;
      }

      const finalMime = recorder.mimeType || this.recorderMimeType;
      const blob = new Blob(chunks, { type: finalMime });
      const durationMs = Math.max(0, nowMs() - startedAtMs);
      const isMutedWarning = peakRms < MUTED_MIC_PEAK_RMS_THRESHOLD;

      if (stopResolve) {
        const resolve = stopResolve;
        stopResolve = null;
        resolve(
          ok({
            blob,
            mimeType: finalMime,
            strippedContentType: stripAudioMimeCodecs(finalMime),
            durationMs,
            byteLength: blob.size,
            peakRms,
            isMutedWarning,
          }),
        );
      }
    };

    try {
      recorder.start(100);
    } catch (cause) {
      cleanupResources();
      return err({
        kind: 'audio',
        code: 'RECORDING_FAILED',
        message: `Failed to start MediaRecorder: ${cause instanceof Error ? cause.message : String(cause)}`,
      });
    }

    const stopInternal = (): Promise<Result<RecordedClip, AudioError>> => {
      if (isStopped) {
        return Promise.resolve(
          err({
            kind: 'audio',
            code: 'RECORDING_FAILED',
            message: 'Recording already stopped',
          }),
        );
      }
      isStopped = true;
      return new Promise((resolve) => {
        stopResolve = resolve;
        try {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          } else {
            recorder.onstop?.();
          }
        } catch (cause) {
          cleanupResources();
          stopResolve = null;
          resolve(
            err({
              kind: 'audio',
              code: 'RECORDING_FAILED',
              message: `Failed to stop MediaRecorder: ${cause instanceof Error ? cause.message : String(cause)}`,
            }),
          );
        }
      });
    };

    if (options.maxDurationSec > 0 && Number.isFinite(options.maxDurationSec)) {
      maxDurationTimer = setTimeout(() => {
        if (!isStopped && !isCancelled) {
          void stopInternal();
        }
      }, options.maxDurationSec * 1000);
    }

    return ok({
      stop: stopInternal,
      cancel: () => {
        if (isStopped || isCancelled) return;
        isCancelled = true;
        isStopped = true;
        try {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        } catch {
          // Ignore recorder stop errors on cancel so cleanupResources() always completes cleanly.
        } finally {
          cleanupResources();
        }
      },
    });
  }
}

export interface AudioElementLike {
  src: string;
  currentTime: number;
  readonly duration: number;
  playbackRate: number;
  preload?: string;
  play(): Promise<void>;
  pause(): void;
  load?(): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

export interface WebAudioPlayerOptions {
  readonly initialMode?: AudioPlaybackMode;
  readonly resolveMediaUrl?: (src: AudioSourceSpec) => Promise<Result<string, AudioError>>;
  readonly createAudioElement?: (url: string) => AudioElementLike;
}

export class WebAudioPlayerAdapter implements IAudioPlayerGateway {
  private mode: AudioPlaybackMode;
  private readonly resolveMediaUrl?: (
    src: AudioSourceSpec,
  ) => Promise<Result<string, AudioError>>;
  private readonly createAudioElement: (url: string) => AudioElementLike;

  constructor(options: WebAudioPlayerOptions = {}) {
    this.mode = options.initialMode ?? 'study_interactive';
    this.resolveMediaUrl = options.resolveMediaUrl;
    this.createAudioElement =
      options.createAudioElement ??
      ((url: string) => {
        const audio = new Audio(url);
        audio.preload = 'auto';
        return audio as unknown as AudioElementLike;
      });
  }

  getPlaybackMode(): AudioPlaybackMode {
    return this.mode;
  }

  setPlaybackMode(mode: AudioPlaybackMode): void {
    this.mode = mode;
  }

  async loadSource(src: AudioSourceSpec): Promise<Result<AudioTrackHandle, AudioError>> {
    // CRITICAL: Snapshot active AudioPlaybackMode at loadSource time so later
    // setPlaybackMode() calls cannot unlock an active exam_linear_locked handle.
    const snapshottedMode: AudioPlaybackMode = this.mode;

    let resolvedUrl = src.fallbackUrl;
    let ownsBlobUrl = false;
    if (this.resolveMediaUrl) {
      const urlRes = await this.resolveMediaUrl(src);
      if (!urlRes.ok) return urlRes;
      resolvedUrl = urlRes.value;
      ownsBlobUrl = resolvedUrl.startsWith('blob:') && resolvedUrl !== src.fallbackUrl;
    }

    if (!resolvedUrl) {
      return err({
        kind: 'audio',
        code: 'PLAYBACK_FAILED',
        message: `Missing playable URL for mediaKey ${src.mediaKey}`,
      });
    }

    let element: AudioElementLike;
    try {
      element = this.createAudioElement(resolvedUrl);
      element.playbackRate = 1.0;
    } catch (cause) {
      if (ownsBlobUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        try {
          URL.revokeObjectURL(resolvedUrl);
        } catch {
          // Ignore revoke failures.
        }
      }
      return err({
        kind: 'audio',
        code: 'PLAYBACK_FAILED',
        message: `Unable to initialize audio element: ${cause instanceof Error ? cause.message : String(cause)}`,
      });
    }

    let status: AudioTrackPlaybackStatus = 'ready';
    let hasPlayedOnce = false;
    let disposed = false;
    const subscribers = new Set<(state: AudioPlaybackState) => void>();

    const getSnapshot = (): AudioPlaybackState => ({
      mode: snapshottedMode,
      status,
      currentTimeSec: Number.isFinite(element.currentTime) ? element.currentTime : 0,
      durationSec: Number.isFinite(element.duration) ? element.duration : 0,
      playbackRate: Number.isFinite(element.playbackRate) ? element.playbackRate : 1.0,
      hasPlayedOnce,
    });

    const emit = (): void => {
      if (disposed) return;
      const snapshot = getSnapshot();
      for (const listener of subscribers) {
        listener(snapshot);
      }
    };

    const onLoadedMetadata = (): void => {
      if (status === 'loading' || status === 'idle') {
        status = 'ready';
      }
      emit();
    };
    const onPlay = (): void => {
      status = 'playing';
      emit();
    };
    const onPause = (): void => {
      if (status !== 'ended' && status !== 'error') {
        status = 'paused';
      }
      emit();
    };
    const onTimeUpdate = (): void => {
      emit();
    };
    const onEnded = (): void => {
      hasPlayedOnce = true;
      status = 'ended';
      emit();
    };
    const onError = (): void => {
      if (!(snapshottedMode === 'exam_linear_locked' && hasPlayedOnce)) {
        status = 'error';
      }
      emit();
    };

    element.addEventListener('loadedmetadata', onLoadedMetadata);
    element.addEventListener('play', onPlay);
    element.addEventListener('pause', onPause);
    element.addEventListener('timeupdate', onTimeUpdate);
    element.addEventListener('ended', onEnded);
    element.addEventListener('error', onError);

    return ok({
      play: async (): Promise<Result<void, AudioError>> => {
        if (disposed) {
          return err({
            kind: 'audio',
            code: 'PLAYBACK_FAILED',
            message: 'Audio track handle has been disposed',
          });
        }
        if (snapshottedMode === 'exam_linear_locked' && hasPlayedOnce) {
          return err({
            kind: 'audio',
            code: 'LOCKED_EXAM_PLAYBACK',
            message: 'Exam audio can only be played once in exam_linear_locked mode',
          });
        }
        try {
          await element.play();
          status = 'playing';
          emit();
          return ok(undefined);
        } catch (cause) {
          status = 'error';
          emit();
          return err({
            kind: 'audio',
            code: 'PLAYBACK_FAILED',
            message: `Audio playback failed: ${cause instanceof Error ? cause.message : String(cause)}`,
          });
        }
      },

      pause: (): Result<void, AudioError> => {
        if (disposed) {
          return err({
            kind: 'audio',
            code: 'PLAYBACK_FAILED',
            message: 'Audio track handle has been disposed',
          });
        }
        try {
          element.pause();
          if (status !== 'ended') {
            status = 'paused';
          }
          emit();
          return ok(undefined);
        } catch (cause) {
          return err({
            kind: 'audio',
            code: 'PLAYBACK_FAILED',
            message: `Audio pause failed: ${cause instanceof Error ? cause.message : String(cause)}`,
          });
        }
      },

      seek: (seconds: number): Result<void, AudioError> => {
        if (disposed) {
          return err({
            kind: 'audio',
            code: 'PLAYBACK_FAILED',
            message: 'Audio track handle has been disposed',
          });
        }
        if (snapshottedMode === 'exam_linear_locked') {
          return err({
            kind: 'audio',
            code: 'LOCKED_EXAM_PLAYBACK',
            message: 'Seeking is disabled in exam_linear_locked mode',
          });
        }
        if (!Number.isFinite(seconds) || seconds < 0) {
          return err({
            kind: 'audio',
            code: 'PLAYBACK_FAILED',
            message: `Invalid seek target: ${seconds}`,
          });
        }
        const duration = Number.isFinite(element.duration) && element.duration > 0 ? element.duration : Infinity;
        element.currentTime = Math.min(seconds, duration);
        emit();
        return ok(undefined);
      },

      setSpeed: (rate: number): Result<void, AudioError> => {
        if (disposed) {
          return err({
            kind: 'audio',
            code: 'PLAYBACK_FAILED',
            message: 'Audio track handle has been disposed',
          });
        }
        if (snapshottedMode === 'exam_linear_locked' && Math.abs(rate - 1.0) > 1e-6) {
          return err({
            kind: 'audio',
            code: 'LOCKED_EXAM_PLAYBACK',
            message: 'Playback speed is locked to 1.0x in exam_linear_locked mode',
          });
        }
        if (!Number.isFinite(rate) || rate <= 0) {
          return err({
            kind: 'audio',
            code: 'PLAYBACK_FAILED',
            message: `Invalid playback rate: ${rate}`,
          });
        }
        element.playbackRate = rate;
        emit();
        return ok(undefined);
      },

      subscribe: (listener: (state: AudioPlaybackState) => void): (() => void) => {
        subscribers.add(listener);
        listener(getSnapshot());
        return () => {
          subscribers.delete(listener);
        };
      },

      dispose: (): void => {
        if (disposed) return;
        disposed = true;
        try {
          element.pause();
        } catch {
          // Ignore pause errors on dispose.
        }
        element.removeEventListener('loadedmetadata', onLoadedMetadata);
        element.removeEventListener('play', onPlay);
        element.removeEventListener('pause', onPause);
        element.removeEventListener('timeupdate', onTimeUpdate);
        element.removeEventListener('ended', onEnded);
        element.removeEventListener('error', onError);
        if (ownsBlobUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
          try {
            URL.revokeObjectURL(resolvedUrl);
          } catch {
            // Ignore revoke failures.
          }
        }
        subscribers.clear();
      },
    });
  }
}
