import {
  EXAM_DESCRIPTORS,
  EXAM_TRACK_SPECS,
  formatExamScoreWithUnit,
  normalizeSupportedExamId,
  type SkillKind,
  type SupportedExamId,
} from '@mockza/domain';
import { Link } from '@tanstack/react-router';
import { CheckCircle2, Coffee, Play, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CompactPreflightHeader, formatMmSs } from '@/components/exam-kit';
import { MzButton, MzCard, MzSegmentedControl } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { CompletedAttemptRecord, MockSessionRecord } from '@/gateways/storage.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import { useCountdownClock } from '@/spa/useCountdownClock';
import { ListeningSimulatorScreen } from './ListeningSimulatorScreen';
import { ReadingSimulatorScreen } from './ReadingSimulatorScreen';
import { SpeakingSimulatorScreen } from './SpeakingSimulatorScreen';
import { WritingSimulatorScreen } from './WritingSimulatorScreen';

export interface FullMockOrchestratorScreenProps {
  readonly mockId?: string;
}

interface MockStageSpec {
  readonly stageKey: string;
  readonly skill: Exclude<SkillKind, 'vocabulary'>;
  readonly title: string;
  readonly packId: string;
}

const STAGE_ORDER_BY_TRACK: Record<SupportedExamId, readonly Exclude<SkillKind, 'vocabulary'>[]> = {
  ielts_academic: ['listening', 'reading', 'writing', 'speaking'],
  ielts_general: ['listening', 'reading', 'writing', 'speaking'],
  toefl_ibt: ['reading', 'listening', 'writing', 'speaking'],
  pte_academic: ['speaking', 'writing', 'reading', 'listening'],
  det: ['reading', 'listening', 'writing', 'speaking'],
};

function resolveStageOrderForTrack(track: SupportedExamId): readonly MockStageSpec[] {
  const desc = EXAM_DESCRIPTORS[track];
  const bySkill: Record<Exclude<SkillKind, 'vocabulary'>, MockStageSpec> = {
    listening: {
      stageKey: 'listening',
      skill: 'listening',
      title: 'Listening Section',
      packId: desc.listeningPackId,
    },
    reading: {
      stageKey: 'reading',
      skill: 'reading',
      title: 'Reading Section',
      packId: desc.readingPackId,
    },
    writing: {
      stageKey: 'writing',
      skill: 'writing',
      title: 'Writing Section',
      packId: desc.writingPackId,
    },
    speaking: {
      stageKey: 'speaking',
      skill: 'speaking',
      title: 'Speaking Section',
      packId: desc.speakingPackId,
    },
  };

  return STAGE_ORDER_BY_TRACK[track].map((skill) => bySkill[skill]);
}

export function FullMockOrchestratorScreen({
  mockId = 'full-mock-default',
}: FullMockOrchestratorScreenProps) {
  const deps = useDeps();
  const t = createTranslator(deps.edition);

  const [session, setSession] = useState<MockSessionRecord | null>(null);
  const [stageAttempts, setStageAttempts] = useState<Record<string, CompletedAttemptRecord>>({});
  const [examMode, setExamMode] = useState<'exam' | 'study'>('exam');
  const [activeStageKey, setActiveStageKey] = useState<string | null>(null);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const { remainingSeconds: breakRemainingSec, resetClock: resetBreakClock } = useCountdownClock({
    enabled: isOnBreak,
    isPaused: false,
    initialSeconds: 300,
  });

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      const [existingRes, profileRes] = await Promise.all([
        deps.attemptStore.getMockSession(mockId),
        deps.attemptStore.getUserProfile(),
      ]);
      if (!mounted) return;

      if (existingRes.ok && existingRes.value) {
        setSession(existingRes.value);
        setExamMode(existingRes.value.examMode);
        return;
      }

      const lower = mockId.toLowerCase();
      const inferredTrack: SupportedExamId = lower.includes('toefl')
        ? 'toefl_ibt'
        : lower.includes('pte')
          ? 'pte_academic'
          : lower.includes('det')
            ? 'det'
            : lower.includes('gt') || lower.includes('general')
              ? 'ielts_general'
              : normalizeSupportedExamId(profileRes.ok && profileRes.value ? profileRes.value.examId : 'ielts_academic');

      const nowMs = deps.clock.nowMs();
      const fresh: MockSessionRecord = {
        mockId,
        track: inferredTrack,
        startedAtUtcMs: nowMs,
        examMode: 'exam',
        stageAttemptIds: {},
        updatedAtMs: nowMs,
      };
      await deps.attemptStore.saveMockSession(fresh);
      if (mounted) {
        setSession(fresh);
      }
    }
    void hydrate();
    return () => {
      mounted = false;
    };
  }, [deps.attemptStore, deps.clock, mockId]);

  useEffect(() => {
    if (!session) return;
    const entries = Object.entries(session.stageAttemptIds);
    if (entries.length === 0) {
      setStageAttempts({});
      return;
    }
    let mounted = true;
    void Promise.all(
      entries.map(async ([stageKey, attemptId]) => {
        const res = await deps.attemptStore.getAttemptById(attemptId);
        return res.ok && res.value ? ([stageKey, res.value] as const) : null;
      }),
    ).then((rows) => {
      if (!mounted) return;
      const map: Record<string, CompletedAttemptRecord> = {};
      for (const row of rows) {
        if (row) map[row[0]] = row[1];
      }
      setStageAttempts(map);
    });
    return () => {
      mounted = false;
    };
  }, [deps.attemptStore, session]);

  const stages = useMemo(
    () => resolveStageOrderForTrack(session?.track ?? 'ielts_academic'),
    [session?.track],
  );

  const nextPendingStage = useMemo(
    () => stages.find((s) => !session?.stageAttemptIds[s.stageKey]) ?? null,
    [session?.stageAttemptIds, stages],
  );

  const activeStage = useMemo(
    () => stages.find((s) => s.stageKey === activeStageKey) ?? null,
    [activeStageKey, stages],
  );

  const handleStageComplete = useCallback(
    async (stageKey: string, attemptId: string) => {
      if (!session) return;
      const nowMs = deps.clock.nowMs();
      const updated: MockSessionRecord = {
        ...session,
        examMode,
        stageAttemptIds: {
          ...session.stageAttemptIds,
          [stageKey]: attemptId,
        },
        updatedAtMs: nowMs,
      };
      await deps.attemptStore.saveMockSession(updated);
      setSession(updated);
      setActiveStageKey(null);

      const hasMore = stages.some((s) => !updated.stageAttemptIds[s.stageKey]);
      if (hasMore) {
        setIsOnBreak(true);
        resetBreakClock(300, 300);
      }
    },
    [deps.attemptStore, deps.clock, examMode, resetBreakClock, session, stages],
  );

  const handleResetMock = async () => {
    if (!session) return;
    const nowMs = deps.clock.nowMs();
    const reset: MockSessionRecord = {
      ...session,
      startedAtUtcMs: nowMs,
      stageAttemptIds: {},
      updatedAtMs: nowMs,
    };
    await deps.attemptStore.saveMockSession(reset);
    setSession(reset);
    setActiveStageKey(null);
    setIsOnBreak(false);
  };

  if (!session) {
    return (
      <div data-testid="full-mock-screen" className="p-6 text-sm text-text-secondary">
        Preparing Full Mock...
      </div>
    );
  }

  // Render active embedded simulator directly inside orchestrator!
  if (activeStage) {
    const commonProps = {
      packId: activeStage.packId,
      initialExamMode: examMode,
      mockSessionId: session.mockId,
      mockStageKey: activeStage.stageKey,
      onMockStageComplete: (attemptId: string) =>
        void handleStageComplete(activeStage.stageKey, attemptId),
    };
    if (activeStage.skill === 'reading') return <ReadingSimulatorScreen {...commonProps} />;
    if (activeStage.skill === 'listening') return <ListeningSimulatorScreen {...commonProps} />;
    if (activeStage.skill === 'writing') return <WritingSimulatorScreen {...commonProps} />;
    return <SpeakingSimulatorScreen {...commonProps} />;
  }

  // Inter-section Break Screen
  if (isOnBreak && nextPendingStage) {
    return (
      <div data-testid="full-mock-screen" className="mx-auto flex w-full max-w-6xl flex-col gap-5 py-8 text-start">
        <MzCard variant="hero" data-testid="full-mock-break-card">
          <div className="flex items-center gap-2 text-primary">
            <Coffee className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-wider">Mock Day Break</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-text-primary">{t('fullMockBreakTitle')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('fullMockBreakSubtitle')}</p>
          <LtrExamBoundary>
            <p
              data-testid="full-mock-break-timer"
              className="mt-4 font-mono-exam text-3xl font-bold text-primary tabular-nums"
            >
              {formatMmSs(breakRemainingSec)}
            </p>
          </LtrExamBoundary>
          <div className="mt-5 flex flex-wrap gap-3">
            <MzButton
              variant="primary"
              size="md"
              data-testid="full-mock-skip-break-btn"
              onClick={() => {
                setIsOnBreak(false);
                setActiveStageKey(nextPendingStage.stageKey);
              }}
            >
              {t('fullMockSkipBreakAction')}
            </MzButton>
          </div>
        </MzCard>
      </div>
    );
  }

  const allCompleted = !nextPendingStage;

  return (
    <div data-testid="full-mock-screen" className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-12 text-start">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-primary">
            {deps.edition === 'irn'
              ? t(
                  session.track === 'ielts_academic'
                    ? 'trackIeltsAcademic'
                    : session.track === 'ielts_general'
                      ? 'trackIeltsGeneral'
                      : session.track === 'toefl_ibt'
                        ? 'trackToeflIbt'
                        : session.track === 'pte_academic'
                          ? 'trackPteAcademic'
                          : 'trackDet',
                )
              : EXAM_TRACK_SPECS[session.track].displayName}
          </p>
          <h1 className="text-2xl font-bold text-text-primary">{t('fullMockOrchestratorTitle')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('fullMockSubtitle')}</p>
        </div>

        <MzSegmentedControl<'exam' | 'study'>
          ariaLabel="Mock Exam Mode"
          fullWidth
          value={examMode}
          onChange={setExamMode}
          options={[
            { value: 'exam', label: t('workspaceExamModeBadge') },
            { value: 'study', label: t('workspaceStudyModeBadge') },
          ]}
        />
      </div>

      <CompactPreflightHeader<'exam' | 'study'>
        title={EXAM_TRACK_SPECS[session.track].displayName}
        subtitle={t('fullMockSubtitle')}
        modeOptions={[
          { value: 'exam', label: t('workspaceExamModeBadge') },
          { value: 'study', label: t('workspaceStudyModeBadge') },
        ]}
        selectedMode={examMode}
        onModeChange={setExamMode}
        rulesSummary={[
          'Complete stages sequentially with optional 5-minute inter-section breaks.',
          'Audio playback is locked in Exam Simulation Mode.',
        ]}
      />

      {allCompleted ? (
        <MzCard variant="hero" data-testid="full-mock-completed-card">
          <h2 className="text-xl font-bold text-success">{t('fullMockCompletedTitle')}</h2>
          <p className="mt-1 text-xs font-semibold text-text-secondary">
            {t('fullMockScorecardTitle')}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {stages.map((st) => {
              const att = stageAttempts[st.stageKey];
              return (
                <div
                  key={st.stageKey}
                  data-testid={`full-mock-scorecard-${st.stageKey}`}
                  className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-3 py-2 text-xs"
                >
                  <LtrExamBoundary>
                    <p className="font-semibold text-text-secondary">{st.title}</p>
                    <p className="mt-0.5 font-mono-exam text-sm font-bold text-primary">
                      {att && att.overallBand !== null
                        ? formatExamScoreWithUnit(att.overallBand, session.track)
                        : deps.edition === 'irn'
                          ? 'در انتظار'
                          : 'Pending'}
                    </p>
                  </LtrExamBoundary>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/progress"
              className="inline-flex min-h-11 items-center rounded-[var(--mz-radius-control)] bg-primary px-4 text-xs font-semibold text-on-primary hover:bg-primary-pressed"
            >
              {t('navProgress')}
            </Link>
            <MzButton
              variant="secondary"
              size="md"
              data-testid="full-mock-reset-btn"
              leadingIcon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => void handleResetMock()}
            >
              {t('fullMockResetAction')}
            </MzButton>
          </div>
        </MzCard>
      ) : null}

      <div className="grid gap-3">
        {stages.map((stage, index) => {
          const attemptId = session.stageAttemptIds[stage.stageKey];
          const isDone = Boolean(attemptId);
          const isNext = nextPendingStage?.stageKey === stage.stageKey;
          return (
            <MzCard
              key={stage.stageKey}
              variant={isNext ? 'raised' : 'default'}
              data-testid={`full-mock-stage-${stage.stageKey}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={[
                      'inline-flex h-8 w-8 items-center justify-center rounded-full font-mono-exam text-xs font-bold',
                      isDone
                        ? 'bg-mint-bg text-success'
                        : isNext
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-alt text-text-secondary',
                    ].join(' ')}
                  >
                    {isDone ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : index + 1}
                  </span>
                  <LtrExamBoundary>
                    <p className="text-sm font-bold text-text-primary">{stage.title}</p>
                    <p className="font-mono-exam text-[11px] text-text-tertiary">
                      {stage.packId}
                    </p>
                  </LtrExamBoundary>
                </div>

                {isNext ? (
                  <MzButton
                    variant="primary"
                    size="md"
                    data-testid={`start-mock-stage-${stage.stageKey}`}
                    leadingIcon={<Play className="h-3.5 w-3.5" aria-hidden="true" />}
                    onClick={() => setActiveStageKey(stage.stageKey)}
                  >
                    {t('fullMockStartStageAction')}
                  </MzButton>
                ) : null}
              </div>
            </MzCard>
          );
        })}
      </div>
    </div>
  );
}
