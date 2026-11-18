import {
  EXAM_DESCRIPTORS,
  EXAM_TRACK_SPECS,
  normalizeSupportedExamId,
  type SkillKind,
  type SupportedExamId,
} from '@mockza/domain';
import { Link } from '@tanstack/react-router';
import { CheckCircle2, Coffee, Play, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatMmSs } from '@/components/exam-kit';
import { MzButton, MzCard, MzSegmentedControl } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { MockSessionRecord } from '@/gateways/storage.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
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

  if (track === 'pte_academic') {
    return [bySkill.speaking, bySkill.writing, bySkill.reading, bySkill.listening];
  }
  if (track === 'toefl_ibt' || track === 'det') {
    return [bySkill.reading, bySkill.listening, bySkill.writing, bySkill.speaking];
  }
  // IELTS Academic & General Training standard order: Listening -> Reading -> Writing -> Speaking
  return [bySkill.listening, bySkill.reading, bySkill.writing, bySkill.speaking];
}

export function FullMockOrchestratorScreen({
  mockId = 'full-mock-default',
}: FullMockOrchestratorScreenProps) {
  const deps = useDeps();
  const t = createTranslator(deps.edition);

  const [session, setSession] = useState<MockSessionRecord | null>(null);
  const [examMode, setExamMode] = useState<'exam' | 'study'>('exam');
  const [activeStageKey, setActiveStageKey] = useState<string | null>(null);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakRemainingSec, setBreakRemainingSec] = useState(300);

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
    if (!isOnBreak) return;
    const timer = window.setInterval(() => {
      setBreakRemainingSec((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOnBreak]);

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
        setBreakRemainingSec(300);
      }
    },
    [deps.attemptStore, deps.clock, examMode, session, stages],
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
      <div data-testid="full-mock-screen" className="mx-auto flex max-w-2xl flex-col gap-5 py-8 text-start">
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
    <div data-testid="full-mock-screen" className="mx-auto flex max-w-4xl flex-col gap-5 pb-12 text-start">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-primary">
            {EXAM_TRACK_SPECS[session.track].displayName}
          </p>
          <h1 className="text-2xl font-bold text-text-primary">{t('fullMockOrchestratorTitle')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('fullMockSubtitle')}</p>
        </div>

        <MzSegmentedControl<'exam' | 'study'>
          ariaLabel="Mock Exam Mode"
          value={examMode}
          onChange={setExamMode}
          options={[
            { value: 'exam', label: t('workspaceExamModeBadge') },
            { value: 'study', label: t('workspaceStudyModeBadge') },
          ]}
        />
      </div>

      {allCompleted ? (
        <MzCard variant="hero" data-testid="full-mock-completed-card">
          <h2 className="text-xl font-bold text-success">{t('fullMockCompletedTitle')}</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/progress"
              className="inline-flex h-9 items-center rounded-[var(--mz-radius-control)] bg-primary px-4 text-xs font-semibold text-on-primary hover:bg-primary-strong"
            >
              {t('navProgress')}
            </Link>
            <MzButton
              variant="secondary"
              size="sm"
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
                  <div>
                    <p className="text-sm font-bold text-text-primary">{stage.title}</p>
                    <p className="font-mono-exam text-[11px] text-text-tertiary">
                      Pack: {stage.packId}
                    </p>
                  </div>
                </div>

                {isNext ? (
                  <MzButton
                    variant="primary"
                    size="sm"
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
