import { Link } from '@tanstack/react-router';
import {
  CheckCircle2,
  Keyboard,
  Mic,
  Send,
  Sliders,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { RegisterGearLadderCard } from '@/components/exam-kit';
import { MzCard } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { toPersianDigits } from '@/edition/bidi/numerals';
import type { ActiveRecordingHandle } from '@/gateways/audio.gateway';
import type { QuotaStatusSnapshot } from '@/gateways/evaluation.gateway';
import type {
  RegisterShifterResult,
  VerifyRepeatAloudResponse,
} from '@/gateways/linguistic.gateway';
import { createTranslator } from '@/i18n';
import { pollAdvancedJobUntilDone } from '@/spa/advanced-job-watcher';
import { recordCoachStudyActivity } from '@/spa/coach-activity';
import { useDeps } from '@/spa/deps';
import { speakEnglishPhrase, stopEnglishSpeech } from '@/components/speech-tts';
import type { SupportedExamId } from '@mockza/domain';

export interface RegisterShifterScreenProps {
  readonly runId?: string;
}

const SAMPLE_SENTENCES = [
  {
    label: 'Work Standup',
    topic: 'Workplace',
    text: 'Today our team had a long meeting and the new feature is kind of late, so we need to fix two bugs first.',
  },
  {
    label: 'Opinion on AI',
    topic: 'Technology & AI',
    text: 'I think AI tools are really helpful for students, but sometimes people rely on them too much without thinking.',
  },
  {
    label: 'Daily Life',
    topic: 'Travel & Culture',
    text: 'Last weekend I went to a quiet coffee shop near the park and finished reading a really interesting book.',
  },
] as const;

export function RegisterShifterScreen({ runId: _runId }: RegisterShifterScreenProps) {
  const deps = useDeps();
  const isRtl = deps.edition === 'irn';
  const t = createTranslator(deps.edition);
  const [examTrack, setExamTrack] = useState<SupportedExamId>('ielts_academic');
  const [inputMode, setInputMode] = useState<'audio' | 'text'>('audio');
  const [topicHint, setTopicHint] = useState('');
  const [rawText, setRawText] = useState('');
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [quota, setQuota] = useState<QuotaStatusSnapshot | null>(null);
  const [selectedGear, setSelectedGear] = useState<0 | 1 | 2>(2);
  const [result, setResult] = useState<RegisterShifterResult | null>(null);
  const [savedPhrases, setSavedPhrases] = useState<string[]>([]);
  const [repeatRecording, setRepeatRecording] = useState(false);
  const [repeatResult, setRepeatResult] = useState<VerifyRepeatAloudResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<ActiveRecordingHandle | null>(null);
  const repeatHandleRef = useRef<ActiveRecordingHandle | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    void deps.attemptStore.getUserProfile().then((res) => {
      if (mountedRef.current && res.ok && res.value) {
        setExamTrack(res.value.examId);
      }
    });
    void deps.evaluation.getQuotaStatus().then((res) => {
      if (mountedRef.current && res.ok) {
        setQuota(res.value);
      }
    });
    void deps.personalization?.getState().then((pRes) => {
      if (!mountedRef.current || !pRes.ok) return;
      const cur = pRes.value.liveBand.currentBand;
      if (typeof cur === 'number') {
        const gearIdx: 0 | 1 | 2 = cur >= 7.0 ? 2 : cur >= 5.5 ? 1 : 0;
        setSelectedGear(gearIdx);
      }
    });
    return () => {
      mountedRef.current = false;
      stopEnglishSpeech();
    };
  }, [deps]);

  const pollUntilComplete = async (jobId: string) => {
    setProcessingStage(isRtl ? 'در حال تبدیل صدا و تحلیل لحن...' : 'Analyzing phrasing across 3 levels...');
    const outcome = await pollAdvancedJobUntilDone<RegisterShifterResult>({
      pollFn: () => deps.linguistic.pollAdvancedJob<RegisterShifterResult>(jobId),
      timeoutMs: 90_000,
      onStage: (stage) => {
        if (!mountedRef.current) return;
        setProcessingStage(stage);
      },
      isCancelled: () => !mountedRef.current,
    });
    if (!mountedRef.current) return;
    setProcessing(false);
    setProcessingStage('');

    if (outcome.kind === 'completed') {
      setResult(outcome.result);
      setSelectedGear(2);
      void recordCoachStudyActivity(deps, 120, 1);
      return;
    }
    if (outcome.kind === 'error') {
      setError(outcome.error.message);
      return;
    }
    if (outcome.kind === 'timeout') {
      setError(
        isRtl
          ? 'زمان انتظار به پایان رسید؛ لطفاً دوباره تلاش کنید.'
          : 'Timed out waiting for upgrade analysis. Please try again.',
      );
      return;
    }
    if (outcome.kind === 'failed') {
      setError(isRtl ? 'پردازش تغییر لحن با خطا مواجه شد.' : 'Register Shift job failed.');
    }
  };

  const handleShiftText = async () => {
    if (rawText.trim().length < 15) {
      setError(
        isRtl
          ? 'لطفاً حداقل ۱۵ کاراکتر (یک جمله کامل) بنویسید.'
          : 'Write at least one full casual sentence (15+ characters).',
      );
      return;
    }
    setError(null);
    setProcessing(true);
    const submitRes = await deps.linguistic.shiftRegisterFromText({
      text: rawText.trim(),
      examTrack,
      ...(topicHint.trim() ? { topicHint: topicHint.trim() } : {}),
    });
    if (!submitRes.ok) {
      setError(submitRes.error.message);
      setProcessing(false);
      return;
    }
    await pollUntilComplete(submitRes.value.jobId);
  };

  const handleToggleRecord = async () => {
    setError(null);
    if (!recording) {
      const startRes = await deps.audioRecorder.startRecording({
        maxDurationSec: 45,
        onLevel: () => {},
      });
      if (!startRes.ok) {
        setError(startRes.error.message);
        return;
      }
      handleRef.current = startRes.value;
      setRecording(true);
      return;
    }

    const active = handleRef.current;
    handleRef.current = null;
    setRecording(false);
    if (!active) return;

    const clipRes = await active.stop();
    if (!clipRes.ok) {
      setError(clipRes.error.message);
      return;
    }

    setProcessing(true);
    const submitRes = await deps.linguistic.shiftRegisterFromClip({
      clip: clipRes.value,
      examTrack,
      ...(topicHint.trim() ? { topicHint: topicHint.trim() } : {}),
    });
    if (!submitRes.ok) {
      setError(submitRes.error.message);
      setProcessing(false);
      return;
    }
    await pollUntilComplete(submitRes.value.jobId);
  };

  const handleSavePhrase = async (phrase: string, rationale: string) => {
    const now = deps.clock.nowMs();
    await deps.vocabStore.upsertMistakeCard({
      cardId: `shifter-${phrase.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
      examId: examTrack,
      headword: phrase,
      ipa: null,
      definition: rationale,
      glossFa: isRtl ? rationale : null,
      topicTag: topicHint.trim() || 'register_shifter',
      sourceKind: 'register_shifter',
      tags: ['register_shifter', examTrack],
      contextSentence: result?.gears.academic ?? null,
      paraphraseHints: [],
      usageNote: rationale,
      sourceSkill: 'speaking',
      sourceAttemptId: result?.runId ?? null,
      sourceRefLabel: 'Register Shifter',
      createdAtMs: now,
      updatedAtMs: now,
    });
    setSavedPhrases((prev) => (prev.includes(phrase) ? prev : [...prev, phrase]));
  };

  const handleToggleRepeatVerify = async () => {
    if (!result) return;
    setError(null);
    if (!repeatRecording) {
      const startRes = await deps.audioRecorder.startRecording({
        maxDurationSec: 20,
        onLevel: () => {},
      });
      if (!startRes.ok) {
        setError(startRes.error.message);
        return;
      }
      repeatHandleRef.current = startRes.value;
      setRepeatRecording(true);
      return;
    }

    const active = repeatHandleRef.current;
    repeatHandleRef.current = null;
    setRepeatRecording(false);
    if (!active) return;

    const clipRes = await active.stop();
    if (!clipRes.ok) {
      setError(clipRes.error.message);
      return;
    }

    const res = await deps.linguistic.verifyRepeatAloud(result.runId, {
      gearLevel: selectedGear === 1 ? 1 : 2,
      expectedSentence: result.repeatAloudTarget.targetSentence,
      targetPhrases: result.repeatAloudTarget.targetPhrases,
      clip: clipRes.value,
    });
    if (res.ok) {
      setRepeatResult(res.value);
    } else {
      setError(res.error.message);
    }
  };

  return (
    <div data-testid="register-shifter-screen" className="mx-auto flex max-w-4xl flex-col gap-6 pb-10 text-start">
      <header className="border-b border-border-subtle pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
              <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
              {t('shifterEyebrow')}
            </p>
            <h1 className="font-editorial mt-1 text-3xl text-text-primary">
              {t('shifterTitle')}
            </h1>
            <p className="mt-1 text-xs text-text-secondary">
              {isRtl
                ? 'صحبت کنید یا جمله خودمانی خود را بنویسید تا سه سطح گفتار دوستانه، رسمی محیط کار و آکادمیک نمره ۸+ را بشنوید و تمرین کنید.'
                : 'Speak or type a casual thought to compare Everyday, Workplace, and Band 8+ versions with guided listening.'}
            </p>
          </div>
          {quota?.advancedQuota ? (
            <span className="rounded-[var(--mz-radius-pill)] border border-border-subtle bg-surface px-3 py-1 text-xs font-semibold text-primary">
              {quota.advancedQuota.isPro
                ? isRtl
                  ? `${quota.advancedQuota.shifterRemainingToday} ارتقا باقی‌مانده امروز`
                  : `${quota.advancedQuota.shifterRemainingToday} upgrades left today`
                : quota.advancedQuota.freeSampleUsed
                  ? isRtl
                    ? 'نمونه رایگان مصرف شد'
                    : 'Free sample used'
                  : isRtl
                    ? '۱ نمونه رایگان موجود'
                    : '1 free trial available'}
            </span>
          ) : null}
        </div>
      </header>

      <MzCard variant="hero">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-1">
            <button
              type="button"
              data-testid="shifter-mode-voice"
              onClick={() => setInputMode('audio')}
              className={`inline-flex items-center gap-1.5 rounded-[var(--mz-radius-compact)] px-3 py-1 text-xs font-semibold ${
                inputMode === 'audio' ? 'bg-primary text-on-primary' : 'text-text-secondary'
              }`}
            >
              <Mic className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isRtl ? 'ضبط صدا' : 'Speak (Mic)'}</span>
            </button>
            <button
              type="button"
              data-testid="shifter-mode-text"
              onClick={() => setInputMode('text')}
              className={`inline-flex items-center gap-1.5 rounded-[var(--mz-radius-compact)] px-3 py-1 text-xs font-semibold ${
                inputMode === 'text' ? 'bg-primary text-on-primary' : 'text-text-secondary'
              }`}
            >
              <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isRtl ? 'نوشتن جمله (بدون میکروفون)' : 'Type Casual Sentence'}</span>
            </button>
          </div>

          <input
            type="text"
            value={topicHint}
            onChange={(e) => setTopicHint(e.target.value)}
            placeholder={isRtl ? 'موضوع اختیاری (فیلم، کار...)' : 'Optional topic (e.g., Film, Work)'}
            className="h-9 min-w-52 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-surface px-3 text-xs text-text-primary focus:border-primary focus:outline-none"
          />
        </div>

        {inputMode === 'audio' ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-testid="shifter-record-btn"
              disabled={processing}
              onClick={() => void handleToggleRecord()}
              className={`inline-flex h-10 items-center gap-2 rounded-[var(--mz-radius-compact)] px-4 text-sm font-semibold text-white transition-colors ${
                recording ? 'bg-danger' : 'bg-primary text-on-primary'
              }`}
            >
              {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              <span>
                {processing
                  ? isRtl
                    ? 'در حال ارتقای لحن...'
                    : 'Upgrading Speaking...'
                  : recording
                    ? isRtl
                      ? 'توقف و نمایش ۳ سطح'
                      : 'Stop & Show 3 Levels'
                    : isRtl
                      ? 'ضبط ویس خودمانی (۳۰ ثانیه)'
                      : 'Record Casual Clip (5–45s)'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setInputMode('text')}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {isRtl ? 'میکروفون ندارید؟ جمله بنویسید ←' : 'No mic handy? Try typing →'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-text-secondary">
                <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" />
                {isRtl ? 'نمونه‌های سریع:' : 'Try 1-click sample:'}
              </span>
              {SAMPLE_SENTENCES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    setRawText(s.text);
                    setTopicHint(s.topic);
                  }}
                  className="rounded-[var(--mz-radius-pill)] border border-border-subtle bg-bg-raised px-2.5 py-0.5 text-[11px] font-medium text-text-primary hover:border-primary hover:text-primary"
                >
                  {s.label}
                </button>
              ))}
            </div>
            <textarea
              dir="ltr"
              rows={3}
              data-testid="shifter-text-input"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Write a casual English sentence to upgrade across Everyday, Workplace, and Band 8+..."
              className="w-full rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-surface p-3 text-sm text-text-primary focus:border-primary focus:outline-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-text-secondary">
                {rawText.trim().length}/600
              </span>
              <button
                type="button"
                data-testid="shifter-submit-text-btn"
                disabled={processing || rawText.trim().length < 15}
                onClick={() => void handleShiftText()}
                className="inline-flex h-10 items-center gap-2 rounded-[var(--mz-radius-compact)] bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                <span>
                  {processing
                    ? isRtl
                      ? 'در حال تبدیل...'
                      : 'Upgrading...'
                    : isRtl
                      ? 'نمایش ۳ سطح گفتار'
                      : 'Upgrade Into 3 Levels'}
                </span>
              </button>
            </div>
          </div>
        )}

        {processingStage ? (
          <p className="mt-3 text-xs font-medium text-primary">{processingStage}</p>
        ) : null}

        {error ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--mz-radius-compact)] border border-danger/40 bg-danger/10 p-2.5 text-xs text-danger">
            <span>{error}</span>
            <Link to="/paywall" className="font-semibold underline">
              {isRtl ? 'مشاهده اشتراک' : 'View Plans'}
            </Link>
          </div>
        ) : null}
      </MzCard>

      {result ? (
        <>
          <RegisterGearLadderCard
            result={result}
            selectedGear={selectedGear}
            isRtl={isRtl}
            onSelectGear={setSelectedGear}
            onSavePhraseToDeck={(phrase, rationale) => void handleSavePhrase(phrase, rationale)}
            savedPhrases={savedPhrases}
          />

          <MzCard variant="default" data-testid="repeat-aloud-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Volume2 className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>
                  {isRtl
                    ? 'قدم ۲: جمله ارتقایافته را با صدای بلند تکرار کنید'
                    : 'Step 2: Repeat the upgraded sentence aloud'}
                </span>
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => speakEnglishPhrase(result.repeatAloudTarget.targetSentence, { rate: 1.0 })}
                  className="inline-flex h-7 items-center gap-1 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-2 text-[11px] font-semibold text-text-primary hover:border-primary"
                >
                  <Volume2 className="h-3 w-3" aria-hidden="true" />
                  <span>1.0x</span>
                </button>
                <button
                  type="button"
                  onClick={() => speakEnglishPhrase(result.repeatAloudTarget.targetSentence, { rate: 0.8 })}
                  className="inline-flex h-7 items-center rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-2 text-[11px] font-semibold text-text-secondary hover:border-primary hover:text-text-primary"
                >
                  0.8x
                </button>
              </div>
            </div>
            <LtrExamBoundary className="mt-2 block rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3 text-sm font-medium text-text-primary">
              {result.repeatAloudTarget.targetSentence}
            </LtrExamBoundary>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-testid="shifter-repeat-btn"
                onClick={() => void handleToggleRepeatVerify()}
                className={`inline-flex h-9 items-center gap-2 rounded-[var(--mz-radius-compact)] px-3.5 text-xs font-semibold ${
                  repeatRecording ? 'bg-danger text-white' : 'border border-primary text-primary hover:bg-surface-hover'
                }`}
              >
                {repeatRecording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                <span>
                  {repeatRecording
                    ? isRtl
                      ? 'پایان و بررسی تلفظ هدف'
                      : 'Stop & Verify Repeat-Aloud'
                    : isRtl
                      ? 'تکرار با صدای بلند'
                      : 'Record Repeat-Aloud Check'}
                </span>
              </button>

              {repeatResult ? (
                <span
                  data-testid="shifter-repeat-verified"
                  className="inline-flex items-center gap-1.5 rounded-[var(--mz-radius-pill)] bg-mint-bg px-3 py-1 text-xs font-semibold text-success"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {isRtl
                    ? `روانی گفتار: ${toPersianDigits(repeatResult.fluencyScore1To5)}/۵ · عبارات ثبت‌شده در گراف: ${toPersianDigits(repeatResult.matchedTargets.length)}`
                    : `Fluency ${repeatResult.fluencyScore1To5}/5 · ${repeatResult.matchedTargets.length} target(s) logged to Graph`}
                </span>
              ) : null}
            </div>
          </MzCard>
        </>
      ) : null}
    </div>
  );
}
