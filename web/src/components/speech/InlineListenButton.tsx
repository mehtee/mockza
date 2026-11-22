import { Loader2, Square, Volume2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import {
  speakEnglishPhrase,
  stopEnglishSpeechIfOwner,
} from '@/components/speech-tts';
import type { ISpeechPracticeGateway } from '@/gateways/speech-practice.gateway';
import { useOptionalDeps } from '@/spa/deps';

export interface InlineListenButtonProps {
  readonly text: string;
  readonly voice?: string;
  readonly sourceContext?:
    | 'vocab'
    | 'reading'
    | 'listening_feedback'
    | 'speaking_feedback'
    | 'writing_feedback'
    | 'coach'
    | 'pronunciation';
  readonly showSlowToggle?: boolean;
  readonly gateway?: ISpeechPracticeGateway | null;
  readonly label?: string;
  readonly testId?: string;
  readonly size?: 'sm' | 'md';
}

export function InlineListenButton({
  text,
  voice,
  sourceContext = 'vocab',
  showSlowToggle = true,
  gateway,
  label,
  testId,
  size = 'sm',
}: InlineListenButtonProps) {
  const deps = useOptionalDeps();
  const ownerId = useId();
  const isRtl = deps?.edition === 'irn';
  const resolvedGateway = gateway ?? deps?.speechPractice ?? null;
  const [activeRate, setActiveRate] = useState<0.8 | 1.0 | null>(null);
  const [errorTip, setErrorTip] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      stopEnglishSpeechIfOwner(ownerId);
    };
  }, [ownerId]);

  const handlePlay = (rate: 0.8 | 1.0) => {
    if (activeRate === rate) {
      stopEnglishSpeechIfOwner(ownerId);
      setActiveRate(null);
      return;
    }
    setErrorTip(null);
    setActiveRate(rate);
    const started = speakEnglishPhrase(text, {
      ownerId,
      rate,
      voice,
      sourceContext,
      gateway: resolvedGateway,
      onEnd: () => setActiveRate(null),
      onError: () => {
        setActiveRate(null);
        setErrorTip(isRtl ? 'خطا در پخش صوت' : 'Audio unavailable');
      },
    });
    if (!started) {
      setActiveRate(null);
      setErrorTip(isRtl ? 'پخش آنلاین صوت نیاز است' : 'Online TTS required');
    }
  };

  const padCls = size === 'sm' ? 'h-7 px-2 text-[11px]' : 'h-8 px-3 text-xs';

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <button
        type="button"
        data-testid={testId ?? 'inline-listen-1x'}
        onClick={() => handlePlay(1.0)}
        disabled={!text.trim()}
        className={`inline-flex ${padCls} items-center gap-1.5 rounded-[var(--mz-radius-compact)] border font-semibold transition-colors ${
          activeRate === 1.0
            ? 'border-primary bg-primary text-on-primary'
            : 'border-border-subtle bg-canvas text-text-primary hover:border-primary'
        }`}
      >
        {activeRate === 1.0 ? (
          <Square className="h-3 w-3 fill-current" aria-hidden="true" />
        ) : (
          <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span>{label ?? (isRtl ? 'گوش دادن' : 'Listen')}</span>
      </button>

      {showSlowToggle ? (
        <button
          type="button"
          data-testid={testId ? `${testId}-slow` : 'inline-listen-08x'}
          onClick={() => handlePlay(0.8)}
          disabled={!text.trim()}
          title={isRtl ? 'پخش با سرعت آهسته (۰.۸x)' : 'Listen slower (0.8x)'}
          className={`inline-flex ${padCls} items-center gap-1 rounded-[var(--mz-radius-compact)] border font-semibold transition-colors ${
            activeRate === 0.8
              ? 'border-primary bg-primary text-on-primary'
              : 'border-border-subtle bg-canvas text-text-secondary hover:border-primary hover:text-text-primary'
          }`}
        >
          {activeRate === 0.8 ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : null}
          <span>{isRtl ? '۰.۸x' : '0.8x'}</span>
        </button>
      ) : null}

      {errorTip ? (
        <span className="text-[11px] font-medium text-error">{errorTip}</span>
      ) : null}
    </span>
  );
}
