import { Link } from '@tanstack/react-router';
import {
  BookmarkPlus,
  CheckCircle2,
  Flame,
  Lightbulb,
  Mic,
  PenTool,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Target,
  Volume2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SpeechPracticeDrawer } from '@/components/speech/SpeechPracticeDrawer';
import { MzCard } from '@/components/ui';
import {
  ForwardArrowIcon,
} from '@/components/bidi/DirectionIcon';
import { localizeAudioError } from '@/components/bidi/diagnostic-labels';
import { formatTopicLabel } from '@/components/bidi/topic-labels';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { formatChromeNumber } from '@/edition/bidi/numerals';
import type { ActiveRecordingHandle, RecordedClip } from '@/gateways/audio.gateway';
import type { DailyMissionSnapshot } from '@/gateways/linguistic.gateway';
import { createTranslator } from '@/i18n';
import { recordCoachStudyActivity } from '@/spa/coach-activity';
import { useDeps } from '@/spa/deps';
import { speakEnglishPhrase, stopEnglishSpeech } from '@/components/speech-tts';
import type { SupportedExamId } from '@mockza/domain';

export interface DailyMissionScreenProps {
  readonly missionId?: string;
}

const TOPIC_QUICK_PICKS = [
  'technology_ai',
  'workplace_careers',
  'culture_travel',
  'climate_policy',
  'health_society',
] as const;

function matchesPhraseLoosely(draftLower: string, phrase: string): boolean {
  const cleaned = phrase
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && w !== 'the' && w !== 'for' && w !== 'and');
  if (cleaned.length === 0) return false;
  return cleaned.slice(0, 2).every((token) => draftLower.includes(token));
}

export function DailyMissionScreen({ missionId: _missionId }: DailyMissionScreenProps) {
  const deps = useDeps();
  const isRtl = deps.edition === 'irn';
  const t = createTranslator(deps.edition);
  const [examTrack, setExamTrack] = useState<SupportedExamId>('ielts_academic');
  const [mission, setMission] = useState<DailyMissionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [responseMode, setResponseMode] = useState<'writing' | 'speaking'>('writing');
  const [responseText, setResponseText] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordedClip, setRecordedClip] = useState<RecordedClip | null>(null);
  const handleRef = useRef<ActiveRecordingHandle | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshingTopic, setRefreshingTopic] = useState(false);
  const [topicMenuOpen, setTopicMenuOpen] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [savedUpgradeKeys, setSavedUpgradeKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [practiceRewriteOpen, setPracticeRewriteOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [profileRes, dueRes] = await Promise.all([
        deps.attemptStore.getUserProfile(),
        deps.vocabStore.getDueCards(deps.clock.todaySerialDay(), 5),
      ]);
      const track = profileRes.ok && profileRes.value ? profileRes.value.examId : 'ielts_academic';
      if (active) setExamTrack(track);
      const dueWords = dueRes.ok ? dueRes.value.map((item) => item.card.headword) : [];
      const res = await deps.linguistic.getTodayMission({ examTrack: track, dueWords });
      if (!active) return;
      if (res.ok) {
        setMission(res.value);
      } else {
        setError(res.error.message);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
      stopEnglishSpeech();
    };
  }, [deps]);

  const draftLower = responseText.toLowerCase();
  const wordCount = useMemo(
    () => responseText.trim().split(/\s+/).filter(Boolean).length,
    [responseText],
  );
  const matchedDraftKeys = useMemo(() => {
    if (!mission) return [] as string[];
    return mission.payload.forcedTargets
      .filter((item) => matchesPhraseLoosely(draftLower, item.phraseEn))
      .map((item) => item.canonicalKey);
  }, [draftLower, mission]);

  const handleRefreshTopic = async (nextTopic: string) => {
    const clean = nextTopic.trim();
    if (!clean || refreshingTopic) return;
    setRefreshingTopic(true);
    setError(null);
    const res = await deps.linguistic.refreshTodayMission({
      focusTopic: clean,
      examTrack,
    });
    setRefreshingTopic(false);
    if (res.ok) {
      setMission(res.value);
      setTopicMenuOpen(false);
      setCustomTopic('');
    } else {
      setError(res.error.message);
    }
  };

  const handleInsertStarterFrame = () => {
    if (!mission) return;
    const first = mission.payload.forcedTargets[0]?.phraseEn ?? 'Were we to prioritize';
    const second = mission.payload.forcedTargets[1]?.phraseEn ?? 'albeit';
    const cleanFirst = first.replace(/\.+$/g, '').trim();
    const frame = `${cleanFirst}, outcomes around ${mission.focusTopic} improve noticeably, ${second} alongside clear tradeoffs.`;
    setResponseText((prev) => (prev.trim() ? `${prev.trim()} ${frame}` : frame));
  };

  const handleToggleSpeakRecord = async () => {
    setError(null);
    if (!recording) {
      const startRes = await deps.audioRecorder.startRecording({
        maxDurationSec: 45,
        onLevel: () => {},
      });
      if (!startRes.ok) {
        setError(localizeAudioError(startRes.error, deps.edition));
        return;
      }
      handleRef.current = startRes.value;
      setRecordedClip(null);
      setRecording(true);
      return;
    }

    const active = handleRef.current;
    handleRef.current = null;
    setRecording(false);
    if (!active) return;
    const clipRes = await active.stop();
    if (clipRes.ok) {
      setRecordedClip(clipRes.value);
    } else {
      setError(localizeAudioError(clipRes.error, deps.edition));
    }
  };

  const handleSubmit = async () => {
    if (!mission) return;
    if (responseMode === 'writing' && responseText.trim().length < 10) return;
    if (responseMode === 'speaking' && !recordedClip) return;

    setSubmitting(true);
    setError(null);
    const res =
      responseMode === 'speaking' && recordedClip
        ? await deps.linguistic.completeMissionWithClip(mission.missionId, {
            clip: recordedClip,
          })
        : await deps.linguistic.completeMission(mission.missionId, {
            responseText: responseText.trim(),
            ...(matchedDraftKeys.length > 0 ? { usedTargetKeys: matchedDraftKeys } : {}),
          });
    setSubmitting(false);
    if (res.ok) {
      setMission(res.value);
      void recordCoachStudyActivity(deps, 180, 1);
      if (deps.personalization && res.value.evaluationResult) {
        const clarity = res.value.evaluationResult.clarityScore1To5 ?? 3;
        const estimatedScore = examTrack === 'det' ? 85 + clarity * 12 : examTrack === 'pte_academic' ? 45 + clarity * 8 : examTrack === 'toefl_ibt' ? Math.min(30, 16 + clarity * 2.5) : 4.5 + clarity * 0.6;
        void deps.personalization.recordBandEvent({
          examTrack,
          skill: responseMode === 'speaking' ? 'speaking' : 'writing',
          sourceKind: 'mission',
          sourceId: `${res.value.missionId}:${deps.clock.nowMs()}`,
          rawScore: Number(estimatedScore.toFixed(1)),
          durationSeconds: 180,
          topicKeys: [],
        });
      }
    } else {
      setError(res.error.message);
    }
  };

  const handleSaveUpgradeToDeck = async (original: string, upgraded: string, whyEn: string) => {
    const now = deps.clock.nowMs();
    await deps.vocabStore.upsertMistakeCard({
      cardId: `mission-upg-${upgraded.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
      examId: examTrack,
      headword: upgraded,
      ipa: null,
      definition: whyEn,
      glossFa: isRtl ? whyEn : null,
      topicTag: mission?.focusTopic ?? 'daily_coach',
      sourceKind: 'mistake_to_deck',
      tags: ['daily_coach', examTrack],
      contextSentence: mission?.evaluationResult?.modelRewriteEn ?? upgraded,
      paraphraseHints: [original],
      usageNote: whyEn,
      sourceSkill: responseMode,
      sourceAttemptId: mission?.missionId ?? null,
      sourceRefLabel: "Today's 10-Min Coach",
      createdAtMs: now,
      updatedAtMs: now,
    });
    setSavedUpgradeKeys((prev) => (prev.includes(upgraded) ? prev : [...prev, upgraded]));
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl py-10 text-sm text-text-secondary">
        {isRtl ? 'در حال آماده‌سازی مأموریت روزانه...' : "Preparing Today's 10-Min Coach..."}
      </div>
    );
  }

  const isCompleted = mission?.status === 'completed' && mission.evaluationResult !== null;

  return (
    <div data-testid="daily-mission-screen" className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-10 text-start">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <Flame className="h-3.5 w-3.5" aria-hidden="true" />
            {t('dailyMissionEyebrow')}
          </p>
          <h1 className="font-editorial mt-1 text-3xl text-text-primary">
            {mission?.payload.promptTitle ?? t('dailyMissionDefaultTitle')}
          </h1>
          {mission ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
              <span>{isRtl ? 'موضوع امروز:' : 'Topic:'}</span>
              <span
                className="inline-flex items-center rounded-[var(--mz-radius-pill)] px-2.5 py-0.5 font-semibold text-white"
                style={{ backgroundColor: 'var(--mz-color-interest-tag)' }}
              >
                {formatTopicLabel(mission.focusTopic, deps.edition)}
              </span>
              <button
                type="button"
                data-testid="mission-change-topic-btn"
                onClick={() => setTopicMenuOpen((open) => !open)}
                className="inline-flex min-h-10 items-center gap-1 rounded-[var(--mz-radius-pill)] border border-border-subtle bg-bg-raised px-3 text-xs font-semibold text-primary hover:bg-surface-hover"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isRtl ? 'تغییر موضوع' : 'Change Topic'}</span>
              </button>
            </div>
          ) : null}
        </div>
        <Link
          to="/progress/graph"
          className="inline-flex min-h-10 items-center rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3 text-xs font-semibold text-primary hover:bg-surface-hover"
        >
          {t('dailyMissionViewGraph')}
        </Link>
      </header>

      {/* Step Progress */}
      <div className="grid grid-cols-3 gap-2 text-[11px] font-semibold">
        {(
          [
            { step: 1, label: isRtl ? '۱. گرم‌کردن' : '1. Warm-Up', active: true },
            {
              step: 2,
              label: isRtl ? '۲. پاسخ شما' : '2. Respond',
              active: isCompleted || wordCount > 0 || recordedClip !== null,
            },
            { step: 3, label: isRtl ? '۳. بازخورد مربی' : '3. Critique', active: isCompleted },
          ] as const
        ).map((s) => (
          <div
            key={s.step}
            className={`rounded-[var(--mz-radius-compact)] border px-3 py-1.5 text-center ${
              s.active
                ? 'border-primary/40 bg-surface-alt text-primary'
                : 'border-border-subtle bg-bg-raised text-text-secondary'
            }`}
          >
            {s.label}
          </div>
        ))}
      </div>

      {topicMenuOpen ? (
        <MzCard variant="default" data-testid="mission-topic-picker">
          <p className="text-xs font-semibold text-text-primary">
            {isRtl ? 'یک موضوع جدید برای مأموریت امروز انتخاب کنید:' : 'Switch today’s prompt topic (up to 2x/day):'}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {TOPIC_QUICK_PICKS.map((topic) => (
              <button
                key={topic}
                type="button"
                disabled={refreshingTopic}
                onClick={() => void handleRefreshTopic(topic)}
                className="inline-flex min-h-10 items-center rounded-[var(--mz-radius-pill)] border border-border-subtle bg-bg-raised px-3.5 text-xs font-medium text-text-primary hover:border-primary hover:text-primary disabled:opacity-50"
              >
                {formatTopicLabel(topic, deps.edition)}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder={isRtl ? 'موضوع دلخواه (مثلاً عکاسی، اقتصاد)...' : 'Custom topic (e.g., Robotics, Film)...'}
                className="h-11 min-w-44 flex-1 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-surface px-3 text-sm text-text-primary focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                disabled={refreshingTopic || customTopic.trim().length < 2}
                onClick={() => void handleRefreshTopic(customTopic)}
                className="inline-flex h-11 items-center gap-1.5 rounded-[var(--mz-radius-compact)] bg-primary px-4 text-xs font-semibold text-on-primary disabled:opacity-50"
              >
              {refreshingTopic
                ? isRtl
                  ? 'در حال ساخت...'
                  : 'Refreshing...'
                : isRtl
                  ? 'ساخت تمرین جدید'
                  : 'Apply Topic'}
            </button>
          </div>
        </MzCard>
      ) : null}

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--mz-radius-compact)] border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
          <span>{error}</span>
          {!mission ? (
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError(null);
                void deps.linguistic.getTodayMission({ examTrack }).then((res) => {
                  if (res.ok) setMission(res.value);
                  else setError(res.error.message);
                  setLoading(false);
                });
              }}
              className="inline-flex min-h-10 items-center gap-1 rounded-[var(--mz-radius-compact)] border border-danger/40 bg-bg-surface px-3 text-xs font-semibold text-text-primary hover:bg-surface-hover"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('simRetryLoadAction')}</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {mission ? (
        <>
          <MzCard variant="default" data-testid="mission-forced-targets">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              <span className="inline-flex items-center gap-1.5">
                <Target className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>{t('dailyMissionRequiredTargets')}</span>
              </span>
              {responseMode === 'writing' ? (
                <span data-testid="mission-target-radar" className="text-[11px] font-semibold text-primary">
                  {formatChromeNumber(matchedDraftKeys.length, deps.edition)}/
                  {formatChromeNumber(mission.payload.forcedTargets.length, deps.edition)}{' '}
                  {isRtl ? 'در پیش‌نویس' : 'used in draft'}
                </span>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {mission.payload.forcedTargets.map((target) => {
                const detected = matchedDraftKeys.includes(target.canonicalKey);
                return (
                  <div
                    key={target.canonicalKey}
                    className={`rounded-[var(--mz-radius-compact)] border p-3 transition-colors ${
                      detected ? 'border-success/50 bg-tint' : 'border-border-subtle bg-bg-raised'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <LtrExamBoundary className="font-mono-exam text-sm font-semibold text-primary">
                        {target.phraseEn}
                      </LtrExamBoundary>
                      <div className="flex shrink-0 items-center gap-1">
                        {detected ? (
                          <span className="rounded-[var(--mz-radius-pill)] bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
                            ✓
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => speakEnglishPhrase(target.phraseEn, { rate: 1.0 })}
                          title={t('listeningListen1xTitle')}
                          className="inline-flex h-6 items-center gap-1 rounded border border-border-subtle bg-canvas px-1.5 text-[11px] text-text-secondary hover:border-primary hover:text-primary"
                        >
                          <Volume2 className="h-3 w-3" aria-hidden="true" />
                          <span>1.0x</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => speakEnglishPhrase(target.phraseEn, { rate: 0.8 })}
                          title={t('listeningListenSlowTitle')}
                          className="inline-flex h-6 items-center rounded border border-border-subtle bg-canvas px-1.5 text-[11px] text-text-secondary hover:border-primary hover:text-primary"
                        >
                          0.8x
                        </button>
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs text-text-secondary">
                      {isRtl && target.hintFa ? target.hintFa : target.hintEn}
                    </p>
                  </div>
                );
              })}
            </div>
          </MzCard>

          <MzCard variant="hero">
            {isRtl && mission.payload.promptTextFa ? (
              <p className="mb-3 text-sm leading-relaxed text-text-primary">{mission.payload.promptTextFa}</p>
            ) : null}
            <LtrExamBoundary className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3.5 text-sm leading-relaxed text-text-primary">
              {mission.payload.promptTextEn}
            </LtrExamBoundary>

            {/* Write vs Speak Toggle */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-1">
                <button
                  type="button"
                  data-testid="mission-mode-write"
                  onClick={() => setResponseMode('writing')}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-[var(--mz-radius-compact)] px-3 text-xs font-semibold ${
                    responseMode === 'writing' ? 'bg-primary text-on-primary' : 'text-text-secondary'
                  }`}
                >
                  <PenTool className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isRtl ? 'پاسخ نوشتاری' : 'Write Response'}</span>
                </button>
                <button
                  type="button"
                  data-testid="mission-mode-speak"
                  onClick={() => setResponseMode('speaking')}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-[var(--mz-radius-compact)] px-3 text-xs font-semibold ${
                    responseMode === 'speaking' ? 'bg-primary text-on-primary' : 'text-text-secondary'
                  }`}
                >
                  <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isRtl ? 'پاسخ صوتی' : 'Speak Response'}</span>
                </button>
              </div>

              {responseMode === 'writing' ? (
                <button
                  type="button"
                  data-testid="mission-starter-frame-btn"
                  onClick={handleInsertStarterFrame}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-3 text-xs font-semibold text-primary hover:bg-surface-hover"
                >
                  <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isRtl ? 'درج الگوی شروع' : 'Insert Starter Frame'}</span>
                </button>
              ) : null}
            </div>

            {responseMode === 'writing' ? (
              <div className="mt-3">
                <label htmlFor="mission-response-input" className="mb-1.5 block text-xs font-semibold text-text-secondary">
                  {isRtl ? 'پاسخ تمرینی شما (به انگلیسی)' : 'Your English Transfer Response'}
                </label>
                <textarea
                  id="mission-response-input"
                  data-testid="mission-response-input"
                  dir="ltr"
                  rows={5}
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Were we to prioritize..., albeit challenging..."
                  className="w-full rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-surface p-3 font-sans text-sm text-text-primary focus:border-primary focus:outline-none"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-text-secondary">
                    {isRtl
                      ? `${formatChromeNumber(wordCount, deps.edition)} واژه (پیشنهادی: ۱۵+ واژه)`
                      : `${wordCount} words (aim for 15+ words)`}
                  </span>
                  <button
                    type="button"
                    data-testid="mission-complete-btn"
                    disabled={submitting || responseText.trim().length < 10}
                    onClick={() => void handleSubmit()}
                    className="inline-flex h-11 items-center gap-2 rounded-[var(--mz-radius-compact)] bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    <span>{submitting ? (isRtl ? 'در حال تحلیل...' : 'Grading...') : t('dailyMissionSubmitCta')}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-3 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-4">
                <p className="text-xs text-text-secondary">
                  {isRtl
                    ? '۱۰ تا ۴۵ ثانیه با صدای بلند درباره موضوع بالا صحبت کنید و سعی کنید ساختارهای هدف را به کار ببرید.'
                    : 'Record 10–45s speaking naturally about this prompt using the target structures above.'}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      data-testid="mission-speak-record-btn"
                      onClick={() => void handleToggleSpeakRecord()}
                      className="inline-flex h-11 items-center gap-2 rounded-[var(--mz-radius-compact)] border border-border-strong bg-canvas px-4 text-xs font-semibold text-text-primary hover:bg-surface-hover"
                    >
                    {recording ? (
                      <>
                        <Square className="h-3.5 w-3.5 text-danger" aria-hidden="true" />
                        <span>{isRtl ? 'توقف ضبط' : 'Stop Recording'}</span>
                      </>
                    ) : (
                      <>
                        <Mic className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                        <span>{recordedClip ? (isRtl ? 'ضبط مجدد' : 'Re-record Clip') : (isRtl ? 'شروع ضبط صدا' : 'Start Recording')}</span>
                      </>
                    )}
                  </button>

                  {recordedClip ? (
                    <span className="text-xs font-semibold text-success">
                      {isRtl
                        ? `فایل آماده (${formatChromeNumber(Math.round(recordedClip.durationMs / 1000), deps.edition)} ثانیه)`
                        : `Recorded (${Math.round(recordedClip.durationMs / 1000)}s ready)`}
                    </span>
                  ) : null}

                    <button
                      type="button"
                      data-testid="mission-complete-btn"
                      disabled={submitting || !recordedClip}
                      onClick={() => void handleSubmit()}
                      className="ms-auto inline-flex h-11 items-center gap-2 rounded-[var(--mz-radius-compact)] bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50"
                    >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    <span>{submitting ? (isRtl ? 'در حال تحلیل...' : 'Grading...') : t('dailyMissionSubmitCta')}</span>
                  </button>
                </div>
              </div>
            )}
          </MzCard>

          {isCompleted && mission.evaluationResult ? (
            <MzCard variant="default" data-testid="mission-completed-banner">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                    <div>
                      <h2 className="text-sm font-semibold text-text-primary">
                        {isRtl ? 'مأموریت روزانه ارزیابی شد!' : 'Coach Critique Ready'}
                      </h2>
                      <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                        {isRtl && mission.evaluationResult.feedbackFa
                          ? mission.evaluationResult.feedbackFa
                          : mission.evaluationResult.feedbackEn}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-[var(--mz-radius-pill)] border border-primary/30 bg-surface-alt px-3 py-1 text-xs font-bold text-primary">
                    {isRtl
                      ? `شفافیت: ${formatChromeNumber(mission.evaluationResult.clarityScore1To5, deps.edition)} / ۵`
                      : `Clarity: ${mission.evaluationResult.clarityScore1To5} / 5`}
                  </span>
                </div>

                {mission.evaluationResult.transcriptEn ? (
                  <div className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3 text-xs">
                    <p className="font-semibold text-text-secondary">
                      {isRtl ? 'متن پیاده‌شده گفتار شما:' : 'Transcribed Response:'}
                    </p>
                    <LtrExamBoundary className="mt-1 text-text-primary">
                      {mission.evaluationResult.transcriptEn}
                    </LtrExamBoundary>
                  </div>
                ) : null}

                {(mission.evaluationResult.matchedTargets.length > 0 ||
                  (mission.evaluationResult.missedTargets?.length ?? 0) > 0) ? (
                  <LtrExamBoundary className="flex flex-wrap gap-1.5">
                    {mission.evaluationResult.matchedTargets.map((m) => (
                      <span
                        key={m}
                        className="inline-flex items-center gap-1 rounded-[var(--mz-radius-pill)] px-2.5 py-0.5 text-[11px] font-semibold text-white"
                        style={{ backgroundColor: 'var(--mz-color-structure-mastered)' }}
                      >
                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                        {m}
                      </span>
                    ))}
                    {(mission.evaluationResult.missedTargets ?? []).map((missed) => (
                      <span
                        key={missed}
                        className="inline-flex items-center gap-1 rounded-[var(--mz-radius-pill)] border border-warning/40 bg-amber-bg px-2.5 py-0.5 text-[11px] font-semibold text-warning"
                      >
                        {isRtl ? `فراموش شده: ${missed}` : `Try next: ${missed}`}
                      </span>
                    ))}
                  </LtrExamBoundary>
                ) : null}

                {(mission.evaluationResult.inlineUpgrades?.length ?? 0) > 0 ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-text-secondary">
                      {isRtl ? 'پیشنهاد ارتقای جملات:' : 'Sentence Upgrades to Save:'}
                    </p>
                    {mission.evaluationResult.inlineUpgrades!.map((u, idx) => {
                      const saved = savedUpgradeKeys.includes(u.improved);
                      return (
                        <div
                          key={`${u.improved}-${idx}`}
                          className="flex flex-wrap items-start justify-between gap-2 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <LtrExamBoundary>
                              <p>
                                <del className="text-text-tertiary">{u.original}</del>{' '}
                                <span className="inline-flex items-center gap-1 font-semibold text-success">
                                  <ForwardArrowIcon edition="glb" className="h-3.5 w-3.5" />
                                  {u.improved}
                                </span>
                              </p>
                            </LtrExamBoundary>
                            <p className="mt-1 text-text-secondary">
                              {isRtl && u.whyFa ? u.whyFa : u.whyEn}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={saved}
                            onClick={() => void handleSaveUpgradeToDeck(u.original, u.improved, u.whyEn)}
                            className="inline-flex h-10 shrink-0 items-center gap-1 rounded-[var(--mz-radius-compact)] border border-border-strong bg-canvas px-3 font-semibold text-primary hover:bg-surface-hover disabled:opacity-60"
                          >
                            <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>
                              {saved
                                ? t('evalResultAddedToSm2Badge')
                                : t('evalResultAddToSm2Action')}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {mission.evaluationResult.modelRewriteEn ? (
                  <div className="rounded-[var(--mz-radius-compact)] border border-primary/30 bg-surface-alt p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-primary">
                        {isRtl ? 'پاسخ نمونه نمره بالا' : 'Band 8+ Model Version'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title={t('listeningListen1xTitle')}
                          onClick={() => speakEnglishPhrase(mission.evaluationResult!.modelRewriteEn!, { rate: 1.0 })}
                          className="inline-flex items-center gap-1 rounded border border-border-subtle bg-canvas px-2 py-0.5 text-[11px] font-semibold text-text-primary"
                        >
                          <Volume2 className="h-3 w-3" aria-hidden="true" />
                          <span>{t('listeningListen1xTitle')}</span>
                        </button>
                        <button
                          type="button"
                          title={t('listeningListenSlowTitle')}
                          onClick={() => speakEnglishPhrase(mission.evaluationResult!.modelRewriteEn!, { rate: 0.8 })}
                          className="inline-flex items-center rounded border border-border-subtle bg-canvas px-2 py-0.5 text-[11px] font-semibold text-text-primary"
                        >
                          0.8x
                        </button>
                        <button
                          type="button"
                          data-testid="mission-rewrite-practice-btn"
                          onClick={() => setPracticeRewriteOpen(true)}
                          className="inline-flex items-center gap-1 rounded border border-primary/50 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/20"
                        >
                          <Mic className="h-3 w-3" aria-hidden="true" />
                          <span>{t('speechPracticeBtn')}</span>
                        </button>
                      </div>
                    </div>
                    <LtrExamBoundary className="mt-1.5 leading-relaxed text-text-primary">
                      {mission.evaluationResult.modelRewriteEn}
                    </LtrExamBoundary>
                  </div>
                ) : null}
              </div>
            </MzCard>
          ) : null}
        </>
      ) : null}

      <SpeechPracticeDrawer
        open={practiceRewriteOpen}
        onClose={() => setPracticeRewriteOpen(false)}
        targetText={mission?.evaluationResult?.modelRewriteEn ?? ''}
        practiceKind="feedback_shadow"
        sourceRefType="coach"
        sourceRefId={mission?.missionId}
        examTrack={examTrack}
      />
    </div>
  );
}
