import { Link } from '@tanstack/react-router';
import {
  AlertTriangle,
  CheckCircle2,
  EyeOff,
  Flame,
  Network,
  Pin,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { MzCard } from '@/components/ui';
import { ForwardArrowIcon } from '@/components/bidi/DirectionIcon';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { formatTopicLabel } from '@/components/bidi/topic-labels';
import { toPersianDigits } from '@/edition/bidi/numerals';
import { formatDisplayDate } from '@/edition/calendar/jalali-edge';
import type { LinguisticGraphSnapshot } from '@/gateways/linguistic.gateway';
import type { PersonalizationStateDto } from '@/gateways/personalization.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import { utcMidnightMsFromSerialDay, CANONICAL_TOPICS, TOPIC_METADATA } from '@mockza/domain';

const STARTER_TOPICS = CANONICAL_TOPICS.map((key) => ({
  key,
  labelEn: TOPIC_METADATA[key].labelEn,
  labelFa: TOPIC_METADATA[key].labelFa,
}));

export function LinguisticGraphScreen() {
  const deps = useDeps();
  const isRtl = deps.edition === 'irn';
  const t = createTranslator(deps.edition);
  const [graph, setGraph] = useState<LinguisticGraphSnapshot | null>(null);
  const [pState, setPState] = useState<PersonalizationStateDto | null>(null);
  const [newTopic, setNewTopic] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void Promise.all([
      deps.linguistic.getMyGraph(),
      deps.personalization ? deps.personalization.getState() : Promise.resolve(null),
    ]).then(([res, pRes]) => {
      if (!active) return;
      if (res.ok) setGraph(res.value);
      if (pRes && pRes.ok) setPState(pRes.value);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [deps]);

  const handlePinTopicValue = async (topicLabel: string) => {
    const clean = topicLabel.trim();
    if (!clean) return;
    const res = await deps.linguistic.updateInterests({
      pinTopics: [clean],
      muteTopics: [],
    });
    if (res.ok) {
      setGraph(res.value);
      if (clean === newTopic.trim()) setNewTopic('');
    }
  };

  const handlePinTopic = async () => {
    await handlePinTopicValue(newTopic);
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
      <div className="mx-auto w-full max-w-6xl py-10 text-sm text-text-secondary">
        {isRtl ? 'در حال بارگذاری نقاط ضعف و پیشرفت...' : 'Loading your Weak Spots & Topics...'}
      </div>
    );
  }

  const pinnedLabelsLower = new Set(
    (graph?.interestTopics ?? [])
      .filter((topic) => !topic.isMuted)
      .map((topic) => topic.displayLabelEn.toLowerCase()),
  );

  return (
    <div data-testid="linguistic-graph-screen" className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10 text-start">
      <header className="border-b border-border-subtle pb-4">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
          <Network className="h-3.5 w-3.5" aria-hidden="true" />
          {t('graphEyebrow')}
        </p>
        <h1 className="font-editorial mt-1 text-3xl text-text-primary">
          {t('graphTitle')}
        </h1>
        <p className="mt-1 text-xs text-text-secondary">
          {isRtl
            ? `ردیابی ${toPersianDigits(graph?.totalEvidenceCount ?? 0)} سیگنال واقعی از آزمون‌ها، ارتقای گفتار و منابع مطالعاتی`
            : `Tracking ${graph?.totalEvidenceCount ?? 0} real production signals across exams, speaking upgrades, and study sets`}
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
            <span>{t('graphActiveBottlenecks')}</span>
          </h2>
          <div className="mt-3 space-y-3">
            {(graph?.bottlenecks ?? []).length === 0 ? (
              <div className="space-y-3 rounded-[var(--mz-radius-compact)] border border-dashed border-border-subtle bg-bg-raised p-4 text-xs">
                <p className="leading-relaxed text-text-secondary">
                  {isRtl
                    ? 'هنوز خطای پرتکراری ثبت نشده است. با یک تمرین ۱۰ دقیقه‌ای یا ارتقای جمله، نقشه دقیق نقاط ضعف شما شکل می‌گیرد.'
                    : 'No recurring weak spots recorded yet. Run one 10-minute session or upgrade one casual thought to build your baseline map.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to="/mission/$missionId"
                    params={{ missionId: 'today' }}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--mz-radius-compact)] bg-primary px-3.5 text-xs font-semibold text-on-primary"
                  >
                    <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{isRtl ? 'شروع مربی امروز' : "Start Today's 10-Min Coach"}</span>
                  </Link>
                  <Link
                    to="/register-shifter"
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--mz-radius-compact)] border border-border-strong bg-canvas px-3.5 text-xs font-semibold text-primary"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{isRtl ? 'ارتقای گفتار' : 'Upgrade a Thought'}</span>
                  </Link>
                </div>
              </div>
            ) : (
              graph!.bottlenecks.map((node) => {
                const pct = Math.min(100, Math.max(0, Math.round(node.masteryScoreMilli / 10)));
                return (
                  <div
                    key={node.nodeId}
                    className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-text-primary">
                        {isRtl && node.displayLabelFa ? node.displayLabelFa : node.displayLabelEn}
                      </span>
                      <span className="font-mono-exam text-[11px] text-text-secondary">
                        {isRtl ? `${toPersianDigits(pct)}٪` : `${pct}%`}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: 'var(--mz-color-gap-observed)',
                        }}
                      />
                    </div>
                    <p className="mt-2 text-text-secondary">
                      {isRtl && node.coachNoteFa ? node.coachNoteFa : node.coachNoteEn}
                    </p>
                    {node.lastExampleEn ? (
                      <LtrExamBoundary className="mt-1.5 block rounded bg-surface-alt px-2 py-1 font-mono text-[11px] text-text-secondary">
                        “{node.lastExampleEn}”
                      </LtrExamBoundary>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-text-secondary">
                        {formatDisplayDate(utcMidnightMsFromSerialDay(node.lastSeenDaySerial), deps.edition)}
                      </span>
                      <Link
                        to="/mission/$missionId"
                        params={{ missionId: 'today' }}
                        className="inline-flex min-h-9 items-center gap-1 font-semibold text-primary hover:underline"
                      >
                        <span>{isRtl ? 'رفع در تمرین امروز' : 'Fix This Now'}</span>
                        <ForwardArrowIcon edition={deps.edition} className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })
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
            <span>{t('graphMasteredStructures')}</span>
          </h2>
          <div className="mt-3 space-y-3">
            {(graph?.targetStructures ?? []).length === 0 ? (
              <p className="text-xs text-text-secondary">
                {isRtl ? 'ساختارهایی که در تمرین‌های روزانه با موفقیت به کار می‌برید اینجا ثبت می‌شوند.' : 'Target structures you master in daily sessions appear here.'}
              </p>
            ) : (
              graph!.targetStructures.map((node) => {
                const pct = Math.min(100, Math.max(0, Math.round(node.masteryScoreMilli / 10)));
                return (
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
                        {isRtl ? `${toPersianDigits(pct)}٪` : `${pct}%`}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: 'var(--mz-color-structure-mastered)',
                        }}
                      />
                    </div>
                    <p className="mt-2 text-text-secondary">
                      {isRtl && node.coachNoteFa ? node.coachNoteFa : node.coachNoteEn}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </MzCard>
      </div>

      {pState ? (
        <MzCard variant="default" data-testid="graph-coverage-matrix">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-text-primary">
              {t('graphCoverageTitle')}
            </h2>
            <span className="rounded-[var(--mz-radius-pill)] bg-primary-subtle px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              {t('graphCoveragePhaseLabel')}:{' '}
              {pState.profile.activeWeaknessPhase === 'favorite_topics'
                ? t('roadmapPhaseFavoriteTopics')
                : pState.profile.activeWeaknessPhase === 'weakness_transfer'
                  ? t('roadmapPhaseWeaknessTransfer')
                  : t('roadmapPhaseExamBreadth')}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3 text-xs">
              <div className="text-text-secondary">{t('graphCoverageFavoriteMastered')}</div>
              <div className="mt-1 text-lg font-bold tabular-nums text-text-primary">
                {isRtl
                  ? toPersianDigits(pState.topicCoverageSummary.masteredInFavoriteTopicsCount)
                  : pState.topicCoverageSummary.masteredInFavoriteTopicsCount}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pState.profile.favoriteTopics.map((topicKey) => {
                  return (
                    <span
                      key={topicKey}
                      className="rounded-[var(--mz-radius-pill)] border border-border-subtle bg-surface px-2.5 py-0.5 text-[11px] text-text-secondary"
                    >
                      {formatTopicLabel(topicKey, deps.edition)}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3 text-xs">
              <div className="text-text-secondary">{t('graphCoverageTransferred')}</div>
              <div className="mt-1 text-lg font-bold tabular-nums text-text-primary">
                {isRtl
                  ? toPersianDigits(pState.topicCoverageSummary.transferredToOtherTopicsCount)
                  : pState.topicCoverageSummary.transferredToOtherTopicsCount}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pState.weaknesses.slice(0, 4).map((w) => (
                  <span
                    key={w.canonicalKey}
                    className={`rounded-[var(--mz-radius-pill)] px-2 py-0.5 text-[11px] font-medium ${
                      w.status === 'mastered'
                        ? 'bg-success/15 text-success'
                        : w.status === 'resolving'
                          ? 'bg-warning/15 text-warning'
                          : 'bg-danger/10 text-danger'
                    }`}
                  >
                    {isRtl ? w.displayLabelFa : w.displayLabelEn} ({Math.round(w.masteryScoreMilli / 10)}%)
                  </span>
                ))}
              </div>
            </div>
          </div>
        </MzCard>
      ) : null}

      <MzCard variant="default">
        <h2 className="text-sm font-semibold text-text-primary">
          {t('graphInterestTopics')}
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          {isRtl
            ? 'موضوعات دلخواهتان را انتخاب یا پین کنید تا مربی روزانه بر اساس همین علایق تمرین بسازد.'
            : 'Tap a quick topic or pin your own so daily prompts stay engaging.'}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {STARTER_TOPICS.filter((s) => !pinnedLabelsLower.has(s.labelEn.toLowerCase())).map((topic) => (
            <button
              key={topic.key}
              type="button"
              onClick={() => void handlePinTopicValue(topic.labelEn)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--mz-radius-pill)] border border-dashed border-primary/50 bg-canvas px-3.5 py-2 text-xs font-medium text-primary hover:bg-surface-hover"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isRtl ? topic.labelFa : topic.labelEn}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(graph?.interestTopics ?? [])
            .filter((t) => !t.isMuted)
            .map((topic) => (
              <span
                key={topic.nodeId}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--mz-radius-pill)] border border-border-subtle bg-bg-raised ps-3.5 pe-1.5 text-xs font-semibold text-text-primary"
              >
                {topic.isPinned ? <Pin className="h-3 w-3 text-primary" aria-hidden="true" /> : null}
                <span>{isRtl && topic.displayLabelFa ? topic.displayLabelFa : topic.displayLabelEn}</span>
                <button
                  type="button"
                  aria-label="Mute topic"
                  onClick={() => void handleMuteTopic(topic.canonicalKey)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-surface-hover hover:text-danger"
                >
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
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
            className="h-10 min-w-56 flex-1 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-surface px-3 text-xs text-text-primary focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            data-testid="pin-interest-btn"
            onClick={() => void handlePinTopic()}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--mz-radius-compact)] bg-primary px-4 text-xs font-semibold text-on-primary"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('graphPinTopicBtn')}</span>
          </button>
        </div>
      </MzCard>
    </div>
  );
}
