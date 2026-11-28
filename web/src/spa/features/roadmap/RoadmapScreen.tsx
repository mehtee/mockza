import {
  CANONICAL_TOPICS,
  generateOrRecalibrateRoadmap,
  mapCefrTierToExamScore,
  normalizeFavoriteTopicList,
  TOPIC_METADATA,
} from '@mockza/domain';
import { Link } from '@tanstack/react-router';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Lock,
  Mic,
  Play,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SpeechPracticeDrawer } from '@/components/speech/SpeechPracticeDrawer';
import { MzBanner, MzButton, MzCard, MzModal } from '@/components/ui';
import { ForwardArrowIcon } from '@/components/bidi/DirectionIcon';
import { formatChromeNumber } from '@/edition/bidi/numerals';
import { formatTopicLabel } from '@/components/bidi/topic-labels';
import type { PersonalizationStateDto } from '@/gateways/personalization.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import { resolveWebRoadmapStepPath, type RoadmapStepDto } from '@/spa/roadmap-route-resolver';

function contextualPracticeSentenceForStep(step: RoadmapStepDto | null): string {
  if (!step) return '';
  if (step.weaknessKey?.includes('tense')) {
    return 'Yesterday our engineering team evaluated the prototype and submitted the revised specifications.';
  }
  const topic = step.topicKey.replace(/_/g, ' ');
  return `Sustainable innovation in ${topic} requires clear evidence, structured reasoning, and consistent daily practice.`;
}

export function RoadmapScreen() {
  const deps = useDeps();
  const isRtl = deps.edition === 'irn';
  const t = useMemo(() => createTranslator(deps.edition), [deps.edition]);

  const [state, setState] = useState<PersonalizationStateDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyStepId, setBusyStepId] = useState<string | null>(null);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [showCompletedSteps, setShowCompletedSteps] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);
  const [pronStep, setPronStep] = useState<RoadmapStepDto | null>(null);
  const [topicsModalOpen, setTopicsModalOpen] = useState(false);
  const [draftTopics, setDraftTopics] = useState<string[]>([]);
  const [draftMinutes, setDraftMinutes] = useState<number>(30);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const buildOfflineStarterState = useCallback(async (): Promise<PersonalizationStateDto> => {
    const profRes = await deps.attemptStore.getUserProfile();
    const profile = profRes.ok ? profRes.value : null;
    const examTrack = profile?.examId ?? 'ielts_academic';
    const targetBand = profile?.targetBand ?? 7.5;
    const favTopics = normalizeFavoriteTopicList(profile?.favoriteTopics ?? []);
    const studyFocus =
      profile?.studyFocus === 'coach' || profile?.studyFocus === 'exams'
        ? profile.studyFocus
        : 'both';
    const todaySerial = deps.clock.todaySerialDay();
    const generated = generateOrRecalibrateRoadmap({
      examId: examTrack,
      currentBand: null,
      targetBand,
      targetDateSerial: profile?.targetDateSerial ?? null,
      todaySerial,
      studyFocus,
      dailyMinutesGoal: 30,
      favoriteTopics: favTopics,
      weaknessNodes: [],
      coverage: [],
      packs: [],
      drills: [],
      diagnosticDone: false,
      currentVocabWave: 1,
    });
    const starterBaseline = mapCefrTierToExamScore('B1', examTrack);
    const mappedSteps: RoadmapStepDto[] = generated.steps.map((s) => ({
      stepId: s.stepKey,
      milestoneIndex: s.milestoneIndex,
      stepOrder: s.stepOrder,
      stepKind: s.stepKind,
      skill: s.skill,
      titleEn: s.titleEn,
      titleFa: s.titleFa,
      reasonEn: s.reasonEn,
      reasonFa: s.reasonFa,
      topicKey: s.topicKey,
      weaknessKey: s.weaknessKey,
      targetRoute: s.targetRefId,
      targetEntityId: s.targetRefId || null,
      status: s.status === 'locked_preview' ? 'locked' : s.status,
      estimatedMinutes: s.estimatedMinutes,
    }));
    const starterCurrent =
      mappedSteps.find((s) => s.status === 'active' && s.stepKind !== 'diagnostic') ??
      mappedSteps.find((s) => s.status === 'active') ??
      mappedSteps[0] ??
      null;
    return {
      profile: {
        examTrack,
        targetBand,
        targetDateIso: null,
        dailyMinutesGoal: 30,
        studyFocus,
        favoriteTopics: favTopics,
        activeWeaknessPhase: 'favorite_topics',
        vocabUnlockedWave: 1,
        dailyNewVocabCap: 10,
        preferredTtsAccent: 'us',
        bandShiftAcknowledged: false,
        onboardingCompleted: profile?.onboardingCompleted ?? true,
      },
      liveBand: {
        examTrack,
        currentBand: null,
        targetBand,
        bandShift: 0,
        confidence: 'provisional',
        skills: {
          reading: { score: null, confidence: 'provisional', evidenceCount: 0, lastUpdatedAt: null, trendDelta: null },
          listening: { score: null, confidence: 'provisional', evidenceCount: 0, lastUpdatedAt: null, trendDelta: null },
          writing: { score: null, confidence: 'provisional', evidenceCount: 0, lastUpdatedAt: null, trendDelta: null },
          speaking: { score: null, confidence: 'provisional', evidenceCount: 0, lastUpdatedAt: null, trendDelta: null },
        },
      },
      weaknesses: [],
      roadmap: {
        planId: 'offline-starter-plan',
        examTrack,
        planRevision: 1,
        baselineBand: starterBaseline,
        targetBand,
        isSprintMode: generated.isSprintMode,
        milestones: generated.milestones.map((m) => ({
          index: m.index,
          titleEn: m.titleEn,
          titleFa: m.titleFa,
          phaseLabelEn: m.goalEn,
          phaseLabelFa: m.goalFa,
          targetBandDelta: Number((m.targetBandMarker - starterBaseline).toFixed(1)),
          status: m.status === 'upcoming' ? 'locked' : m.status,
        })),
        currentStep: starterCurrent,
        steps: mappedSteps,
      },
      nextRecommendedPack: null,
      nextRecommendedDrill: null,
      recommendedPacks: [],
      recommendedDrills: [],
      vocabWaveSummary: {
        unlockedWave: 1,
        totalWaves: 1,
        currentWaveTotal: 0,
        currentWaveLearned: 0,
        readyToUnlockNext: false,
        dailyNewRemaining: 10,
      },
      topicCoverageSummary: {
        phase: 'favorite_topics',
        masteredInFavoriteTopicsCount: 0,
        transferredToOtherTopicsCount: 0,
      },
    };
  }, [deps.attemptStore, deps.clock]);

  const loadState = useCallback(async () => {
    setErrorMsg(null);
    if (!deps.personalization) {
      const offlineState = await buildOfflineStarterState();
      setState(offlineState);
      setDraftTopics([...offlineState.profile.favoriteTopics]);
      setIsLoading(false);
      return;
    }
    const res = await deps.personalization.getState();
    setIsLoading(false);
    if (res.ok) {
      setState(res.value);
      setDraftTopics([...res.value.profile.favoriteTopics]);
      setDraftMinutes(res.value.profile.dailyMinutesGoal);
    } else {
      const offlineState = await buildOfflineStarterState();
      setState((prev) => prev ?? offlineState);
      setErrorMsg(res.error.message);
    }
  }, [buildOfflineStarterState, deps.personalization]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const handleStepAction = async (stepId: string, status: 'completed' | 'skipped') => {
    if (!deps.personalization) return;
    setBusyStepId(stepId);
    const res = await deps.personalization.advanceRoadmapStep(stepId, status);
    setBusyStepId(null);
    if (res.ok) {
      setState(res.value);
    } else {
      setErrorMsg(res.error.message);
    }
  };

  const handleSaveTopicsAndPace = async () => {
    if (!deps.personalization) return;
    setSavingPrefs(true);
    const res = await deps.personalization.updateProfile({
      favoriteTopics: draftTopics.slice(0, 5),
      dailyMinutesGoal: draftMinutes,
    });
    setSavingPrefs(false);
    if (res.ok) {
      setState(res.value);
      setTopicsModalOpen(false);
      setNoticeMsg(
        isRtl
          ? 'نقشه راه بر اساس موضوعات و زمان جدید شما به‌روزرسانی شد.'
          : 'Roadmap recalibrated with your updated topics & pace!',
      );
    } else {
      setErrorMsg(res.error.message);
    }
  };

  const currentPhaseLabel = (() => {
    const phase = state?.profile.activeWeaknessPhase ?? 'favorite_topics';
    if (phase === 'weakness_transfer') return t('roadmapPhaseWeaknessTransfer');
    if (phase === 'exam_breadth') return t('roadmapPhaseExamBreadth');
    return t('roadmapPhaseFavoriteTopics');
  })();

  const allSteps = state?.roadmap.steps ?? [];
  const completedSteps = useMemo(
    () => allSteps.filter((s) => s.status === 'completed' || s.status === 'skipped'),
    [allSteps],
  );
  const activeSteps = useMemo(() => {
    const primary = allSteps.filter((s) => s.status === 'active');
    if (primary.length > 0) {
      return [...primary].sort((a, b) => a.stepOrder - b.stepOrder).slice(0, 3);
    }
    if (state?.roadmap.currentStep) return [state.roadmap.currentStep];
    return [];
  }, [allSteps, state?.roadmap.currentStep]);

  const upcomingSteps = useMemo(() => {
    const activeIds = new Set(activeSteps.map((s) => s.stepId));
    return allSteps.filter(
      (s) => !activeIds.has(s.stepId) && s.status !== 'completed' && s.status !== 'skipped',
    );
  }, [activeSteps, allSteps]);

  return (
    <div data-testid="roadmap-screen" className="mx-auto flex max-w-6xl flex-col gap-6 pb-10 text-start">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('roadmapEyebrow')}</span>
          </p>
          <h1 className="font-editorial mt-1 text-3xl text-text-primary">{t('roadmapTitle')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('roadmapSubtitle')}</p>
        </div>

        {state ? (
          <div className="flex flex-wrap items-center gap-2">
            <span
              data-testid="roadmap-phase-pill"
              className="rounded-[var(--mz-radius-pill)] border border-primary/40 bg-surface-alt px-3 py-1 text-xs font-semibold text-primary"
            >
              {currentPhaseLabel}
            </span>
            <span
              className={[
                'rounded-[var(--mz-radius-pill)] border border-border-subtle bg-bg-raised px-3 py-1 text-xs font-semibold text-text-primary',
                isRtl && state.liveBand.currentBand == null ? '' : 'font-mono-exam',
              ].join(' ')}
            >
              {state.liveBand.currentBand ?? (isRtl ? 'نامشخص (پایه)' : 'Not set (Starter)')} /{' '}
              {formatChromeNumber(state.liveBand.targetBand, deps.edition)}
            </span>
            <MzButton
              variant="secondary"
              size="sm"
              data-testid="roadmap-edit-topics-pace-btn"
              onClick={() => setTopicsModalOpen(true)}
              leadingIcon={<SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              {t('roadmapEditTopicsPaceBtn')}
            </MzButton>
          </div>
        ) : null}
      </header>

      {errorMsg ? <MzBanner tone="warning">{errorMsg}</MzBanner> : null}
      {noticeMsg ? <MzBanner tone="success">{noticeMsg}</MzBanner> : null}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="h-28 animate-pulse rounded-[var(--mz-radius-card)] border border-border-subtle bg-surface"
            />
          ))}
        </div>
      ) : null}

      {/* Panorama (دورنما): 4-Milestone Horizontal Map (completed collapsed cleanly) */}
      {state && state.roadmap.milestones.length > 0 ? (
        <section data-testid="roadmap-panorama" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
              {t('roadmapPanoramaTitle')}
            </h2>
            <span className="text-xs text-text-secondary">
              {state.profile.favoriteTopics.length > 0
                ? `${formatChromeNumber(state.profile.favoriteTopics.length, deps.edition)} ${isRtl ? 'موضوع مورد علاقه فعال' : 'favorite topics active'}`
                : isRtl
                  ? 'مسیر تطبیقی هوشمند'
                  : 'Adaptive trajectory'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {state.roadmap.milestones.map((ms) => {
              const isActive = ms.status === 'active';
              const isCompleted = ms.status === 'completed';
              return (
                <MzCard
                  key={ms.index}
                  padding="md"
                  variant={isActive ? 'hero' : 'default'}
                  data-testid={`roadmap-milestone-${ms.index}`}
                  className={isActive ? 'ring-2 ring-primary/40' : isCompleted ? 'border-success/50 bg-mint-bg/30' : 'opacity-85'}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-exam text-xs font-bold text-primary">
                      {formatChromeNumber(`0${ms.index}`, deps.edition)}
                    </span>
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                    ) : ms.status === 'locked' ? (
                      <Lock className="h-3.5 w-3.5 text-text-secondary" aria-hidden="true" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                    )}
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-text-primary">
                    {isRtl ? ms.titleFa : ms.titleEn}
                  </h3>
                  <p className="mt-1 text-xs text-text-secondary">
                    {isCompleted
                      ? t('roadmapStepCompletedLabel')
                      : isRtl
                        ? ms.phaseLabelFa
                        : ms.phaseLabelEn}
                  </p>
                </MzCard>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Completed Steps Summary Pill */}
      {completedSteps.length > 0 ? (
        <div>
          <button
            type="button"
            data-testid="roadmap-toggle-completed"
            onClick={() => setShowCompletedSteps((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-[var(--mz-radius-pill)] border border-success/40 bg-mint-bg px-3 py-1 text-xs font-semibold text-success"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {t('roadmapCollapseCompletedLabel', {
                count: formatChromeNumber(completedSteps.length, deps.edition),
              })}
            </span>
          </button>
          {showCompletedSteps ? (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {completedSteps.map((step) => (
                <div
                  key={step.stepId}
                  className="flex items-center justify-between rounded-[var(--mz-radius-compact)] border border-success/30 bg-bg-raised px-3 py-2 text-xs text-text-secondary"
                >
                  <span>{isRtl ? step.titleFa : step.titleEn}</span>
                  <span className="font-semibold text-success">{t('roadmapStepCompletedLabel')}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Step-by-Step Focus: ONLY Active Steps */}
      <section data-testid="roadmap-current-steps" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
            {t('roadmapCurrentStepsTitle')}
          </h2>
          {state && state.weaknesses.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {state.weaknesses.slice(0, 3).map((w) => (
                <span
                  key={w.canonicalKey}
                  className="rounded-[var(--mz-radius-pill)] border border-warning/40 bg-amber-bg px-2.5 py-0.5 text-[11px] font-semibold text-warning"
                >
                  {isRtl ? w.displayLabelFa : w.displayLabelEn}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {activeSteps.length === 0 && !isLoading ? (
          <MzCard padding="md" className="space-y-3">
            <p className="text-sm text-text-secondary">
              {isRtl
                ? 'برای فعال‌سازی گام‌های دقیق‌تر، آزمون ۱۰ دقیقه‌ای اول یا یک تمرین روزانه انجام دهید.'
                : 'Complete your 10-min diagnostic or today’s coach session to generate your next adaptive steps.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/diagnostic/intro"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--mz-radius-compact)] bg-primary px-4 text-xs font-semibold text-on-primary"
              >
                <span>{t('homeStartDiagnosticCta')}</span>
                <ForwardArrowIcon edition={deps.edition} className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/practice"
                className="inline-flex min-h-11 items-center rounded-[var(--mz-radius-compact)] border border-border-subtle px-4 text-xs font-semibold text-text-primary hover:bg-surface-hover"
              >
                {t('navPractice')}
              </Link>
            </div>
          </MzCard>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {activeSteps.map((step, index) => (
              <MzCard
                key={step.stepId}
                variant={index === 0 ? 'hero' : 'default'}
                padding="md"
                data-testid={`roadmap-active-step-${step.stepOrder}`}
                className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-[var(--mz-radius-pill)] bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                      {isRtl
                        ? `گام ${formatChromeNumber(step.stepOrder, deps.edition)} · ${formatChromeNumber(step.estimatedMinutes, deps.edition)} دقیقه`
                        : `Step ${step.stepOrder} · ${step.estimatedMinutes}m`}
                    </span>
                    <span className="rounded-[var(--mz-radius-pill)] border border-border-subtle bg-bg-raised px-2.5 py-0.5 text-[11px] text-text-secondary">
                      {formatTopicLabel(step.topicKey, deps.edition)}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-text-primary">
                    {isRtl ? step.titleFa : step.titleEn}
                  </h3>
                  <p className="text-xs leading-relaxed text-text-secondary">
                    {isRtl ? step.reasonFa : step.reasonEn}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:shrink-0">
                  {step.stepKind === 'pronunciation' ? (
                    <MzButton
                      variant="primary"
                      size="md"
                      className="col-span-2 w-full sm:col-span-1 sm:w-auto"
                      data-testid={`roadmap-step-open-${step.stepId}`}
                      onClick={() => setPronStep(step)}
                      leadingIcon={<Mic className="h-3.5 w-3.5" aria-hidden="true" />}
                    >
                      {t('speechPracticeBtn')}
                    </MzButton>
                  ) : (
                    <Link
                      to={resolveWebRoadmapStepPath(step) as never}
                      data-testid={`roadmap-step-open-${step.stepId}`}
                      className="col-span-2 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--mz-radius-compact)] bg-primary px-4 text-xs font-semibold text-on-primary hover:bg-primary-pressed sm:col-span-1 sm:w-auto"
                    >
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('roadmapOpenStepCta')}</span>
                    </Link>
                  )}

                  <MzButton
                    variant="secondary"
                    size="md"
                    isLoading={busyStepId === step.stepId}
                    data-testid={`roadmap-step-complete-${step.stepId}`}
                    onClick={() => void handleStepAction(step.stepId, 'completed')}
                    leadingIcon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                  >
                    {t('roadmapCompleteStepCta')}
                  </MzButton>

                  <MzButton
                    variant="ghost"
                    size="md"
                    disabled={busyStepId === step.stepId}
                    data-testid={`roadmap-step-skip-${step.stepId}`}
                    onClick={() => void handleStepAction(step.stepId, 'skipped')}
                    leadingIcon={<SkipForward className="h-3.5 w-3.5" aria-hidden="true" />}
                  >
                    {t('roadmapSkipStepCta')}
                  </MzButton>
                </div>
              </MzCard>
            ))}
          </div>
        )}
      </section>

      {/* Collapsible Upcoming Steps Drawer with Soft Jump Ahead */}
      {upcomingSteps.length > 0 ? (
        <section className="space-y-3">
          <button
            type="button"
            data-testid="roadmap-toggle-upcoming"
            onClick={() => setShowUpcoming((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-surface px-3.5 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            {showUpcoming ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
            <span>
              {showUpcoming
                ? t('roadmapHideUpcomingToggle')
                : `${t('roadmapUpcomingToggle')} (${formatChromeNumber(upcomingSteps.length, deps.edition)})`}
            </span>
          </button>

          {showUpcoming ? (
            <div data-testid="roadmap-upcoming-list" className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {upcomingSteps.map((step) => (
                <div
                  key={step.stepId}
                  className="flex flex-col justify-between gap-2 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-semibold text-text-primary">
                        {isRtl
                          ? `ایستگاه ${formatChromeNumber(step.milestoneIndex, deps.edition)} · ${step.titleFa}`
                          : `Milestone ${step.milestoneIndex} · ${step.titleEn}`}
                      </p>
                      <p className="text-text-secondary">{isRtl ? step.reasonFa : step.reasonEn}</p>
                    </div>
                    <span className="shrink-0 rounded-[var(--mz-radius-pill)] border border-border-subtle bg-surface px-2.5 py-0.5 text-[11px] font-medium text-text-secondary">
                      {isRtl
                        ? `${formatChromeNumber(step.estimatedMinutes, deps.edition)} دقیقه`
                        : `${step.estimatedMinutes}m`}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <Link
                      to={resolveWebRoadmapStepPath(step) as never}
                      className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <span>{t('roadmapJumpAheadCta')}</span>
                      <ForwardArrowIcon edition={deps.edition} className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <MzModal
        open={topicsModalOpen}
        onOpenChange={setTopicsModalOpen}
        title={t('roadmapEditTopicsPaceBtn')}
      >
        <div className="space-y-4 text-xs">
          <div>
            <p className="font-semibold text-text-primary">{t('settingsFavoriteTopicsTitle')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CANONICAL_TOPICS.map((topicKey) => {
                const selected = draftTopics.includes(topicKey);
                const meta = TOPIC_METADATA[topicKey];
                return (
                  <button
                    key={topicKey}
                    type="button"
                    onClick={() =>
                      setDraftTopics((prev) =>
                        prev.includes(topicKey)
                          ? prev.filter((k) => k !== topicKey)
                          : [...prev.slice(-4), topicKey],
                      )
                    }
                    className={`rounded-[var(--mz-radius-pill)] border px-3 py-1 font-semibold transition-colors ${
                      selected
                        ? 'border-primary bg-primary text-on-primary'
                        : 'border-border-subtle bg-bg-raised text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {isRtl ? meta.labelFa : meta.labelEn}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="font-semibold text-text-primary">
              {isRtl
                ? `زمان مطالعه روزانه: ${formatChromeNumber(draftMinutes, deps.edition)} دقیقه`
                : `Daily study pace: ${draftMinutes} min/day`}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[15, 30, 45, 60, 90].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDraftMinutes(mins)}
                  className={`rounded-[var(--mz-radius-compact)] border px-3 py-1.5 font-mono font-semibold ${
                    draftMinutes === mins
                      ? 'border-primary bg-primary text-on-primary'
                      : 'border-border-subtle bg-bg-raised text-text-secondary'
                  }`}
                >
                  {isRtl
                    ? t('unitMinutesShort', { minutes: formatChromeNumber(mins, deps.edition) })
                    : `${mins}m`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <MzButton variant="ghost" size="sm" onClick={() => setTopicsModalOpen(false)}>
              {t('cancelAction')}
            </MzButton>
            <MzButton
              variant="primary"
              size="sm"
              isLoading={savingPrefs}
              onClick={() => void handleSaveTopicsAndPace()}
            >
              {t('saveAction')}
            </MzButton>
          </div>
        </div>
      </MzModal>

      <SpeechPracticeDrawer
        open={pronStep !== null}
        onClose={() => setPronStep(null)}
        targetText={contextualPracticeSentenceForStep(pronStep)}
        practiceKind="sentence"
        sourceRefType="coach"
        sourceRefId={pronStep?.stepId}
        examTrack={state?.profile.examTrack}
      />
    </div>
  );
}
