import {
  ChevronDown,
  ChevronUp,
  Info,
  Mic,
  Volume2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  MzBanner,
  MzButton,
  MzCard,
  MzSegmentedControl,
  type MzSegmentedOption,
} from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { getActiveEditionCode } from '@/edition/edition-config';
import type { LoopbackTestResult, MicPreflightStatus } from '@/gateways/audio.gateway';
import { createTranslator } from '@/i18n';
import { useOptionalDeps } from '@/spa/deps';

export interface CompactPreflightHeaderProps<TMode extends string = string> {
  readonly title: string;
  readonly subtitle?: string;
  readonly modeOptions: readonly MzSegmentedOption<TMode>[];
  readonly selectedMode: TMode;
  readonly onModeChange: (mode: TMode) => void;
  readonly rulesSummary?: readonly string[];
  readonly includeMicCheck?: boolean;
  readonly includeSpeakerCheck?: boolean;
  readonly onPlaySpeakerTest?: () => Promise<void> | void;
  readonly onMicStatusReady?: (ready: boolean) => void;
}

export function CompactPreflightHeader<TMode extends string = string>({
  title,
  subtitle,
  modeOptions,
  selectedMode,
  onModeChange,
  rulesSummary = [],
  includeMicCheck = true,
  includeSpeakerCheck = true,
  onPlaySpeakerTest,
  onMicStatusReady,
}: CompactPreflightHeaderProps<TMode>) {
  const deps = useOptionalDeps();
  const edition = deps?.edition ?? getActiveEditionCode();
  const t = createTranslator(edition);

  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [isPlayingSound, setIsPlayingSound] = useState(false);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micLevelRms, setMicLevelRms] = useState(0);
  const [micStatus, setMicStatus] = useState<MicPreflightStatus | null>(null);
  const [loopback, setLoopback] = useState<LoopbackTestResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSpeakerCheck = useCallback(async () => {
    setIsPlayingSound(true);
    try {
      if (onPlaySpeakerTest) {
        await onPlaySpeakerTest();
      } else if (typeof window !== 'undefined' && 'AudioContext' in window) {
        const AudioCtx = window.AudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 523.25;
        gain.gain.value = 0.08;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        await new Promise<void>((resolve) => {
          window.setTimeout(() => {
            osc.stop();
            void ctx.close();
            resolve();
          }, 350);
        });
      }
    } finally {
      setIsPlayingSound(false);
    }
  }, [onPlaySpeakerTest]);

  const handleMicCheck = useCallback(async () => {
    if (!deps) return;
    setErrorMessage(null);
    setIsTestingMic(true);
    setLoopback(null);

    const statusRes = await deps.audioRecorder.checkMicPermissionAndDevices();
    if (!statusRes.ok) {
      setIsTestingMic(false);
      setErrorMessage(statusRes.error.message);
      onMicStatusReady?.(false);
      return;
    }
    setMicStatus(statusRes.value);
    if (statusRes.value.permission === 'denied') {
      setIsTestingMic(false);
      onMicStatusReady?.(false);
      return;
    }

    const testRes = await deps.audioRecorder.runPreflightLoopbackTest(1200, (rms) => {
      setMicLevelRms(rms);
    });
    setIsTestingMic(false);

    if (!testRes.ok) {
      setErrorMessage(testRes.error.message);
      onMicStatusReady?.(false);
      return;
    }

    setLoopback(testRes.value);
    setMicLevelRms(testRes.value.peakRms);
    onMicStatusReady?.(!testRes.value.isMutedWarning);
  }, [deps, onMicStatusReady]);

  useEffect(() => {
    const url = loopback?.blobUrl;
    return () => {
      if (url && url.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(url);
      }
    };
  }, [loopback?.blobUrl]);

  return (
    <MzCard variant="default" padding="sm" data-testid="compact-preflight-header">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-text-primary">{title}</h2>
            {rulesSummary.length > 0 ? (
              <button
                type="button"
                data-testid="preflight-rules-toggle"
                aria-expanded={rulesExpanded}
                onClick={() => setRulesExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-[var(--mz-radius-pill)] border border-border-subtle bg-bg-raised px-2.5 py-0.5 text-[11px] font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              >
                <Info className="h-3 w-3" aria-hidden="true" />
                <span>{t('preflightRulesToggleLabel')}</span>
                {rulesExpanded ? (
                  <ChevronUp className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-3 w-3" aria-hidden="true" />
                )}
              </button>
            ) : null}
          </div>
          {subtitle ? <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p> : null}
        </div>

        <MzSegmentedControl
          ariaLabel={title}
          options={modeOptions}
          value={selectedMode}
          onChange={onModeChange}
        />
      </div>

      {(includeSpeakerCheck || includeMicCheck) && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border-subtle pt-3">
          {includeSpeakerCheck ? (
            <MzButton
              variant="secondary"
              size="sm"
              data-testid="preflight-speaker-btn"
              isLoading={isPlayingSound}
              leadingIcon={<Volume2 className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => void handleSpeakerCheck()}
            >
              {isPlayingSound ? t('preflightSoundCheckingLabel') : t('preflightSoundCheckAction')}
            </MzButton>
          ) : null}

          {includeMicCheck ? (
            <div className="flex min-w-[240px] flex-1 flex-wrap items-center gap-3">
              <MzButton
                variant="secondary"
                size="sm"
                data-testid="preflight-mic-btn"
                isLoading={isTestingMic}
                leadingIcon={<Mic className="h-3.5 w-3.5" aria-hidden="true" />}
                onClick={() => void handleMicCheck()}
              >
                {isTestingMic ? t('settingsMicTestingLabel') : t('settingsMicTestAction')}
              </MzButton>

              <div className="flex min-w-[140px] flex-1 items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-alt">
                  <div
                    data-testid="preflight-mic-meter-fill"
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, Math.round(micLevelRms * 100))}%` }}
                  />
                </div>
                <LtrExamBoundary>
                  <span className="font-mono-exam text-xs text-text-secondary">
                    {Math.round(micLevelRms * 100)}%
                  </span>
                </LtrExamBoundary>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {rulesExpanded && rulesSummary.length > 0 ? (
        <ul
          data-testid="preflight-rules-popover"
          className="mt-3 flex flex-col gap-1.5 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3 text-xs text-text-secondary"
        >
          {rulesSummary.map((rule) => (
            <li key={rule}>• {rule}</li>
          ))}
        </ul>
      ) : null}

      {micStatus?.permission === 'denied' ? (
        <div className="mt-3">
          <MzBanner tone="warning">{t('settingsMicPermissionDenied')}</MzBanner>
        </div>
      ) : null}

      {loopback?.isMutedWarning ? (
        <div className="mt-3">
          <MzBanner tone="warning">{t('settingsMicMutedWarning')}</MzBanner>
        </div>
      ) : null}

      {loopback?.blobUrl ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3 py-2">
          <Volume2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span className="text-xs font-medium text-text-secondary">
            {t('preflightLoopbackPlaybackLabel')}
          </span>
          <audio
            controls
            data-testid="preflight-loopback-audio"
            src={loopback.blobUrl}
            aria-label={t('preflightLoopbackPlaybackLabel')}
            className="h-8 max-w-xs flex-1"
          />
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-3">
          <MzBanner tone="danger">{errorMessage}</MzBanner>
        </div>
      ) : null}
    </MzCard>
  );
}
