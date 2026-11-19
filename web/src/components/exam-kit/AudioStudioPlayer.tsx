import { Lock, Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MzBanner } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { getActiveEditionCode } from '@/edition/edition-config';
import type {
  AudioPlaybackMode,
  AudioPlaybackState,
  AudioSourceSpec,
  AudioTrackHandle,
} from '@/gateways/audio.gateway';
import { createTranslator } from '@/i18n';
import { useOptionalDeps } from '@/spa/deps';
import { formatMmSs } from './SimulatorWorkspaceShell';

export interface TranscriptSegmentItem {
  readonly id: string;
  readonly startSec: number;
  readonly endSec?: number;
  readonly speaker?: string;
  readonly text: string;
}

export interface AudioStudioPlayerProps {
  readonly source: AudioSourceSpec;
  readonly playbackMode: AudioPlaybackMode;
  readonly transcriptSegments?: readonly TranscriptSegmentItem[];
  readonly externalSeekRequest?: { readonly sec: number; readonly seq: number } | null;
  readonly onEnded?: () => void;
  readonly onPlaybackStateChange?: (state: AudioPlaybackState) => void;
}

const SPEED_CYCLE = [0.85, 1.0, 1.25] as const;

export function AudioStudioPlayer({
  source,
  playbackMode,
  transcriptSegments = [],
  externalSeekRequest = null,
  onEnded,
  onPlaybackStateChange,
}: AudioStudioPlayerProps) {
  const deps = useOptionalDeps();
  const edition = deps?.edition ?? getActiveEditionCode();
  const t = createTranslator(edition);

  const handleRef = useRef<AudioTrackHandle | null>(null);
  const onEndedRef = useRef(onEnded);
  const onPlaybackStateChangeRef = useRef(onPlaybackStateChange);
  onEndedRef.current = onEnded;
  onPlaybackStateChangeRef.current = onPlaybackStateChange;

  const { mediaKey, fallbackUrl, expectedSha256 } = source;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playback, setPlayback] = useState<AudioPlaybackState>({
    mode: playbackMode,
    status: 'loading',
    currentTimeSec: 0,
    durationSec: 0,
    playbackRate: 1,
    hasPlayedOnce: false,
  });

  useEffect(() => {
    const player = deps?.audioPlayer;
    if (!player) return;

    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    player.setPlaybackMode(playbackMode);
    setErrorMessage(null);

    const stableSource: AudioSourceSpec = {
      mediaKey,
      fallbackUrl,
      ...(expectedSha256 !== undefined ? { expectedSha256 } : {}),
    };

    void player.loadSource(stableSource).then((res) => {
      if (!mounted) {
        if (res.ok) res.value.dispose();
        return;
      }
      if (!res.ok) {
        setErrorMessage(res.error.message);
        setPlayback((prev) => ({ ...prev, status: 'error' }));
        return;
      }
      const handle = res.value;
      handleRef.current = handle;
      unsubscribe = handle.subscribe((nextState) => {
        if (!mounted) return;
        setPlayback(nextState);
        onPlaybackStateChangeRef.current?.(nextState);
        if (nextState.status === 'ended') {
          onEndedRef.current?.();
        }
      });
    });

    return () => {
      mounted = false;
      unsubscribe?.();
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, [deps?.audioPlayer, expectedSha256, fallbackUrl, mediaKey, playbackMode]);

  const isExamLocked = playbackMode === 'exam_linear_locked';
  const isPlaying = playback.status === 'playing';
  const isEndedLocked = isExamLocked && playback.hasPlayedOnce && playback.status === 'ended';

  const handlePlayPause = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle) return;
    if (isPlaying) {
      if (isExamLocked) return;
      handle.pause();
    } else {
      if (isEndedLocked) return;
      const res = await handle.play();
      if (!res.ok) {
        setErrorMessage(res.error.message);
      }
    }
  }, [isEndedLocked, isExamLocked, isPlaying]);

  const handleSeek = useCallback(
    (seconds: number) => {
      if (isExamLocked || !handleRef.current) return;
      const clamped = Math.max(0, Math.min(playback.durationSec || seconds, seconds));
      const res = handleRef.current.seek(clamped);
      if (!res.ok) {
        setErrorMessage(res.error.message);
      }
    },
    [isExamLocked, playback.durationSec],
  );

  useEffect(() => {
    if (!externalSeekRequest || isExamLocked || !handleRef.current) return;
    handleSeek(externalSeekRequest.sec);
  }, [externalSeekRequest, handleSeek, isExamLocked]);

  const handleCycleSpeed = useCallback(() => {
    if (isExamLocked || !handleRef.current) return;
    const currentIndex = SPEED_CYCLE.findIndex((rate) => rate === playback.playbackRate);
    const nextRate = SPEED_CYCLE[(currentIndex + 1) % SPEED_CYCLE.length] ?? 1.0;
    const res = handleRef.current.setSpeed(nextRate);
    if (!res.ok) {
      setErrorMessage(res.error.message);
    }
  }, [isExamLocked, playback.playbackRate]);

  return (
    <div data-testid="audio-studio-player" className="flex flex-col gap-3">
      {errorMessage ? <MzBanner tone="danger">{errorMessage}</MzBanner> : null}

      <div className="rounded-[var(--mz-radius-control)] border border-border-subtle bg-bg-raised p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              data-testid="audio-play-pause-btn"
              disabled={
                !handleRef.current ||
                isEndedLocked ||
                (isExamLocked && isPlaying)
              }
              aria-label={isPlaying ? t('audioPauseAction') : t('audioPlayAction')}
              onClick={() => void handlePlayPause()}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-colors hover:bg-primary-strong disabled:opacity-45"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            {!isExamLocked ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-testid="audio-rewind-5s"
                  aria-label="Rewind 5 seconds"
                  onClick={() => handleSeek(playback.currentTimeSec - 5)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-border-subtle bg-canvas text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  data-testid="audio-forward-5s"
                  aria-label="Forward 5 seconds"
                  onClick={() => handleSeek(playback.currentTimeSec + 5)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-border-subtle bg-canvas text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                >
                  <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {isExamLocked ? (
              <span
                data-testid="audio-exam-locked-badge"
                className="inline-flex items-center gap-1 rounded-[var(--mz-radius-pill)] border border-border-subtle bg-surface-alt px-2.5 py-0.5 text-[11px] font-semibold text-text-secondary"
              >
                <Lock className="h-3 w-3" aria-hidden="true" />
                {t('audioExamLockedBadge')}
              </span>
            ) : (
              <button
                type="button"
                data-testid="audio-speed-btn"
                onClick={handleCycleSpeed}
                className="rounded-[var(--mz-radius-pill)] border border-border-subtle bg-canvas px-3 py-1 font-mono-exam text-xs font-semibold text-text-primary hover:bg-surface-hover"
              >
                {playback.playbackRate}x
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <LtrExamBoundary className="flex flex-1 items-center gap-3">
            <span
              data-testid="audio-current-time"
              className="font-mono-exam text-xs text-text-secondary tabular-nums"
            >
              {formatMmSs(playback.currentTimeSec)}
            </span>
            <input
              type="range"
              aria-label="Audio position"
              data-testid="audio-seek-slider"
              min={0}
              max={Math.max(1, playback.durationSec)}
              step={0.5}
              value={playback.currentTimeSec}
              disabled={isExamLocked}
              onChange={(event) => handleSeek(Number(event.target.value))}
              className="w-full accent-primary disabled:opacity-50"
            />
            <span
              data-testid="audio-duration"
              className="font-mono-exam text-xs text-text-secondary tabular-nums"
            >
              {formatMmSs(playback.durationSec)}
            </span>
          </LtrExamBoundary>
        </div>
      </div>

      {/* Interactive Transcript in Study Mode only */}
      {!isExamLocked && transcriptSegments.length > 0 ? (
        <div
          data-testid="audio-transcript-panel"
          className="rounded-[var(--mz-radius-control)] border border-border-subtle bg-bg-raised p-3.5"
        >
          <p className="mb-2 text-xs font-semibold text-text-secondary">
            {t('audioTranscriptTitle')}
          </p>
          <LtrExamBoundary>
            <div className="flex max-h-60 flex-col gap-1.5 overflow-y-auto">
              {transcriptSegments.map((seg) => {
                const isActive =
                  playback.currentTimeSec >= seg.startSec &&
                  (seg.endSec === undefined || playback.currentTimeSec < seg.endSec);
                return (
                  <button
                    key={seg.id}
                    type="button"
                    data-testid={`transcript-segment-${seg.id}`}
                    onClick={() => handleSeek(seg.startSec)}
                    className={[
                      'flex items-start gap-2.5 rounded-[var(--mz-radius-compact)] border px-2.5 py-2 text-start text-xs transition-colors',
                      isActive
                        ? 'border-primary bg-surface-alt text-text-primary'
                        : 'border-transparent hover:bg-surface-hover text-text-secondary',
                    ].join(' ')}
                  >
                    <span className="shrink-0 font-mono-exam text-[11px] font-semibold text-primary">
                      {formatMmSs(seg.startSec)}
                    </span>
                    <span className="min-w-0 flex-1">
                      {seg.speaker ? (
                        <strong className="me-1.5 font-semibold text-text-primary">
                          {seg.speaker}:
                        </strong>
                      ) : null}
                      {seg.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </LtrExamBoundary>
        </div>
      ) : null}
    </div>
  );
}
