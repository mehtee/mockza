import { CheckCircle2, Mic, Sliders, Square, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { RegisterGearLadderCard } from '@/components/exam-kit';
import { MzCard } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { ActiveRecordingHandle } from '@/gateways/audio.gateway';
import type {
  RegisterShifterResult,
  VerifyRepeatAloudResponse,
} from '@/gateways/linguistic.gateway';
import { useDeps } from '@/spa/deps';
import type { SupportedExamId } from '@mockza/domain';

export interface RegisterShifterScreenProps {
  readonly runId?: string;
}

export function RegisterShifterScreen({ runId: _runId }: RegisterShifterScreenProps) {
  const deps = useDeps();
  const isRtl = deps.edition === 'irn';
  const [examTrack, setExamTrack] = useState<SupportedExamId>('ielts_academic');
  const [topicHint, setTopicHint] = useState('');
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedGear, setSelectedGear] = useState<0 | 1 | 2>(2);
  const [result, setResult] = useState<RegisterShifterResult | null>(null);
  const [savedPhrases, setSavedPhrases] = useState<string[]>([]);
  const [repeatRecording, setRepeatRecording] = useState(false);
  const [repeatResult, setRepeatResult] = useState<VerifyRepeatAloudResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<ActiveRecordingHandle | null>(null);
  const repeatHandleRef = useRef<ActiveRecordingHandle | null>(null);

  useEffect(() => {
    void deps.attemptStore.getUserProfile().then((res) => {
      if (res.ok && res.value) {
        setExamTrack(res.value.examId);
      }
    });
  }, [deps]);

  const pollUntilComplete = async (jobId: string) => {
    for (let i = 0; i < 20; i += 1) {
      const poll = await deps.linguistic.pollAdvancedJob<RegisterShifterResult>(jobId);
      if (!poll.ok) {
        setError(poll.error.message);
        setProcessing(false);
        return;
      }
      if (poll.value.status === 'completed' && poll.value.result) {
        setResult(poll.value.result);
        setSelectedGear(2);
        setProcessing(false);
        return;
      }
      if (poll.value.status === 'failed') {
        setError(isRtl ? 'پردازش تغییر لحن با خطا مواجه شد.' : 'Register Shift job failed.');
        setProcessing(false);
        return;
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    setProcessing(false);
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
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
          <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
          {isRtl ? 'امضای اختصاصی سنجیا · اسلایدر ۳ دنده' : 'Mockza Signature · 3-Gear Register Shifter'}
        </p>
        <h1 className="font-editorial mt-1 text-3xl text-text-primary">
          {isRtl ? 'تبدیل ویس خودمانی ۳۰ ثانیه‌ای به بیان نمره ۸.۵' : 'Shift Casual Speech Into Academic Band 8.5'}
        </h1>
        <p className="mt-1 text-xs text-text-secondary">
          {isRtl
            ? 'درباره روزتان یا فیلمی که دیدید ۵ تا ۴۵ ثانیه صحبت کنید تا سه سطح دوستانه، محیط کار و آکادمیک را ببینید.'
            : 'Record 5–45s casually about your day or a film; compare Casual, Workplace, and Exam Track registers and lock it aloud.'}
        </p>
      </header>

      <MzCard variant="hero">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={topicHint}
            onChange={(e) => setTopicHint(e.target.value)}
            placeholder={isRtl ? 'موضوع اختیاری (مثلاً فیلم، کار، هوش مصنوعی)' : 'Optional topic hint (e.g., Film, Standup, Football)'}
            className="h-10 min-w-60 flex-1 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-surface px-3 text-xs text-text-primary focus:border-primary focus:outline-none"
          />
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
                  ? 'در حال تبدیل لحن...'
                  : 'Shifting Registers...'
                : recording
                  ? isRtl
                    ? 'توقف و تبدیل ۳ دنده'
                    : 'Stop & Shift to 3 Gears'
                  : isRtl
                    ? 'ضبط ویس خودمانی (۳۰ ثانیه)'
                    : 'Record Casual Clip (5–45s)'}
            </span>
          </button>
        </div>
        {error ? (
          <p className="mt-3 text-xs text-danger">{error}</p>
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
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Volume2 className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>
                {isRtl
                  ? 'مرحله حافظه عضلانی: نسخه هدف را با صدای بلند تکرار کنید'
                  : 'Acoustic Muscle-Memory Loop: Repeat Target Sentence Aloud'}
              </span>
            </h2>
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
                    ? `روانی گفتار: ${repeatResult.fluencyScore1To5}/۵ · عبارات ثبت‌شده در گراف: ${repeatResult.matchedTargets.length}`
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
