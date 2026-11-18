import { Mic, Square, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MzBanner, MzButton } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { getActiveEditionCode } from '@/edition/edition-config';
import type { ActiveRecordingHandle, RecordedClip } from '@/gateways/audio.gateway';
import { createTranslator } from '@/i18n';
import { useOptionalDeps } from '@/spa/deps';
import { formatMmSs } from './SimulatorWorkspaceShell';

export interface WaveformMicRecorderProps {
  readonly maxDurationSec: number;
  readonly deviceId?: string;
  readonly disabled?: boolean;
  readonly allowPreviewPlayback?: boolean;
  readonly onRecordingComplete: (clip: RecordedClip) => void;
  readonly onRecordingStart?: () => void;
}

const WAVEFORM_BAR_COUNT = 44;

export function WaveformMicRecorder({
  maxDurationSec,
  deviceId,
  disabled = false,
  allowPreviewPlayback = true,
  onRecordingComplete,
  onRecordingStart,
}: WaveformMicRecorderProps) {
  const deps = useOptionalDeps();
  const edition = deps?.edition ?? getActiveEditionCode();
  const t = createTranslator(edition);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<ActiveRecordingHandle | null>(null);
  const samplesRef = useRef<number[]>(new Array<number>(WAVEFORM_BAR_COUNT).fill(0.05));
  const rafRef = useRef<number | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [currentRms, setCurrentRms] = useState(0);
  const [lastClip, setLastClip] = useState<RecordedClip | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const bars = samplesRef.current;
    const barGap = 2;
    const barWidth = Math.max(2, (width - barGap * (bars.length - 1)) / bars.length);

    for (let i = 0; i < bars.length; i += 1) {
      const level = Math.max(0.08, Math.min(1, bars[i] ?? 0.08));
      const barHeight = Math.max(4, level * (height - 8));
      const x = i * (barWidth + barGap);
      const y = (height - barHeight) / 2;
      ctx.fillStyle = isRecording ? '#9580FF' : '#4E5D78';
      ctx.fillRect(x, y, barWidth, barHeight);
    }

    if (isRecording) {
      rafRef.current = window.requestAnimationFrame(drawWaveform);
    }
  }, [isRecording]);

  useEffect(() => {
    drawWaveform();
    return () => {
      if (rafRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [drawWaveform]);

  useEffect(() => {
    return () => {
      handleRef.current?.cancel();
      if (previewUrl) {
        URL.revokeObjectURL?.(previewUrl);
      }
    };
  }, [previewUrl]);

  const stopRecording = useCallback(async () => {
    const active = handleRef.current;
    if (!active) return;
    handleRef.current = null;
    setIsRecording(false);

    const res = await active.stop();
    if (!res.ok) {
      setErrorMessage(res.error.message);
      return;
    }

    setLastClip(res.value);
    if (allowPreviewPlayback && typeof URL.createObjectURL === 'function') {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(res.value.blob));
    }
    onRecordingComplete(res.value);
  }, [allowPreviewPlayback, onRecordingComplete, previewUrl]);

  useEffect(() => {
    if (!isRecording) return;
    const timer = window.setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 1;
        if (next >= maxDurationSec) {
          void stopRecording();
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRecording, maxDurationSec, stopRecording]);

  const startRecording = useCallback(async () => {
    const recorder = deps?.audioRecorder;
    if (!recorder || disabled || isRecording) return;

    setErrorMessage(null);
    setLastClip(null);
    setElapsedSec(0);
    samplesRef.current = new Array<number>(WAVEFORM_BAR_COUNT).fill(0.08);

    const res = await recorder.startRecording({
      deviceId,
      maxDurationSec,
      onLevel: (rms) => {
        const clamped = Math.max(0, Math.min(1, rms));
        setCurrentRms(clamped);
        samplesRef.current = [...samplesRef.current.slice(1), clamped];
      },
    });

    if (!res.ok) {
      setErrorMessage(res.error.message);
      return;
    }

    handleRef.current = res.value;
    setIsRecording(true);
    onRecordingStart?.();
  }, [deps?.audioRecorder, deviceId, disabled, isRecording, maxDurationSec, onRecordingStart]);

  return (
    <div
      data-testid="waveform-mic-recorder"
      data-recording={isRecording ? 'true' : 'false'}
      className="flex flex-col gap-3 rounded-[var(--mz-radius-control)] border border-border-subtle bg-bg-raised p-4"
    >
      {errorMessage ? <MzBanner tone="danger">{errorMessage}</MzBanner> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={[
              'h-2.5 w-2.5 rounded-full',
              isRecording ? 'bg-error animate-pulse' : 'bg-success',
            ].join(' ')}
          />
          <span className="text-xs font-semibold text-text-primary">
            {isRecording ? t('recorderRecordingStatus') : t('recorderReadyStatus')}
          </span>
        </div>

        <LtrExamBoundary>
          <span
            data-testid="recorder-timer"
            className="font-mono-exam text-xs font-bold text-text-secondary tabular-nums"
          >
            {formatMmSs(elapsedSec)} / {formatMmSs(maxDurationSec)}
          </span>
        </LtrExamBoundary>
      </div>

      {/* 60fps Canvas Waveform Meter */}
      <div className="relative overflow-hidden rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas p-2">
        <canvas
          ref={canvasRef}
          width={520}
          height={64}
          data-testid="recorder-waveform-canvas"
          className="h-16 w-full"
        />
        <span className="sr-only" data-testid="recorder-rms-value">
          {Math.round(currentRms * 100)}%
        </span>
      </div>

      {lastClip?.isMutedWarning ? (
        <MzBanner tone="warning">{t('settingsMicMutedWarning')}</MzBanner>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {isRecording ? (
          <MzButton
            variant="danger"
            size="md"
            data-testid="recorder-stop-btn"
            leadingIcon={<Square className="h-4 w-4" aria-hidden="true" />}
            onClick={() => void stopRecording()}
          >
            {t('recorderStopAction')}
          </MzButton>
        ) : (
          <MzButton
            variant="primary"
            size="md"
            data-testid="recorder-start-btn"
            disabled={disabled || !deps?.audioRecorder}
            leadingIcon={<Mic className="h-4 w-4" aria-hidden="true" />}
            onClick={() => void startRecording()}
          >
            {t('recorderStartAction')}
          </MzButton>
        )}

        {allowPreviewPlayback && previewUrl ? (
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-primary" aria-hidden="true" />
            <audio
              controls
              src={previewUrl}
              aria-label={t('recorderPreviewAction')}
              className="h-8 max-w-[220px]"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
