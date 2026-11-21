import { Link } from '@tanstack/react-router';
import { CheckCircle2, Flame, Send, Sparkles, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MzCard } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { DailyMissionSnapshot } from '@/gateways/linguistic.gateway';
import { useDeps } from '@/spa/deps';

export interface DailyMissionScreenProps {
  readonly missionId?: string;
}

export function DailyMissionScreen({ missionId: _missionId }: DailyMissionScreenProps) {
  const deps = useDeps();
  const isRtl = deps.edition === 'irn';
  const [mission, setMission] = useState<DailyMissionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [profileRes, dueRes] = await Promise.all([
        deps.attemptStore.getUserProfile(),
        deps.vocabStore.getDueCards(deps.clock.todaySerialDay(), 5),
      ]);
      const track = profileRes.ok && profileRes.value ? profileRes.value.examId : 'ielts_academic';
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
    };
  }, [deps]);

  const handleSubmit = async () => {
    if (!mission || responseText.trim().length < 10) return;
    setSubmitting(true);
    setError(null);
    const res = await deps.linguistic.completeMission(mission.missionId, {
      responseText: responseText.trim(),
    });
    setSubmitting(false);
    if (res.ok) {
      setMission(res.value);
    } else {
      setError(res.error.message);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl py-10 text-sm text-text-secondary">
        {isRtl ? 'در حال آماده‌سازی مأموریت روزانه...' : 'Synthesizing your 10-minute Daily Mission...'}
      </div>
    );
  }

  return (
    <div data-testid="daily-mission-screen" className="mx-auto flex max-w-4xl flex-col gap-5 pb-10 text-start">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <Flame className="h-3.5 w-3.5" aria-hidden="true" />
            {isRtl ? 'مأموریت روزانه ۱۰ دقیقه‌ای' : '10-Min Closed-Loop Mission'}
          </p>
          <h1 className="font-editorial mt-1 text-3xl text-text-primary">
            {mission?.payload.promptTitle ?? (isRtl ? 'تمرین هدفمند امروز' : "Today's Transfer Mission")}
          </h1>
          {mission ? (
            <p className="mt-1 text-xs text-text-secondary">
              {isRtl ? 'موضوع مورد علاقه شما: ' : 'Focus topic: '}
              <span
                className="inline-flex items-center rounded-[var(--mz-radius-pill)] px-2 py-0.5 font-semibold text-white"
                style={{ backgroundColor: 'var(--mz-color-interest-tag)' }}
              >
                {mission.focusTopic}
              </span>
            </p>
          ) : null}
        </div>
        <Link
          to="/progress/graph"
          className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3 py-1.5 text-xs font-semibold text-primary hover:bg-surface-hover"
        >
          {isRtl ? 'مشاهده گراف زبانی' : 'View Linguistic Graph'}
        </Link>
      </header>

      {error ? (
        <div className="rounded-[var(--mz-radius-compact)] border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
          {error}
        </div>
      ) : null}

      {mission ? (
        <>
          <MzCard variant="default" data-testid="mission-forced-targets">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              <Target className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>
                {isRtl
                  ? 'حتماً از این ۲ ساختار هدف در پاسخ خود استفاده کنید:'
                  : 'Use these 2 Forced Target Structures:'}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {mission.payload.forcedTargets.map((target) => (
                <div
                  key={target.canonicalKey}
                  className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3"
                >
                  <LtrExamBoundary className="font-mono-exam text-sm font-semibold text-primary">
                    {target.phraseEn}
                  </LtrExamBoundary>
                  <p className="mt-1 text-xs text-text-secondary">
                    {isRtl && target.hintFa ? target.hintFa : target.hintEn}
                  </p>
                </div>
              ))}
            </div>
          </MzCard>

          <MzCard variant="hero">
            {isRtl && mission.payload.promptTextFa ? (
              <p className="mb-3 text-sm leading-relaxed text-text-primary">{mission.payload.promptTextFa}</p>
            ) : null}
            <LtrExamBoundary className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3.5 text-sm leading-relaxed text-text-primary">
              {mission.payload.promptTextEn}
            </LtrExamBoundary>

            <div className="mt-4">
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
                  {responseText.trim().split(/\s+/).filter(Boolean).length} {isRtl ? 'واژه' : 'words'}
                </span>
                <button
                  type="button"
                  data-testid="mission-complete-btn"
                  disabled={submitting || responseText.trim().length < 10}
                  onClick={() => void handleSubmit()}
                  className="inline-flex h-10 items-center gap-2 rounded-[var(--mz-radius-compact)] bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  <span>{isRtl ? 'ثبت و بررسی انتقال زبانی' : 'Complete Mission & Verify Targets'}</span>
                </button>
              </div>
            </div>
          </MzCard>

          {mission.status === 'completed' && mission.evaluationResult ? (
            <MzCard variant="default" data-testid="mission-completed-banner">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">
                    {isRtl ? 'مأموریت روزانه تکمیل شد!' : 'Daily Mission Completed!'}
                  </h2>
                  <p className="mt-1 text-xs text-text-secondary">
                    {isRtl && mission.evaluationResult.feedbackFa
                      ? mission.evaluationResult.feedbackFa
                      : mission.evaluationResult.feedbackEn}
                  </p>
                  {mission.evaluationResult.matchedTargets.length > 0 ? (
                    <LtrExamBoundary className="mt-2 flex flex-wrap gap-1.5">
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
                    </LtrExamBoundary>
                  ) : null}
                </div>
              </div>
            </MzCard>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
