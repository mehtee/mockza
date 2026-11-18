import type { SupportedExamId } from '@mockza/domain';
import { Link, useNavigate } from '@tanstack/react-router';
import { CheckCircle2, ChevronLeft, ChevronRight, FastForward, Mic, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioStudioPlayer,
  ExamSvgChartCard,
  type KeyboardShortcutHint,
  SimulatorWorkspaceShell,
  SplitPaneWorkspace,
  WaveformMicRecorder,
} from '@/components/exam-kit';
import { MzBanner, MzButton, MzCard, MzSegmentedControl } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { RecordedClip } from '@/gateways/audio.gateway';
import type { ExamBundlePayload } from '@/gateways/catalog.gateway';
import type { QuotaStatusSnapshot } from '@/gateways/evaluation.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import { generateUuid } from '@/spa/objective-sim-helpers';
import { useClockStore } from '@/spa/stores/clock.store';

export interface SpeakingSimulatorScreenProps {
  readonly packId: string;
  readonly initialExamMode?: 'exam' | 'study';
  readonly mockSessionId?: string | null;
  readonly mockStageKey?: string | null;
  readonly onMockStageComplete?: (attemptId: string) => void;
}

type TurnPhase = 'prep' | 'recording' | 'recorded';

interface RecordedTurnEntry {
  readonly sectionId: string;
  readonly partIndex: number;
  readonly turnId: string;
  readonly promptText: string;
  readonly clip: RecordedClip;
  readonly mediaKey: string;
}

function resolveTurnTiming(
  section: ExamBundlePayload['sections'][number],
  examId: string,
): { readonly prepSeconds: number; readonly responseSeconds: number; readonly partIndex: number } {
  const partIndex = section.sectionIndex + 1;
  const metaPrep = section.metadata?.['prepSeconds'];
  const metaResp = section.metadata?.['responseSeconds'];

  let defaultPrep = 0;
  if (typeof metaPrep === 'number' && metaPrep >= 0) {
    defaultPrep = metaPrep;
  } else if ((examId === 'ielts_academic' || examId === 'ielts_general') && partIndex === 2) {
    defaultPrep = 60;
  }

  const responseSeconds =
    typeof metaResp === 'number' && metaResp > 0
      ? metaResp
      : section.durationSeconds > 0
        ? section.durationSeconds
        : 120;

  return { prepSeconds: defaultPrep, responseSeconds, partIndex };
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
  const [prepRemainingSec, setPrepRemainingSec] = useState(0);
  const [cueNotesBySectionId, setCueNotesBySectionId] = useState<Record<string, string>>({});
  const [recordedBySectionId, setRecordedBySectionId] = useState<
    Record<string, RecordedTurnEntry>
  >({});
  const [quota, setQuota] = useState<QuotaStatusSnapshot | null>(null);
  const [quotaBlocked, setQuotaBlocked] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  }, [deps.attemptStore, deps.catalog, deps.evaluation, packId]);

  useEffect(() => {
    if (!bundle) return;
    setActiveExamLock(examMode === 'exam', bundle.pack.title);
    return () => {
      setActiveExamLock(false);
    };
  }, [bundle, examMode, setActiveExamLock]);

  const sortedSections = useMemo(
    () =>
      bundle
        ? [...bundle.sections].sort((a, b) => a.sectionIndex - b.sectionIndex)
        : [],
    [bundle],
  );

  const activeSection = sortedSections[activeTurnIndex] ?? sortedSections[0] ?? null;
  const effectiveExamId = bundle?.pack.examId ?? profileExamId;
  const activeTiming = activeSection
    ? resolveTurnTiming(activeSection, effectiveExamId)
    : { prepSeconds: 0, responseSeconds: 120, partIndex: 1 };

  // Recompute initial phase cleanly whenever active turn changes
  useEffect(() => {
    if (!activeSection) return;
    const existing = recordedBySectionId[activeSection.sectionId];
    if (existing) {
      setPhase('recorded');
      setPrepRemainingSec(0);
      return;
    }
    if (activeTiming.prepSeconds > 0) {
      setPhase('prep');
      setPrepRemainingSec(activeTiming.prepSeconds);
    } else {
      setPhase('recording');
      setPrepRemainingSec(0);
    }
  }, [activeSection, activeTiming.prepSeconds, recordedBySectionId]);

  // Prep countdown timer (auto-transitions to recording at 0)
  useEffect(() => {
    if (!bundle || phase !== 'prep' || isPaused) return;
    const timer = window.setInterval(() => {
      setPrepRemainingSec((prev) => {
        if (prev <= 1) {
          setPhase('recording');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [bundle, isPaused, phase]);

  const handleSkipPrep = useCallback(() => {
    setPrepRemainingSec(0);
    setPhase('recording');
  }, []);

  const handleRecordingComplete = useCallback(
    async (clip: RecordedClip) => {
      if (!activeSection) return;
      const mediaKey = `rec-${attemptIdRef.current}-p${activeTiming.partIndex}`;
      await deps.catalog.putUserRecording({
        clipId: mediaKey,
        blob: clip.blob,
        attemptId: attemptIdRef.current,
        partIndex: activeTiming.partIndex,
        durationMs: clip.durationMs,
        mimeType: clip.strippedContentType,
      });

      const entry: RecordedTurnEntry = {
        sectionId: activeSection.sectionId,
        partIndex: activeTiming.partIndex,
        turnId: activeSection.sectionId,
        promptText: activeSection.contentText || activeSection.title,
        clip,
        mediaKey,
      };
      setRecordedBySectionId((prev) => ({
        ...prev,
        [activeSection.sectionId]: entry,
      }));
      setPhase('recorded');
      setErrorMsg(null);
    },
    [activeSection, activeTiming.partIndex, deps.catalog],
  );

  const handleSubmit = useCallback(async () => {
    if (!bundle || isSubmitting) return;
    const turns = sortedSections
      .map((s) => recordedBySectionId[s.sectionId])
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

    const uploadedTurns: {
      readonly partIndex: number;
      readonly turnId: string;
      readonly promptText: string;
      readonly objectKey: string;
      readonly durationMs: number;
      readonly byteLength: number;
    }[] = [];

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

    const examId = effectiveExamId as SupportedExamId;
    const partSequence =
      turns.length === 1 && turns[0]
        ? (`part${Math.min(4, Math.max(1, turns[0].partIndex))}` as 'part1' | 'part2' | 'part3' | 'part4')
        : 'full';

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
    effectiveExamId,
    examMode,
    isSubmitting,
    mockSessionId,
    mockStageKey,
    navigate,
    onMockStageComplete,
    recordedBySectionId,
    sortedSections,
    t,
  ]);

  const audioSource = useMemo(
    () =>
      activeSection?.mediaUrl
        ? {
            mediaKey: `${packId}:${activeSection.sectionId}`,
            fallbackUrl: activeSection.mediaUrl,
          }
        : null,
    [activeSection?.mediaUrl, activeSection?.sectionId, packId],
  );

  const shortcuts: readonly KeyboardShortcutHint[] = useMemo(
    () => [{ keys: 'Prev / Next', description: 'Switch Speaking part turns' }],
    [],
  );

  if (!bundle) {
    return (
      <div data-testid="speaking-simulator-screen" className="p-6 text-sm text-text-secondary">
        {errorMsg ? <MzBanner tone="danger">{errorMsg}</MzBanner> : 'Loading Speaking Simulator...'}
      </div>
    );
  }

  const PrevIcon = deps.edition === 'irn' ? ChevronRight : ChevronLeft;
  const NextIcon = deps.edition === 'irn' ? ChevronLeft : ChevronRight;
  const remainingQuota = quota
    ? quota.isPro
      ? null
      : Math.max(0, quota.dailySpeakingLimit - quota.dailySpeakingUsed)
    : null;
  const recordedCount = sortedSections.filter((s) => Boolean(recordedBySectionId[s.sectionId])).length;
  const chartSvg =
    typeof activeSection?.metadata?.['chartSvg'] === 'string'
      ? (activeSection.metadata['chartSvg'] as string)
      : null;

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
                className="inline-flex h-8 items-center rounded-[var(--mz-radius-compact)] bg-primary px-3 text-xs font-semibold text-on-primary hover:bg-primary-strong"
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
        subtitle={activeSection?.title}
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
                <span>{`${remainingQuota}/${quota.dailySpeakingLimit}`}</span>
              </span>
            ) : null}

            <MzSegmentedControl<'exam' | 'study'>
              ariaLabel="Simulation Mode"
              value={examMode}
              onChange={setExamMode}
              options={[
                { value: 'exam', label: t('workspaceExamModeBadge') },
                { value: 'study', label: t('workspaceStudyModeBadge') },
              ]}
            />
          </div>
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Mic className="h-4 w-4 text-primary" aria-hidden="true" />
              <span data-testid="speaking-recorded-progress">
                {`${recordedCount} / ${sortedSections.length}`}
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
                <PrevIcon className="h-4 w-4" aria-hidden="true" />
                <span>{t('simPrevQuestionAction')}</span>
              </MzButton>
              <MzButton
                variant="secondary"
                size="sm"
                data-testid="speaking-next-turn-btn"
                disabled={activeTurnIndex >= sortedSections.length - 1}
                onClick={() =>
                  setActiveTurnIndex((idx) => Math.min(sortedSections.length - 1, idx + 1))
                }
              >
                <span>{t('simNextQuestionAction')}</span>
                <NextIcon className="h-4 w-4" aria-hidden="true" />
              </MzButton>
              <MzButton
                variant="primary"
                size="md"
                data-testid="speaking-submit-btn"
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
          leftLabel="Prompt & Cue Card"
          rightLabel="Microphone Studio"
          leftPane={
            <div className="flex flex-col gap-4">
              {sortedSections.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {sortedSections.map((section, idx) => {
                    const isDone = Boolean(recordedBySectionId[section.sectionId]);
                    return (
                      <button
                        key={section.sectionId}
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
                        <span>{t('speakingTurnTabLabel', { index: idx + 1 })}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <MzCard variant="default">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <LtrExamBoundary>
                    <h2 className="text-base font-bold text-text-primary">
                      {activeSection?.title}
                    </h2>
                  </LtrExamBoundary>
                  <span
                    data-testid="speaking-prep-mode-badge"
                    className="rounded-[var(--mz-radius-pill)] border border-border-subtle bg-bg-raised px-2.5 py-0.5 text-[11px] font-semibold text-primary"
                  >
                    {phase === 'prep'
                      ? t('speakingPrepPhaseBadge', { sec: prepRemainingSec })
                      : activeTiming.prepSeconds === 0
                        ? t('speakingZeroPrepReadyBadge')
                        : `${activeTiming.responseSeconds}s`}
                  </span>
                </div>

                {activeSection?.instructions ? (
                  <div className="mt-2 text-xs text-text-secondary">
                    <LtrExamBoundary>{activeSection.instructions}</LtrExamBoundary>
                  </div>
                ) : null}

                {activeSection?.contentText ? (
                  <LtrExamBoundary>
                    <div className="mt-3 whitespace-pre-wrap rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-4 text-sm leading-relaxed text-text-primary">
                      {activeSection.contentText}
                    </div>
                  </LtrExamBoundary>
                ) : null}
              </MzCard>

              {chartSvg ? (
                <ExamSvgChartCard
                  svgMarkup={chartSvg}
                  altText={activeSection?.title ?? 'Speaking image stimulus'}
                />
              ) : null}

              {audioSource ? (
                <AudioStudioPlayer
                  source={audioSource}
                  playbackMode={examMode === 'exam' ? 'exam_linear_locked' : 'study_interactive'}
                />
              ) : null}

              {activeTiming.prepSeconds > 0 && activeSection ? (
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
                    value={cueNotesBySectionId[activeSection.sectionId] ?? ''}
                    placeholder={t('speakingCueNotesPlaceholder')}
                    onChange={(event) => {
                      const val = event.target.value;
                      setCueNotesBySectionId((prev) => ({
                        ...prev,
                        [activeSection.sectionId]: val,
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
                      {t('speakingPrepPhaseBadge', { sec: prepRemainingSec })}
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

              {activeSection ? (
                <WaveformMicRecorder
                  key={activeSection.sectionId}
                  maxDurationSec={activeTiming.responseSeconds}
                  disabled={phase === 'prep'}
                  allowPreviewPlayback={examMode === 'study'}
                  onRecordingComplete={(clip) => void handleRecordingComplete(clip)}
                />
              ) : null}

              {activeSection && recordedBySectionId[activeSection.sectionId] ? (
                <div data-testid="speaking-turn-recorded-banner">
                  <MzBanner tone="success">
                    {t('speakingTurnRecordedBadge', {
                      sec: Math.max(
                        1,
                        Math.round(recordedBySectionId[activeSection.sectionId]!.clip.durationMs / 1000),
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
