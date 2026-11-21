import { Network, Pin, EyeOff, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MzCard } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { formatDisplayDate } from '@/edition/calendar/jalali-edge';
import type { LinguisticGraphSnapshot } from '@/gateways/linguistic.gateway';
import { useDeps } from '@/spa/deps';
import { utcMidnightMsFromSerialDay } from '@mockza/domain';

export function LinguisticGraphScreen() {
  const deps = useDeps();
  const isRtl = deps.edition === 'irn';
  const [graph, setGraph] = useState<LinguisticGraphSnapshot | null>(null);
  const [newTopic, setNewTopic] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void deps.linguistic.getMyGraph().then((res) => {
      if (!active) return;
      if (res.ok) setGraph(res.value);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [deps]);

  const handlePinTopic = async () => {
    if (!newTopic.trim()) return;
    const res = await deps.linguistic.updateInterests({
      pinTopics: [newTopic.trim()],
      muteTopics: [],
    });
    if (res.ok) {
      setGraph(res.value);
      setNewTopic('');
    }
  };

  const handleMuteTopic = async (canonicalKey: string) => {
    const res = await deps.linguistic.updateInterests({
      pinTopics: [],
      muteTopics: [canonicalKey],
    });
    if (res.ok) setGraph(res.value);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl py-10 text-sm text-text-secondary">
        {isRtl ? 'در حال بارگذاری گراف زبانی...' : 'Loading your Linguistic Graph...'}
      </div>
    );
  }

  return (
    <div data-testid="linguistic-graph-screen" className="mx-auto flex max-w-5xl flex-col gap-6 pb-10 text-start">
      <header className="border-b border-border-subtle pb-4">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
          <Network className="h-3.5 w-3.5" aria-hidden="true" />
          {isRtl ? 'مغزِ سیستم یادگیری' : 'Persistent Linguistic Graph'}
        </p>
        <h1 className="font-editorial mt-1 text-3xl text-text-primary">
          {isRtl ? 'الگوهای زبانی، گلوگاه‌ها و علایق شما' : 'Habits, Bottlenecks & Interest Graph'}
        </h1>
        <p className="mt-1 text-xs text-text-secondary">
          {isRtl
            ? `ردیابی ${graph?.totalEvidenceCount ?? 0} سیگنال واقعی از آزمون‌ها، تغییر لحن و محتوای ارسالی`
            : `Tracking ${graph?.totalEvidenceCount ?? 0} real production signals across exams, Register Shifter, and Drops`}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <MzCard variant="default">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <AlertTriangle
              className="h-4 w-4"
              style={{ color: 'var(--mz-color-gap-observed)' }}
              aria-hidden="true"
            />
            <span>{isRtl ? 'گلوگاه‌های فعال (Bottlenecks)' : 'Active Bottlenecks'}</span>
          </h2>
          <div className="mt-3 space-y-3">
            {(graph?.bottlenecks ?? []).length === 0 ? (
              <p className="text-xs text-text-secondary">
                {isRtl ? 'هنوز گلوگاه فعالی ثبت نشده است.' : 'Complete a writing or speaking check to surface habits.'}
              </p>
            ) : (
              graph!.bottlenecks.map((node) => (
                <div
                  key={node.nodeId}
                  className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-text-primary">
                      {isRtl && node.displayLabelFa ? node.displayLabelFa : node.displayLabelEn}
                    </span>
                    <span className="font-mono-exam text-[11px] text-text-secondary">
                      {Math.round(node.masteryScoreMilli / 10)}%
                    </span>
                  </div>
                  <p className="mt-1 text-text-secondary">
                    {isRtl && node.coachNoteFa ? node.coachNoteFa : node.coachNoteEn}
                  </p>
                  {node.lastExampleEn ? (
                    <LtrExamBoundary className="mt-1.5 block rounded bg-surface-alt px-2 py-1 font-mono text-[11px] text-text-secondary">
                      “{node.lastExampleEn}”
                    </LtrExamBoundary>
                  ) : null}
                  <p className="mt-1.5 text-[11px] text-text-secondary">
                    {formatDisplayDate(utcMidnightMsFromSerialDay(node.lastSeenDaySerial), deps.edition)}
                  </p>
                </div>
              ))
            )}
          </div>
        </MzCard>

        <MzCard variant="default">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <CheckCircle2
              className="h-4 w-4"
              style={{ color: 'var(--mz-color-structure-mastered)' }}
              aria-hidden="true"
            />
            <span>{isRtl ? 'ساختارهای تسلط‌یافته' : 'Mastered & Active Structures'}</span>
          </h2>
          <div className="mt-3 space-y-3">
            {(graph?.targetStructures ?? []).length === 0 ? (
              <p className="text-xs text-text-secondary">
                {isRtl ? 'هنوز ساختار فعالی تیک نخورده است.' : 'Target structures you recycle in missions appear here.'}
              </p>
            ) : (
              graph!.targetStructures.map((node) => (
                <div
                  key={node.nodeId}
                  className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <LtrExamBoundary className="font-mono-exam font-semibold text-primary">
                      {node.displayLabelEn}
                    </LtrExamBoundary>
                    <span
                      className="rounded-[var(--mz-radius-pill)] px-2 py-0.5 text-[11px] font-semibold text-white"
                      style={{ backgroundColor: 'var(--mz-color-structure-mastered)' }}
                    >
                      {Math.round(node.masteryScoreMilli / 10)}%
                    </span>
                  </div>
                  <p className="mt-1 text-text-secondary">
                    {isRtl && node.coachNoteFa ? node.coachNoteFa : node.coachNoteEn}
                  </p>
                </div>
              ))
            )}
          </div>
        </MzCard>
      </div>

      <MzCard variant="default">
        <h2 className="text-sm font-semibold text-text-primary">
          {isRtl ? 'علایق موضوعی برای ساخت مأموریت‌های روزانه' : 'Interest Topics Shaping Your Daily Missions'}
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(graph?.interestTopics ?? [])
            .filter((t) => !t.isMuted)
            .map((topic) => (
              <span
                key={topic.nodeId}
                className="inline-flex items-center gap-1.5 rounded-[var(--mz-radius-pill)] border border-border-subtle bg-bg-raised px-3 py-1 text-xs font-semibold text-text-primary"
              >
                {topic.isPinned ? <Pin className="h-3 w-3 text-primary" aria-hidden="true" /> : null}
                <span>{isRtl && topic.displayLabelFa ? topic.displayLabelFa : topic.displayLabelEn}</span>
                <button
                  type="button"
                  aria-label="Mute topic"
                  onClick={() => void handleMuteTopic(topic.canonicalKey)}
                  className="ms-1 text-text-secondary hover:text-danger"
                >
                  <EyeOff className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <input
            type="text"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            placeholder={isRtl ? 'مثلاً: معماری نرم‌افزار یا فوتبال...' : 'Pin a topic (e.g., Football, Systems Design)...'}
            className="h-9 min-w-56 flex-1 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-surface px-3 text-xs text-text-primary focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            data-testid="pin-interest-btn"
            onClick={() => void handlePinTopic()}
            className="inline-flex h-9 items-center gap-1 rounded-[var(--mz-radius-compact)] bg-primary px-3 text-xs font-semibold text-on-primary"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isRtl ? 'پین موضوع' : 'Pin Topic'}</span>
          </button>
        </div>
      </MzCard>
    </div>
  );
}
