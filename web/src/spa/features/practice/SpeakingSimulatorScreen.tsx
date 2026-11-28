import type { SupportedExamId } from '@mockza/domain';
import { Link, useNavigate } from '@tanstack/react-router';
import { CheckCircle2, FastForward, Mic, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioStudioPlayer,
  ExamSvgChartCard,
  type KeyboardShortcutHint,
  SimulatorLoadFallback,
  SimulatorWorkspaceShell,
  SplitPaneWorkspace,
  WaveformMicRecorder,
} from '@/components/exam-kit';
import { MzBanner, MzButton, MzCard, MzSegmentedControl } from '@/components/ui';
import { BackChevronIcon, ForwardChevronIcon } from '@/components/bidi/DirectionIcon';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { formatChromeNumber } from '@/edition/bidi/numerals';
import type { RecordedClip } from '@/gateways/audio.gateway';
import type { ExamBundlePayload } from '@/gateways/catalog.gateway';
import type { QuotaStatusSnapshot } from '@/gateways/evaluation.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import { generateUuid } from '@/spa/objective-sim-helpers';
import { useClockStore } from '@/spa/stores/clock.store';
import { useCountdownClock } from '@/spa/useCountdownClock';

export interface SpeakingSimulatorScreenProps {
  readonly packId: string;
  readonly initialExamMode?: 'exam' | 'study';
  readonly mockSessionId?: string | null;
  readonly mockStageKey?: string | null;
  readonly onMockStageComplete?: (attemptId: string) => void;
}

type TurnPhase = 'prep' | 'recording' | 'recorded';

interface SpeakingTurnItem {
  readonly turnId: string;
  readonly sectionId: string;
  readonly partIndex: number;
  readonly turnNumberInPart: number;
  readonly sectionTitle: string;
  readonly instructions: string | null;
  readonly promptText: string;
  readonly prepSeconds: number;
  readonly responseSeconds: number;
  readonly mediaUrl: string | null;
  readonly chartSvg: string | null;
}

interface RecordedTurnEntry {
  readonly sectionId: string;
  readonly partIndex: number;
  readonly turnId: string;
  readonly promptText: string;
  readonly clip: RecordedClip;
  readonly mediaKey: string;
}

function buildSpeakingTurns(
  bundle: ExamBundlePayload | null,
  examId: string,
): readonly SpeakingTurnItem[] {
  if (!bundle) return [];
  const sortedSections = [...bundle.sections].sort((a, b) => a.sectionIndex - b.sectionIndex);
  const questionsBySection = new Map<string, ExamBundlePayload['questions'][number][]>();
  for (const q of bundle.questions) {
    const list = questionsBySection.get(q.sectionId) ?? [];
    list.push(q);
    questionsBySection.set(q.sectionId, list);
  }
  for (const list of questionsBySection.values()) {
    list.sort((a, b) => a.questionNumber - b.questionNumber);
  }

  const turns: SpeakingTurnItem[] = [];
  for (let sIdx = 0; sIdx < sortedSections.length; sIdx += 1) {
    const section = sortedSections[sIdx]!;
    // DB sectionIndex is 1-based (1, 2, 3); fall back to 1-based loop index if 0.
    const partIndex = section.sectionIndex > 0 ? section.sectionIndex : sIdx + 1;
    const meta = section.metadata ?? {};
    const zeroPrep = meta['zeroPrep'] === true;
    const metaPrep =
      typeof meta['prepDurationSeconds'] === 'number'
        ? meta['prepDurationSeconds']
        : typeof meta['prepSeconds'] === 'number'
          ? meta['prepSeconds']
          : null;
    const isIelts = examId === 'ielts_academic' || examId === 'ielts_general';
    const prepSeconds = zeroPrep
      ? 0
      : metaPrep !== null && metaPrep >= 0
        ? metaPrep
        : isIelts && partIndex === 2
          ? 60
          : 0;

    const metaSpeak =
      typeof meta['speakDurationSeconds'] === 'number'
        ? meta['speakDurationSeconds']
        : typeof meta['responseSeconds'] === 'number'
          ? meta['responseSeconds']
          : typeof meta['speakSeconds'] === 'number'
            ? meta['speakSeconds']
            : null;
    const sectionSpeakSeconds =
      metaSpeak !== null && metaSpeak > 0
        ? metaSpeak
        : section.durationSeconds > 0
          ? section.durationSeconds
          : partIndex === 2
            ? 120
            : 60;

    const chartSvg = typeof meta['chartSvg'] === 'string' ? (meta['chartSvg'] as string) : null;
    const secQuestions = questionsBySection.get(section.sectionId) ?? [];

    if (secQuestions.length > 0) {
      const perQuestionSpeakSeconds =
        partIndex === 2
          ? sectionSpeakSeconds
          : Math.min(90, Math.max(30, Math.round(sectionSpeakSeconds / secQuestions.length)));
      for (let qIdx = 0; qIdx < secQuestions.length; qIdx += 1) {
        const q = secQuestions[qIdx]!;
        const promptText =
          (q.prompt && q.prompt.trim().length > 0
            ? q.prompt
            : section.contentText && section.contentText.trim().length > 0
              ? section.contentText
              : section.title) ?? '';
        turns.push({
          turnId: q.questionId,
          sectionId: section.sectionId,
          partIndex,
          turnNumberInPart: qIdx + 1,
          sectionTitle: section.title,
          instructions: section.instructions ?? null,
          promptText,
          prepSeconds,
          responseSeconds: perQuestionSpeakSeconds,
          mediaUrl: section.mediaUrl ?? null,
          chartSvg,
        });
      }
    } else {
      turns.push({
        turnId: section.sectionId,
        sectionId: section.sectionId,
        partIndex,
        turnNumberInPart: 1,
        sectionTitle: section.title,
        instructions: section.instructions ?? null,
        promptText: section.contentText || section.title,
        prepSeconds,
        responseSeconds: sectionSpeakSeconds,
        mediaUrl: section.mediaUrl ?? null,
        chartSvg,
      });
    }
  }
  return turns;
}

export function SpeakingSimulatorScreen({
  packId,
  initialExamMode = 'exam',
  mockSessionId = null,
  mockStageKey = null,
  onMockStageComplete,
}: SpeakingSimulatorScreenProps) {
  const deps = useDeps();
  const t = createTranslator(deps.edition);
  const navigate = useNavigate();
  const setActiveExamLock = useClockStore((s) => s.setActiveExamLock);

  const attemptIdRef = useRef(generateUuid());
  const startedAtRef = useRef(deps.clock.nowMs());

  const [bundle, setBundle] = useState<ExamBundlePayload | null>(null);
  const [profileExamId, setProfileExamId] = useState('ielts_academic');
  const [examMode, setExamMode] = useState<'exam' | 'study'>(initialExamMode);
  const [isPaused, setIsPaused] = useState(false);
  const [activeTurnIndex, setActiveTurnIndex] = useState(0);
  const [phase, setPhase] = useState<TurnPhase>('recording');
  const [autoStartSeq, setAutoStartSeq] = useState(0);
  const [cueNotesBySectionId, setCueNotesBySectionId] = useState<Record<string, string>>({});

  const { remainingSeconds: prepRemainingSec, resetClock: resetPrepClock } = useCountdownClock({
    enabled: Boolean(bundle) && phase === 'prep',
    isPaused,
    initialSeconds: 0,
    onExpire: () => {
      setPhase('recording');
      setAutoStartSeq((s) => s + 1);
    },
  });
  const [recordedByTurnId, setRecordedByTurnId] = useState<
    Record<string, RecordedTurnEntry>
  >({});
  const everUsedStudyModeRef = useRef(initialExamMode === 'study');
  const [quota, setQuota] = useState<QuotaStatusSnapshot | null>(null);
  const [quotaBlocked, setQuotaBlocked] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reloadSeq, setReloadSeq] = useState(0);
  const retryLoad = useCallback(() => {
    setErrorMsg(null);
    setReloadSeq((s) => s + 1);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      const [bundleRes, profileRes, quotaRes] = await Promise.all([
        deps.catalog.ensureExamBundle(packId),
        deps.attemptStore.getUserProfile(),
        deps.evaluation.getQuotaStatus(),
      ]);
      if (!mounted) return;
      if (!bundleRes.ok) {
        setErrorMsg(bundleRes.error.message);
        return;
      }
      setBundle(bundleRes.value);
      if (profileRes.ok && profileRes.value?.examId) {
        setProfileExamId(profileRes.value.examId);
      }
      if (quotaRes.ok) {
        setQuota(quotaRes.value);
      }
    }
    void hydrate();
    return () => {
      mounted = false;
    };
  }, [deps.attemptStore, deps.catalog, deps.evaluation, packId, reloadSeq]);

  useEffect(() => {
    if (!bundle) return;
    setActiveExamLock(examMode === 'exam', bundle.pack.title);
    return () => {
      setActiveExamLock(false);
    };
  }, [bundle, examMode, setActiveExamLock]);

  const effectiveExamId = bundle?.pack.examId ?? profileExamId;
  const speakingTurns = useMemo(
    () => buildSpeakingTurns(bundle, effectiveExamId),
    [bundle, effectiveExamId],
  );

  const activeTurn = speakingTurns[activeTurnIndex] ?? speakingTurns[0] ?? null;
  const activeTiming = activeTurn
    ? {
        prepSeconds: activeTurn.prepSeconds,
        responseSeconds: activeTurn.responseSeconds,
        partIndex: activeTurn.partIndex,
      }
    : { prepSeconds: 0, responseSeconds: 60, partIndex: 1 };

  // Recompute initial phase cleanly whenever active turn changes
  useEffect(() => {
    if (!activeTurn) return;
    const existing = recordedByTurnId[activeTurn.turnId];
    if (existing) {
      setPhase('recorded');
      resetPrepClock(0, 0);
      return;
    }
    if (activeTiming.prepSeconds > 0) {
      setPhase('prep');
      resetPrepClock(activeTiming.prepSeconds, activeTiming.prepSeconds);
    } else {
      setPhase('recording');
      resetPrepClock(0, 0);
    }
  }, [activeTurn, activeTiming.prepSeconds, recordedByTurnId, resetPrepClock]);

  const handleSkipPrep = useCallback(() => {
    resetPrepClock(0, 0);
    setPhase('recording');
  }, [resetPrepClock]);

  const handleRecordingComplete = useCallback(
    async (clip: RecordedClip) => {
      if (!activeTurn) return;
      const mediaKey = `rec-${attemptIdRef.current}-p${activeTurn.partIndex}-t${activeTurnIndex + 1}`;
      await deps.catalog.putUserRecording({
        clipId: mediaKey,
        blob: clip.blob,
        attemptId: attemptIdRef.current,
        partIndex: activeTurn.partIndex,
        durationMs: clip.durationMs,
        mimeType: clip.strippedContentType,
      });

      const entry: RecordedTurnEntry = {
        sectionId: activeTurn.sectionId,
        partIndex: activeTurn.partIndex,
        turnId: activeTurn.turnId,
        promptText: activeTurn.promptText,
        clip,
        mediaKey,
      };
      setRecordedByTurnId((prev) => ({
        ...prev,
        [activeTurn.turnId]: entry,
      }));
      setPhase('recorded');
      setErrorMsg(null);
    },
    [activeTurn, activeTurnIndex, deps.catalog],
  );

  const handleSubmit = useCallback(async () => {
    if (!bundle || isSubmitting) return;
    const turns = speakingTurns
      .map((turn) => recordedByTurnId[turn.turnId])
      .filter((entry): entry is RecordedTurnEntry => entry !== undefined);

    if (turns.length === 0) {
      setErrorMsg(t('speakingRecordAtLeastOneWarning'));
      return;
    }

    const latestQuota = await deps.evaluation.getQuotaStatus();
    if (latestQuota.ok) {
      setQuota(latestQuota.value);
      if (
        !latestQuota.value.isPro &&
        latestQuota.value.dailySpeakingUsed >= latestQuota.value.dailySpeakingLimit
      ) {
        setQuotaBlocked(true);
        setErrorMsg(t('speakingQuotaExhaustedError'));
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const examId = effectiveExamId as SupportedExamId;
    const partSequence =
      turns.length === 1 && turns[0]
        ? (`part${Math.min(4, Math.max(1, turns[0].partIndex))}` as 'part1' | 'part2' | 'part3' | 'part4')
        : 'full';

    const uploadedTurns: {
      readonly partIndex: number;
      readonly turnId: string;
      readonly promptText: string;
      readonly objectKey: string;
      readonly durationMs: number;
      readonly byteLength: number;
    }[] = [];

    const enqueueOfflineSpeaking = async () => {
      const nowMs = deps.clock.nowMs();
      const durationSeconds = Math.max(1, Math.round((nowMs - startedAtRef.current) / 1000));
      const outboxTurns = turns.map((turn) => {
        const uploaded = uploadedTurns.find((u) => u.partIndex === turn.partIndex);
        return {
          partIndex: turn.partIndex,
          turnId: turn.turnId,
          promptText: turn.promptText,
          mediaKey: turn.mediaKey,
          durationMs: turn.clip.durationMs,
          byteLength: turn.clip.byteLength,
          contentType: turn.clip.strippedContentType,
          ...(uploaded ? { objectKey: uploaded.objectKey } : {}),
        };
      });
      await deps.attemptStore.completeObjectiveAttempt({
        attemptId: attemptIdRef.current,
        examId,
        packId: bundle.pack.packId,
        skill: 'speaking',
        status: 'submitted_local',
        syncStatus: 'pending',
        remoteJobId: null,
        submissionJson: JSON.stringify({ turns: outboxTurns }),
        evaluationJson: null,
        overallBand: null,
        errorCode: null,
        startedAtUtcMs: startedAtRef.current,
        completedAtMs: nowMs,
        durationSeconds,
        usedStudyMode: examMode === 'study' || everUsedStudyModeRef.current,
        questionCount: turns.length,
        isCalibratedFullPack: turns.length >= 2,
        contentVersion: bundle.pack.version,
        mockSessionId,
        mockStageKey,
        updatedAtMs: nowMs,
      });
      await deps.syncOutbox.enqueue({
        idempotencyKey: `eval-speaking-${attemptIdRef.current}`,
        actionType: 'evaluate_speaking',
        entityKind: 'attempt',
        payloadJson: JSON.stringify({
          attemptId: attemptIdRef.current,
          packId: bundle.pack.packId,
          examId,
          edition: deps.edition,
          partSequence,
          turns: outboxTurns,
        }),
      });
      await deps.attemptStore.incrementDailyStudyLog({
        serialDay: deps.clock.todaySerialDay(),
        addSeconds: durationSeconds,
        addCompletedItems: 1,
      });
      setUploadProgressText(null);
      setIsSubmitting(false);
      setActiveExamLock(false);
      if (onMockStageComplete) {
        onMockStageComplete(attemptIdRef.current);
        return;
      }
      await navigate({ to: '/progress' });
    };

    for (let i = 0; i < turns.length; i += 1) {
      const turn = turns[i]!;
      setUploadProgressText(
        t('speakingUploadProgressLabel', { current: i + 1, total: turns.length }),
      );
      const upRes = await deps.evaluation.uploadSpeakingTurnAudio({
        attemptId: attemptIdRef.current,
        partIndex: turn.partIndex,
        turnId: turn.turnId,
        clip: turn.clip,
      });
      if (!upRes.ok) {
        if (upRes.error.kind === 'network') {
          await enqueueOfflineSpeaking();
          return;
        }
        setIsSubmitting(false);
        setUploadProgressText(null);
        setErrorMsg(upRes.error.message);
        return;
      }
      await deps.catalog.updateRecordingRemoteKey(turn.mediaKey, upRes.value.objectKey);
      uploadedTurns.push({
        partIndex: turn.partIndex,
        turnId: turn.turnId,
        promptText: turn.promptText,
        objectKey: upRes.value.objectKey,
        durationMs: turn.clip.durationMs,
        byteLength: turn.clip.byteLength,
      });
    }

    const evalRes = await deps.evaluation.submitSpeakingEvaluation({
      attemptId: attemptIdRef.current,
      packId: bundle.pack.packId,
      examId,
      edition: deps.edition,
      partSequence,
      turns: uploadedTurns,
    });

    setUploadProgressText(null);

    if (!evalRes.ok) {
      if (evalRes.error.kind === 'network') {
        await enqueueOfflineSpeaking();
        return;
      }
      setIsSubmitting(false);
      if (evalRes.error.kind === 'quota_exceeded' || evalRes.error.kind === 'entitlement_required') {
        setQuotaBlocked(true);
        setErrorMsg(t('speakingQuotaExhaustedError'));
      } else {
        setErrorMsg(evalRes.error.message);
      }
      return;
    }

    const nowMs = deps.clock.nowMs();
    const durationSeconds = Math.max(1, Math.round((nowMs - startedAtRef.current) / 1000));

    await deps.attemptStore.completeObjectiveAttempt({
      attemptId: attemptIdRef.current,
      examId,
      packId: bundle.pack.packId,
      skill: 'speaking',
      status: 'queued_remote',
      syncStatus: 'pending',
      remoteJobId: evalRes.value.jobId,
      submissionJson: JSON.stringify({
        turns: uploadedTurns,
      }),
      evaluationJson: null,
      overallBand: null,
      errorCode: null,
      startedAtUtcMs: startedAtRef.current,
      completedAtMs: nowMs,
      durationSeconds,
      usedStudyMode: examMode === 'study',
      questionCount: turns.length,
      isCalibratedFullPack: turns.length >= 2,
      contentVersion: bundle.pack.version,
      mockSessionId,
      mockStageKey,
      updatedAtMs: nowMs,
    });
    await deps.attemptStore.incrementDailyStudyLog({
      serialDay: deps.clock.todaySerialDay(),
      addSeconds: durationSeconds,
      addCompletedItems: 1,
    });

    setIsSubmitting(false);
    setActiveExamLock(false);

    if (onMockStageComplete) {
      onMockStageComplete(attemptIdRef.current);
      return;
    }

    await navigate({
      to: '/evaluation/pending/$jobId',
      params: { jobId: evalRes.value.jobId },
    });
  }, [
    bundle,
    deps.attemptStore,
    deps.catalog,
    deps.clock,
    deps.edition,
    deps.evaluation,
    deps.syncOutbox,
    effectiveExamId,
    examMode,
    isSubmitting,
    mockSessionId,
    mockStageKey,
    navigate,
    onMockStageComplete,
    recordedByTurnId,
    speakingTurns,
    t,
  ]);

  const audioSource = useMemo(
    () =>
      activeTurn?.mediaUrl
        ? {
            mediaKey: `${packId}:${activeTurn.sectionId}`,
            fallbackUrl: activeTurn.mediaUrl,
          }
        : null,
    [activeTurn?.mediaUrl, activeTurn?.sectionId, packId],
  );

  const shortcuts: readonly KeyboardShortcutHint[] = useMemo(
    () => [{ keys: 'Prev / Next', description: t('speakingSwitchTurnShortcut') }],
    [t],
  );

  if (!bundle) {
    return (
      <div data-testid="speaking-simulator-screen" className="p-4 sm:p-6 text-sm text-text-secondary">
        {errorMsg ? (
          <SimulatorLoadFallback
            testId="speaking-load-fallback"
            onRetry={retryLoad}
            message={errorMsg}
          />
        ) : (
          t('workspaceLoadingLabel')
        )}
      </div>
    );
  }

  const remainingQuota = quota
    ? quota.isPro
      ? null
      : Math.max(0, quota.dailySpeakingLimit - quota.dailySpeakingUsed)
    : null;
  const recordedCount = speakingTurns.filter((turn) => Boolean(recordedByTurnId[turn.turnId])).length;
  const chartSvg = activeTurn?.chartSvg ?? null;
  const canToggleMode = !mockSessionId && recordedCount === 0 && !everUsedStudyModeRef.current;

  return (
    <div data-testid="speaking-simulator-screen" className="flex flex-col gap-3">
      {errorMsg ? (
        <MzBanner
          tone="warning"
          actions={
            quotaBlocked ? (
              <Link
                to="/paywall"
                data-testid="speaking-upgrade-cta"
                className="inline-flex min-h-10 items-center rounded-[var(--mz-radius-compact)] bg-primary px-3.5 text-xs font-semibold text-on-primary hover:bg-primary-pressed"
              >
                {t('writingUpgradeCta')}
              </Link>
            ) : undefined
          }
        >
          {errorMsg}
        </MzBanner>
      ) : null}

      <SimulatorWorkspaceShell
        breadcrumb={bundle.pack.title}
        subtitle={activeTurn?.sectionTitle}
        remainingSeconds={phase === 'prep' ? prepRemainingSec : activeTiming.responseSeconds}
        timerPhase={phase === 'prep' ? 'prep' : 'response'}
        examMode={examMode}
        isPaused={isPaused}
        onTogglePause={() => setIsPaused((p) => !p)}
        onRequestExit={() => void navigate({ to: '/home' })}
        shortcuts={shortcuts}
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            {remainingQuota !== null && quota ? (
              <span
                data-testid="speaking-quota-badge"
                className="inline-flex items-center gap-1 rounded-[var(--mz-radius-pill)] border border-border-subtle bg-bg-raised px-2.5 py-1 text-[11px] font-semibold text-text-secondary"
              >
                <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" />
                <bdi dir="ltr">
                  {`${formatChromeNumber(remainingQuota, deps.edition)}/${formatChromeNumber(quota.dailySpeakingLimit, deps.edition)}`}
                </bdi>
              </span>
            ) : null}

            {canToggleMode ? (
              <MzSegmentedControl<'exam' | 'study'>
                ariaLabel={t('navPractice')}
                value={examMode}
                onChange={(nextMode) => {
                  if (nextMode === 'study') {
                    everUsedStudyModeRef.current = true;
                  }
                  setExamMode(nextMode);
                }}
                options={[
                  { value: 'exam', label: t('workspaceExamModeBadge') },
                  { value: 'study', label: t('workspaceStudyModeBadge') },
                ]}
              />
            ) : null}
          </div>
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Mic className="h-4 w-4 text-primary" aria-hidden="true" />
              <span data-testid="speaking-recorded-progress">
                <bdi dir="ltr">
                  {`${formatChromeNumber(recordedCount, deps.edition)} / ${formatChromeNumber(speakingTurns.length, deps.edition)}`}
                </bdi>
              </span>
              {uploadProgressText ? (
                <span data-testid="speaking-upload-progress" className="font-semibold text-primary">
                  {uploadProgressText}
                </span>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <MzButton
                variant="secondary"
                size="sm"
                data-testid="speaking-prev-turn-btn"
                disabled={activeTurnIndex <= 0}
                onClick={() => setActiveTurnIndex((idx) => Math.max(0, idx - 1))}
              >
                <BackChevronIcon edition={deps.edition} className="h-4 w-4" />
                <span>{t('simPrevQuestionAction')}</span>
              </MzButton>
              <MzButton
                variant="secondary"
                size="sm"
                data-testid="speaking-next-turn-btn"
                disabled={activeTurnIndex >= speakingTurns.length - 1}
                onClick={() =>
                  setActiveTurnIndex((idx) => Math.min(speakingTurns.length - 1, idx + 1))
                }
              >
                <span>{t('simNextQuestionAction')}</span>
                <ForwardChevronIcon edition={deps.edition} className="h-4 w-4" />
              </MzButton>
              <MzButton
                variant={recordedCount > 0 ? 'primary' : 'secondary'}
                size="md"
                data-testid="speaking-submit-btn"
                disabled={recordedCount === 0 || isSubmitting}
                isLoading={isSubmitting}
                onClick={() => void handleSubmit()}
              >
                {t('speakingSubmitEvaluationAction')}
              </MzButton>
            </div>
          </div>
        }
      >
        <SplitPaneWorkspace
          viewKey="simulator:speaking"
          initialRatio={0.46}
          leftLabel={t('splitTabLeftCue')}
          rightLabel={t('splitTabRightMic')}
          leftPane={
            <div className="flex flex-col gap-4">
              {speakingTurns.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {speakingTurns.map((turn, idx) => {
                    const isDone = Boolean(recordedByTurnId[turn.turnId]);
                    return (
                      <button
                        key={turn.turnId}
                        type="button"
                        data-testid={`speaking-turn-tab-${idx}`}
                        onClick={() => setActiveTurnIndex(idx)}
                        className={[
                          'inline-flex items-center gap-1.5 rounded-[var(--mz-radius-pill)] border px-3 py-1 text-xs font-semibold transition-colors',
                          idx === activeTurnIndex
                            ? 'border-primary bg-primary text-on-primary'
                            : 'border-border-subtle bg-bg-raised text-text-secondary hover:bg-surface-hover',
                        ].join(' ')}
                      >
                        {isDone ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                        <bdi dir="ltr">{`P${turn.partIndex}.${turn.turnNumberInPart}`}</bdi>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <MzCard variant="default">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <LtrExamBoundary>
                    <h2 className="text-base font-bold text-text-primary">
                      {activeTurn?.sectionTitle}
                    </h2>
                  </LtrExamBoundary>
                  <span
                    data-testid="speaking-prep-mode-badge"
                    className="rounded-[var(--mz-radius-pill)] border border-border-subtle bg-bg-raised px-2.5 py-0.5 text-[11px] font-semibold text-primary"
                  >
                    {phase === 'prep'
                      ? t('speakingPrepPhaseBadge', {
                          sec: formatChromeNumber(prepRemainingSec, deps.edition),
                        })
                      : activeTiming.prepSeconds === 0
                        ? t('speakingZeroPrepReadyBadge')
                        : t('unitSecondsShort', {
                            seconds: formatChromeNumber(activeTiming.responseSeconds, deps.edition),
                          })}
                  </span>
                </div>

                {activeTurn?.instructions ? (
                  <div className="mt-2 text-xs text-text-secondary">
                    <LtrExamBoundary>{activeTurn.instructions}</LtrExamBoundary>
                  </div>
                ) : null}

                {activeTurn?.promptText ? (
                  <LtrExamBoundary>
                    <div
                      data-testid="speaking-turn-prompt"
                      className="mt-3 whitespace-pre-wrap rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-4 text-sm leading-relaxed text-text-primary"
                    >
                      {activeTurn.promptText}
                    </div>
                  </LtrExamBoundary>
                ) : null}
              </MzCard>

              {chartSvg ? (
                <ExamSvgChartCard
                  svgMarkup={chartSvg}
                  altText={activeTurn?.sectionTitle ?? 'Speaking image stimulus'}
                />
              ) : null}

              {audioSource ? (
                <AudioStudioPlayer
                  source={audioSource}
                  playbackMode={examMode === 'exam' ? 'exam_linear_locked' : 'study_interactive'}
                />
              ) : null}

              {activeTiming.prepSeconds > 0 && activeTurn ? (
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="speaking-cue-notes"
                    className="text-xs font-semibold text-text-secondary"
                  >
                    {t('speakingCueNotesLabel')}
                  </label>
                  <textarea
                    id="speaking-cue-notes"
                    data-testid="speaking-cue-notes"
                    rows={3}
                    value={cueNotesBySectionId[activeTurn.sectionId] ?? ''}
                    placeholder={t('speakingCueNotesPlaceholder')}
                    onChange={(event) => {
                      const val = event.target.value;
                      setCueNotesBySectionId((prev) => ({
                        ...prev,
                        [activeTurn.sectionId]: val,
                      }));
                    }}
                    className="w-full rounded-[var(--mz-radius-control)] border border-border-subtle bg-bg-raised p-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none"
                  />
                </div>
              ) : null}
            </div>
          }
          rightPane={
            <div className="flex flex-col gap-4">
              {phase === 'prep' ? (
                <MzCard variant="alt" data-testid="speaking-prep-stage">
                  <div className="flex flex-col items-start gap-3">
                    <p className="text-sm font-semibold text-text-primary">
                      {t('speakingPrepPhaseBadge', {
                        sec: formatChromeNumber(prepRemainingSec, deps.edition),
                      })}
                    </p>
                    <MzButton
                      variant="primary"
                      size="md"
                      data-testid="skip-prep-start-recording-btn"
                      leadingIcon={<FastForward className="h-4 w-4" aria-hidden="true" />}
                      onClick={handleSkipPrep}
                    >
                      {t('speakingSkipPrepAction')}
                    </MzButton>
                  </div>
                </MzCard>
              ) : (
                <MzCard variant="alt" data-testid="speaking-immediate-stage">
                  <p className="text-xs font-semibold text-primary">
                    {activeTiming.prepSeconds === 0
                      ? t('speakingStartImmediateAction')
                      : t('recorderReadyStatus')}
                  </p>
                </MzCard>
              )}

              {activeTurn ? (
                <WaveformMicRecorder
                  key={activeTurn.turnId}
                  maxDurationSec={activeTiming.responseSeconds}
                  disabled={phase === 'prep'}
                  allowPreviewPlayback={examMode === 'study'}
                  autoStartSignal={autoStartSeq}
                  onRecordingComplete={(clip) => void handleRecordingComplete(clip)}
                />
              ) : null}

              {activeTurn && recordedByTurnId[activeTurn.turnId] ? (
                <div data-testid="speaking-turn-recorded-banner">
                  <MzBanner tone="success">
                    {t('speakingTurnRecordedBadge', {
                      sec: formatChromeNumber(
                        Math.max(
                          1,
                          Math.round(recordedByTurnId[activeTurn.turnId]!.clip.durationMs / 1000),
                        ),
                        deps.edition,
                      ),
                    })}
                  </MzBanner>
                </div>
              ) : null}
            </div>
          }
        />
      </SimulatorWorkspaceShell>
    </div>
  );
}
