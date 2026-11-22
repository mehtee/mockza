import { Loader2, Mic, Play, RotateCcw, Sparkles, Square, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MzBanner, MzButton, MzCard, MzModal } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { ActiveRecordingHandle, RecordedClip } from '@/gateways/audio.gateway';
import type { PronunciationPracticeItemDto } from '@/gateways/speech-practice.gateway';
import { createTranslator } from '@/i18n';
import { useOptionalDeps } from '@/spa/deps';
import {
  getGlobalDefaultTtsAccent,
  setGlobalDefaultTtsAccent,
} from '@/components/speech-tts';
import { InlineListenButton } from './InlineListenButton';

export interface SpeechPracticeDrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly targetText: string;
  readonly practiceKind?: 'word' | 'sentence' | 'reading_excerpt' | 'feedback_shadow';
  readonly sourceRefType?:
    | 'vocab_card'
    | 'reading_passage'
    | 'listening_feedback'
    | 'writing_feedback'
    | 'speaking_feedback'
    | 'coach'
    | 'custom';
  readonly sourceRefId?: string;
  readonly examTrack?: string;
  readonly onAnalyzed?: (result: PronunciationPracticeItemDto) => void;
}

type WordFeedbackItem = PronunciationPracticeItemDto['wordsFeedback'][number];

function statusPillClasses(
  status: 'accurate' | 'needs_work' | 'missing_or_extra',
  selected: boolean,
): string {
  const ring = selected ? 'ring-2 ring-primary ring-offset-1' : '';
  switch (status) {
    case 'accurate':
      return `border-success/50 bg-mint-bg text-success ${ring}`;
    case 'needs_work':
      return `border-warning/60 bg-amber-bg text-warning ${ring}`;
    case 'missing_or_extra':
      return `border-error/60 bg-danger-bg text-error ${ring}`;
  }
}

export function SpeechPracticeDrawer({
  open,
  onClose,
  targetText,
  practiceKind = 'sentence',
  sourceRefType = 'custom',
  sourceRefId,
  examTrack = 'ielts_academic',
  onAnalyzed,
}: SpeechPracticeDrawerProps) {
  const deps = useOptionalDeps();
  const edition = deps?.edition ?? 'glb';
  const isRtl = edition === 'irn';
  const t = useMemo(() => createTranslator(edition), [edition]);

  const [accent, setAccent] = useState<'us' | 'uk'>(() => getGlobalDefaultTtsAccent());
  const [isRecording, setIsRecording] = useState(false);
  const [rmsLevel, setRmsLevel] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [recordedClip, setRecordedClip] = useState<RecordedClip | null>(null);
  const [ownAudioUrl, setOwnAudioUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeResult, setActiveResult] = useState<PronunciationPracticeItemDto | null>(null);
  const [selectedWord, setSelectedWord] = useState<WordFeedbackItem | null>(null);
  const [historyItems, setHistoryItems] = useState<readonly PronunciationPracticeItemDto[]>([]);
  const [quotaInfo, setQuotaInfo] = useState<{
    readonly remaining: number;
    readonly limit: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [playingPracticeId, setPlayingPracticeId] = useState<string | null>(null);

  const recordingHandleRef = useRef<ActiveRecordingHandle | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeOwnAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeResultRef = useRef<PronunciationPracticeItemDto | null>(null);
  activeResultRef.current = activeResult;

  const voiceId = accent === 'uk' ? 'bf_emma' : 'af_bella';

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearTimer();
      recordingHandleRef.current?.cancel();
      if (ownAudioUrl && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(ownAudioUrl);
      }
      activeOwnAudioRef.current?.pause();
    };
  }, [ownAudioUrl]);

  const loadHistory = useCallback(async () => {
    if (!deps?.speechPractice || !open) return;
    const [res, pRes] = await Promise.all([
      deps.speechPractice.listPronunciationHistory({
        ...(sourceRefId ? { sourceRefId } : {}),
        limit: 8,
      }),
      deps.personalization ? deps.personalization.getState() : Promise.resolve(null),
    ]);
    if (pRes && pRes.ok) {
      const nextAccent = pRes.value.profile.preferredTtsAccent === 'uk' ? 'uk' : 'us';
      setAccent(nextAccent);
      setGlobalDefaultTtsAccent(nextAccent);
    }
    if (res.ok) {
      setHistoryItems(res.value.items);
      if (
        typeof res.value.remainingDailyQuota === 'number' &&
        typeof res.value.dailyQuotaLimit === 'number'
      ) {
        setQuotaInfo({
          remaining: res.value.remainingDailyQuota,
          limit: res.value.dailyQuotaLimit,
        });
      }
      if (!activeResultRef.current && sourceRefId && res.value.items[0]) {
        setActiveResult(res.value.items[0]);
      }
    }
  }, [deps?.personalization, deps?.speechPractice, open, sourceRefId]);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setSelectedWord(null);
    void loadHistory();
  }, [loadHistory, open]);

  const handleSelectAccent = async (next: 'us' | 'uk') => {
    setAccent(next);
    setGlobalDefaultTtsAccent(next);
    if (deps?.personalization) {
      await deps.personalization.updateProfile({ preferredTtsAccent: next }).catch(() => {});
    }
  };

  const stopRecordingPreviewOnly = useCallback(async () => {
    clearTimer();
    setIsRecording(false);
    setRmsLevel(0);
    const handle = recordingHandleRef.current;
    recordingHandleRef.current = null;
    if (!handle) return;

    const clipRes = await handle.stop();
    if (!clipRes.ok) {
      setErrorMsg(clipRes.error.message);
      return;
    }

    const clip = clipRes.value;
    setRecordedClip(clip);
    const localUrl =
      typeof URL.createObjectURL === 'function' ? URL.createObjectURL(clip.blob) : null;
    setOwnAudioUrl(localUrl);
  }, []);

  const startRecording = async () => {
    setErrorMsg(null);
    if (!deps?.audioRecorder) {
      setErrorMsg(isRtl ? 'میکروفون در این محیط در دسترس نیست.' : 'Microphone unavailable.');
      return;
    }
    if (ownAudioUrl && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(ownAudioUrl);
      setOwnAudioUrl(null);
    }
    setRecordedClip(null);
    setElapsedSec(0);

    const handleRes = await deps.audioRecorder.startRecording({
      maxDurationSec: 30,
      onLevel: (level) => setRmsLevel(level),
    });
    if (!handleRes.ok) {
      setErrorMsg(handleRes.error.message);
      return;
    }
    recordingHandleRef.current = handleRes.value;
    setIsRecording(true);
    clearTimer();
    timerRef.current = setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 1;
        if (next >= 30) {
          void stopRecordingPreviewOnly();
        }
        return next;
      });
    }, 1000);
  };

  const analyzeRecordedClip = async () => {
    if (!recordedClip) return;
    if (!deps?.speechPractice) {
      setErrorMsg(isRtl ? 'سرویس تحلیل تلفظ متصل نیست.' : 'Speech practice gateway unavailable.');
      return;
    }
    if (recordedClip.durationMs > 0 && recordedClip.durationMs < 500) {
      setErrorMsg(
        isRtl
          ? 'ضبط خیلی کوتاه بود. لطفاً حداقل ۱ ثانیه واضح صحبت کنید.'
          : 'Recording was too short. Hold and speak for at least 1 second.',
      );
      return;
    }

    setErrorMsg(null);
    setIsAnalyzing(true);
    const analysisRes = await deps.speechPractice.submitPronunciationPractice({
      targetText,
      practiceKind,
      sourceRefType,
      ...(sourceRefId ? { sourceRefId } : {}),
      examTrack,
      clip: recordedClip,
    });
    setIsAnalyzing(false);

    if (!analysisRes.ok) {
      setErrorMsg(analysisRes.error.message);
      return;
    }

    const resultItem = analysisRes.value;
    setActiveResult(resultItem);
    setSelectedWord(null);
    setHistoryItems((prev) => [
      resultItem,
      ...prev.filter((p) => p.practiceId !== resultItem.practiceId),
    ]);
    if (quotaInfo) {
      setQuotaInfo({ ...quotaInfo, remaining: Math.max(0, quotaInfo.remaining - 1) });
    }
    if (deps.personalization && typeof resultItem.overallScore === 'number') {
      const approxScore =
        examTrack === 'toefl_ibt'
          ? Math.max(1, Math.min(6, Number((1 + (resultItem.overallScore / 100) * 5).toFixed(1))))
          : examTrack === 'pte_academic'
            ? Math.round(10 + (resultItem.overallScore / 100) * 80)
            : examTrack === 'det'
              ? Math.round(10 + (resultItem.overallScore / 100) * 150)
              : Math.max(4, Math.min(9, Number((4.5 + (resultItem.overallScore / 100) * 4.5).toFixed(1))));
      void deps.personalization.recordBandEvent({
        examTrack,
        skill: 'speaking',
        sourceKind: 'pronunciation',
        sourceId: resultItem.practiceId,
        rawScore: approxScore,
        accuracyRatio: Math.max(0, Math.min(1, resultItem.overallScore / 100)),
        topicKeys: [],
      });
    }
    onAnalyzed?.(resultItem);
  };

  const playOwnTake = (url: string, practiceId?: string) => {
    activeOwnAudioRef.current?.pause();
    const audio = new Audio(url);
    activeOwnAudioRef.current = audio;
    if (practiceId) setPlayingPracticeId(practiceId);
    audio.onended = () => setPlayingPracticeId(null);
    audio.onerror = () => setPlayingPracticeId(null);
    void audio.play().catch(() => setPlayingPracticeId(null));
  };

  const playSavedRemoteTake = async (item: PronunciationPracticeItemDto) => {
    if (!deps?.speechPractice || !item.audioPlayUrl) return;
    if (playingPracticeId === item.practiceId) {
      activeOwnAudioRef.current?.pause();
      setPlayingPracticeId(null);
      return;
    }
    const urlRes = await deps.speechPractice.resolveAuthenticatedAudioUrl(item.audioPlayUrl);
    if (!urlRes.ok) {
      setErrorMsg(urlRes.error.message);
      return;
    }
    playOwnTake(urlRes.value, item.practiceId);
  };

  const summaryText = activeResult
    ? isRtl
      ? (activeResult.summaryFa ?? activeResult.summaryEn)
      : (activeResult.summaryEn ?? activeResult.summaryFa)
    : null;
  const mouthTip = activeResult
    ? isRtl
      ? (activeResult.mouthTipFa ?? activeResult.mouthTipEn)
      : (activeResult.mouthTipEn ?? activeResult.mouthTipFa)
    : null;
  const retryTip = activeResult
    ? isRtl
      ? (activeResult.actionableRetryFa ?? activeResult.actionableRetryEn)
      : (activeResult.actionableRetryEn ?? activeResult.actionableRetryFa)
    : null;

  return (
    <MzModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title={t('speechPracticeTitle')}
      maxWidthClass="max-w-2xl"
    >
      <div data-testid="speech-practice-drawer" className="space-y-4">
        {errorMsg ? <MzBanner tone="danger">{errorMsg}</MzBanner> : null}

        {/* Step 1: Target Phrase + Accent Selector + Kokoro AI TTS */}
        <MzCard padding="md" variant="alt" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              {t('speechTargetSentenceLabel')}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label={t('settingsTtsAccentTitle')}
                className="inline-flex rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas p-0.5 text-[11px] font-semibold"
              >
                {(['us', 'uk'] as const).map((code) => (
                  <button
                    key={code}
                    type="button"
                    data-testid={`speech-accent-${code}`}
                    onClick={() => void handleSelectAccent(code)}
                    className={`rounded px-2 py-0.5 transition-colors ${
                      accent === code ? 'bg-primary text-on-primary' : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {code.toUpperCase()}
                  </button>
                ))}
              </div>
              <InlineListenButton
                text={targetText}
                voice={voiceId}
                sourceContext="pronunciation"
                label={t('speechPlayReference')}
                testId="speech-studio-ref-listen"
                size="sm"
              />
            </div>
          </div>

          <LtrExamBoundary className="rounded-[var(--mz-radius-compact)] bg-bg-surface p-3 text-base font-medium leading-relaxed text-text-primary">
            <p data-testid="speech-target-text">{targetText}</p>
          </LtrExamBoundary>

          {quotaInfo ? (
            <p className="text-[11px] font-medium text-text-secondary" data-testid="speech-quota-badge">
              {t('speechQuotaRemainingLabel', {
                remaining: quotaInfo.remaining,
                limit: quotaInfo.limit,
              })}
            </p>
          ) : null}
        </MzCard>

        {/* Steps 2 & 3: Record -> Free Preview -> Submit Analysis */}
        <MzCard padding="md" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {!isRecording ? (
              <MzButton
                variant={recordedClip ? 'secondary' : 'primary'}
                size="md"
                data-testid="speech-record-start"
                disabled={isAnalyzing}
                onClick={() => void startRecording()}
                leadingIcon={<Mic className="h-4 w-4" aria-hidden="true" />}
              >
                {recordedClip || activeResult ? t('speechRetryCta') : t('speechRecordStart')}
              </MzButton>
            ) : (
              <MzButton
                variant="danger"
                size="md"
                data-testid="speech-record-stop"
                onClick={() => void stopRecordingPreviewOnly()}
                leadingIcon={<Square className="h-4 w-4 fill-current" aria-hidden="true" />}
              >
                {`${t('speechRecordStop')} (${elapsedSec}s / 30s)`}
              </MzButton>
            )}

            {recordedClip && !isRecording ? (
              <div className="flex flex-wrap items-center gap-2">
                {ownAudioUrl ? (
                  <MzButton
                    variant="secondary"
                    size="sm"
                    data-testid="speech-play-own-take"
                    onClick={() => playOwnTake(ownAudioUrl, 'local')}
                    leadingIcon={<Play className="h-3.5 w-3.5" aria-hidden="true" />}
                  >
                    {t('speechPlayOwnTake')}
                  </MzButton>
                ) : null}
                <MzButton
                  variant="primary"
                  size="sm"
                  data-testid="speech-analyze-submit"
                  isLoading={isAnalyzing}
                  disabled={isAnalyzing}
                  onClick={() => void analyzeRecordedClip()}
                  leadingIcon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
                >
                  {t('speechAnalyzeCta')}
                </MzButton>
              </div>
            ) : null}
          </div>

          {!isRecording && recordedClip && !activeResult ? (
            <p className="text-[11px] text-text-secondary">{t('speechPreviewStepHint')}</p>
          ) : null}

          {isRecording ? (
            <div className="space-y-1.5">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-alt">
                <div
                  className="h-full bg-primary transition-all duration-75"
                  style={{ width: `${Math.min(100, Math.max(8, Math.round(rmsLevel * 180)))}%` }}
                />
              </div>
              <p className="text-[11px] text-text-secondary">
                {isRtl
                  ? 'جمله را با صدای واضح بخوانید؛ تا ۳۰ ثانیه ضبط می‌شود.'
                  : 'Read clearly — recording auto-caps at 30s. Tap Stop to preview before analyzing.'}
              </p>
            </div>
          ) : null}

          {isAnalyzing ? (
            <div
              data-testid="speech-analyzing-banner"
              className="flex items-center gap-2 rounded-[var(--mz-radius-compact)] bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>{t('speechAnalyzingLabel')}</span>
            </div>
          ) : null}
        </MzCard>

        {/* Step 4: Deep Pronunciation Feedback + Interactive IPA Diff + A/B Compare */}
        {activeResult ? (
          <MzCard data-testid="speech-result-card" padding="md" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                <span className="text-sm font-bold text-text-primary">
                  {t('speechScoreOverall')}: {activeResult.overallScore ?? '—'}/100
                </span>
              </div>
              {activeResult.bandImpactLabel ? (
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {activeResult.bandImpactLabel}
                </span>
              ) : null}
            </div>

            {/* A/B Side-by-Side Audio Comparison */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                {t('speechCompareAbTitle')}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <InlineListenButton
                  text={targetText}
                  voice={voiceId}
                  sourceContext="pronunciation"
                  label={t('speechPlayReference')}
                  showSlowToggle={false}
                  size="sm"
                />
                {activeResult.audioPlayUrl ? (
                  <button
                    type="button"
                    data-testid="speech-ab-own-btn"
                    onClick={() => void playSavedRemoteTake(activeResult)}
                    className="inline-flex h-7 items-center gap-1 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-2.5 text-[11px] font-semibold text-text-primary hover:border-primary"
                  >
                    <Volume2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    <span>{t('speechPlayOwnTake')}</span>
                  </button>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: t('speechScoreAccuracy'), val: activeResult.accuracyScore },
                { label: t('speechScoreFluency'), val: activeResult.fluencyScore },
                { label: t('speechScoreIntonation'), val: activeResult.intonationScore },
                { label: t('speechScoreStress'), val: activeResult.stressScore },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-2.5 py-2 text-center"
                >
                  <p className="text-[11px] text-text-secondary">{metric.label}</p>
                  <p className="font-mono text-sm font-bold text-text-primary">{metric.val ?? '—'}</p>
                </div>
              ))}
            </div>

            {activeResult.wordsFeedback.length > 0 ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    {t('speechWordBreakdownTitle')}
                  </p>
                  <span className="text-[11px] text-text-secondary">{t('speechWordTapHint')}</span>
                </div>
                <LtrExamBoundary className="flex flex-wrap gap-1.5">
                  {activeResult.wordsFeedback.map((wf, idx) => (
                    <button
                      type="button"
                      key={`${wf.word}-${idx}`}
                      data-testid={`speech-word-chip-${idx}`}
                      onClick={() => setSelectedWord(wf)}
                      className={`inline-flex flex-col rounded-[var(--mz-radius-compact)] border px-2.5 py-1 text-start text-xs font-semibold transition-shadow ${statusPillClasses(wf.status, selectedWord === wf)}`}
                    >
                      <span>{wf.word}</span>
                      {wf.ipaTarget || wf.ipaObserved ? (
                        <span className="font-mono text-[10px] opacity-80">
                          {wf.ipaTarget ?? wf.ipaObserved}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </LtrExamBoundary>

                {selectedWord ? (
                  <div
                    data-testid="speech-word-detail-popover"
                    className="space-y-2 rounded-[var(--mz-radius-compact)] border border-primary/40 bg-surface-alt p-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <LtrExamBoundary className="flex flex-wrap items-baseline gap-2">
                        <strong className="text-sm text-text-primary">{selectedWord.word}</strong>
                        {selectedWord.ipaTarget ? (
                          <span className="font-mono text-[11px] text-success">
                            Target: {selectedWord.ipaTarget}
                          </span>
                        ) : null}
                        {selectedWord.ipaObserved ? (
                          <span className="font-mono text-[11px] text-warning">
                            Heard: {selectedWord.ipaObserved}
                          </span>
                        ) : null}
                      </LtrExamBoundary>
                      <InlineListenButton
                        text={selectedWord.word}
                        voice={voiceId}
                        sourceContext="pronunciation"
                        showSlowToggle={false}
                        label={t('speechListenWordSlowCta', { word: selectedWord.word })}
                        size="sm"
                      />
                    </div>
                    <p className="text-text-secondary">
                      {isRtl
                        ? (selectedWord.tipFa ?? selectedWord.tipEn)
                        : (selectedWord.tipEn ?? selectedWord.tipFa)}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {summaryText ? (
              <p className="text-xs leading-relaxed text-text-primary">{summaryText}</p>
            ) : null}

            {mouthTip || retryTip ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {mouthTip ? (
                  <div className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-2.5 text-xs">
                    <p className="font-semibold text-text-primary">{t('speechMouthTipTitle')}</p>
                    <p className="mt-1 text-text-secondary">{mouthTip}</p>
                  </div>
                ) : null}
                {retryTip ? (
                  <div className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-2.5 text-xs">
                    <p className="font-semibold text-text-primary">{t('speechRetryTipTitle')}</p>
                    <p className="mt-1 text-text-secondary">{retryTip}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </MzCard>
        ) : null}

        {/* Past Synced Recordings */}
        {historyItems.length > 0 ? (
          <div className="space-y-2 border-t border-border-subtle pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              {t('speechPastTakesTitle')} ({historyItems.length})
            </p>
            <div className="max-h-40 space-y-1.5 overflow-y-auto">
              {historyItems.map((item) => (
                <div
                  key={item.practiceId}
                  className="flex items-center justify-between gap-2 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <LtrExamBoundary>
                      <p className="truncate font-medium text-text-primary">{item.targetText}</p>
                    </LtrExamBoundary>
                    <p className="text-[11px] text-text-secondary">
                      {item.overallScore != null ? `${item.overallScore}/100` : item.status} ·{' '}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void playSavedRemoteTake(item)}
                      className="inline-flex h-7 items-center gap-1 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-2 text-[11px] font-semibold text-text-primary hover:border-primary"
                    >
                      <Play className="h-3 w-3" aria-hidden="true" />
                      <span>{playingPracticeId === item.practiceId ? '...' : t('speechPlayOwnTake')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveResult(item);
                        setSelectedWord(null);
                      }}
                      className="inline-flex h-7 items-center gap-1 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-2 text-[11px] font-semibold text-text-secondary hover:text-text-primary"
                    >
                      <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </MzModal>
  );
}
