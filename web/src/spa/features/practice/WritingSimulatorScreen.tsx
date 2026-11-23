import {
  getWritingTaskSpec,
  normalizeWritingTaskType,
  type SupportedExamId,
  type SupportedWritingTaskType,
} from '@mockza/domain';
import { Link, useNavigate } from '@tanstack/react-router';
import { CheckCircle2, FileText, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DistractionFreeEssayEditor,
  ExamSvgChartCard,
  type KeyboardShortcutHint,
  MzSequenceOrderControl,
  SimulatorLoadFallback,
  SimulatorWorkspaceShell,
  SplitPaneWorkspace,
  countEssayWords,
} from '@/components/exam-kit';
import { MzBanner, MzButton, MzCard, MzSegmentedControl } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { ExamBundlePayload } from '@/gateways/catalog.gateway';
import type { QuotaStatusSnapshot } from '@/gateways/evaluation.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import {
  generateUuid,
  registerSpaUrgentDraftListeners,
} from '@/spa/objective-sim-helpers';
import { useClockStore } from '@/spa/stores/clock.store';
import { useCountdownClock } from '@/spa/useCountdownClock';

export interface WritingSimulatorScreenProps {
  readonly packId: string;
  readonly initialExamMode?: 'exam' | 'study';
  readonly mockSessionId?: string | null;
  readonly mockStageKey?: string | null;
  readonly onMockStageComplete?: (attemptId: string) => void;
}

function resolveSectionWritingTaskType(
  section: ExamBundlePayload['sections'][number] | null,
  examId: string,
): SupportedWritingTaskType {
  const rawMeta = section?.metadata?.['taskType'];
  if (typeof rawMeta === 'string' && rawMeta.trim().length > 0) {
    return normalizeWritingTaskType(rawMeta);
  }
  if (section?.sectionType) {
    const normalized = normalizeWritingTaskType(section.sectionType);
    // Fallback only if sectionType is generic like 'writing_task'
    if (
      section.sectionType !== 'writing_task' &&
      section.sectionType !== 'writing' &&
      section.sectionType !== 'writing_prompt'
    ) {
      return normalized;
    }
  }
  switch (examId) {
    case 'ielts_general':
      return 'task1General';
    case 'toefl_ibt':
      return 'toeflAcademicDiscussion';
    case 'pte_academic':
      return 'pteEssay';
    case 'det':
      return 'detInteractiveWriting';
    default:
      return 'task2Essay';
  }
}

export function WritingSimulatorScreen({
  packId,
  initialExamMode = 'exam',
  mockSessionId = null,
  mockStageKey = null,
  onMockStageComplete,
}: WritingSimulatorScreenProps) {
  const deps = useDeps();
  const t = createTranslator(deps.edition);
  const navigate = useNavigate();
  const setActiveExamLock = useClockStore((s) => s.setActiveExamLock);

  const attemptIdRef = useRef(generateUuid());
  const startedAtRef = useRef(deps.clock.nowMs());
  const autoSubmittedRef = useRef(false);

  const [bundle, setBundle] = useState<ExamBundlePayload | null>(null);
  const [profileExamId, setProfileExamId] = useState<string>('ielts_academic');
  const [examMode, setExamMode] = useState<'exam' | 'study'>(initialExamMode);
  const [isPaused, setIsPaused] = useState(false);
  const [activeTaskIndex, setActiveTaskIndex] = useState(0);
  const [draftsBySectionId, setDraftsBySectionId] = useState<Record<string, string>>({});
  const [sequenceByQuestionId, setSequenceByQuestionId] = useState<Record<string, string>>({});
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [quota, setQuota] = useState<QuotaStatusSnapshot | null>(null);
  const [quotaBlocked, setQuotaBlocked] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitRef = useRef<() => Promise<void>>(async () => {});
  const activeEssayRef = useRef('');

  const { remainingSeconds, resetClock } = useCountdownClock({
    enabled: Boolean(bundle),
    isPaused,
    initialSeconds: 2400,
    onExpire: () => {
      if (examMode === 'exam' && !autoSubmittedRef.current && activeEssayRef.current.trim().length >= 20) {
        autoSubmittedRef.current = true;
        void handleSubmitRef.current();
      }
    },
  });

  const remainingSecondsRef = useRef(remainingSeconds);
  remainingSecondsRef.current = remainingSeconds;

  const [reloadSeq, setReloadSeq] = useState(0);
  const retryLoad = useCallback(() => {
    setErrorMsg(null);
    setReloadSeq((s) => s + 1);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      const [bundleRes, profileRes, draftRes, quotaRes] = await Promise.all([
        deps.catalog.ensureExamBundle(packId),
        deps.attemptStore.getUserProfile(),
        deps.attemptStore.getActiveDraft(packId, 'writing'),
        deps.evaluation.getQuotaStatus(),
      ]);
      if (!mounted) return;
      if (!bundleRes.ok) {
        setErrorMsg(bundleRes.error.message);
        return;
      }
      setBundle(bundleRes.value);
      const durationSec = bundleRes.value.pack.durationSeconds || 2400;
      resetClock(durationSec, durationSec);

      if (profileRes.ok && profileRes.value?.examId) {
        setProfileExamId(profileRes.value.examId);
      }
      if (quotaRes.ok) {
        setQuota(quotaRes.value);
      }
      if (draftRes.ok && draftRes.value &&
          (draftRes.value.mockSessionId ?? null) === mockSessionId &&
          (draftRes.value.mockStageKey ?? null) === mockStageKey) {
        setExamMode(draftRes.value.usedStudyMode ? 'study' : 'exam');
        attemptIdRef.current = draftRes.value.attemptId;
        resetClock(draftRes.value.timerRemainingSec ?? durationSec, durationSec);
        setActiveTaskIndex(draftRes.value.currentQuestionIndex || 0);
        const restoredMap: Record<string, string> = {};
        for (const [key, val] of Object.entries(draftRes.value.answersJson)) {
          if (typeof val === 'string') {
            restoredMap[key] = val;
          }
        }
        if (Object.keys(restoredMap).length === 0 && draftRes.value.draftText) {
          const firstSectionId = bundleRes.value.sections[0]?.sectionId ?? 'task-1';
          restoredMap[firstSectionId] = draftRes.value.draftText;
        }
        setDraftsBySectionId(restoredMap);
        setDraftStatus('saved');
      }
    }
    void hydrate();
    return () => {
      mounted = false;
    };
  }, [deps.attemptStore, deps.catalog, deps.evaluation, mockSessionId, mockStageKey, packId, reloadSeq, resetClock]);

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

  const activeSection = sortedSections[activeTaskIndex] ?? sortedSections[0] ?? null;
  const activeSectionId = activeSection?.sectionId ?? 'task-1';
  const activeTaskType = resolveSectionWritingTaskType(
    activeSection,
    bundle?.pack.examId ?? profileExamId,
  );
  const taskMeta = getWritingTaskSpec(activeTaskType);
  const activeEssayText = draftsBySectionId[activeSectionId] ?? '';
  activeEssayRef.current = activeEssayText;

  const sectionQuestions = useMemo(
    () =>
      bundle && activeSection
        ? bundle.questions.filter((q) => q.sectionId === activeSection.sectionId)
        : [],
    [activeSection, bundle],
  );

  const buildCurrentDraft = useCallback(() => {
    if (!bundle) return null;
    return {
      attemptId: attemptIdRef.current,
      packId,
      skill: 'writing' as const,
      examId: (bundle.pack.examId ?? profileExamId) as SupportedExamId,
      taskType: activeTaskType,
      draftText: activeEssayText,
      wordCount: countEssayWords(activeEssayText),
      answersJson: draftsBySectionId,
      flaggedQuestionIds: [],
      currentQuestionIndex: activeTaskIndex,
      timerRemainingSec: remainingSecondsRef.current,
      usedStudyMode: examMode === 'study',
      mockSessionId,
      mockStageKey,
      updatedAtMs: deps.clock.nowMs(),
    };
  }, [
    activeEssayText,
    activeTaskIndex,
    activeTaskType,
    bundle,
    deps.clock,
    draftsBySectionId,
    examMode,
    mockSessionId,
    mockStageKey,
    packId,
    profileExamId,
  ]);

  const draftBuilderRef = useRef(buildCurrentDraft);
  draftBuilderRef.current = buildCurrentDraft;

  const flushDraftToStore = useCallback(async () => {
    const snapshot = draftBuilderRef.current();
    if (!snapshot) return;
    setDraftStatus('saving');
    await deps.attemptStore.saveAttemptDraft(snapshot);
    setDraftStatus('saved');
  }, [deps.attemptStore]);

  // 500ms debounced Dexie draft autosave (does not reset on 1s timer ticks)
  useEffect(() => {
    if (!bundle || Object.keys(draftsBySectionId).length === 0) return;
    setDraftStatus('saving');
    const timer = window.setTimeout(() => {
      void flushDraftToStore();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [bundle, draftsBySectionId, flushDraftToStore]);

  // Synchronous urgent localStorage + Dexie flush on tab hide or close
  useEffect(() => {
    if (!bundle) return;
    return registerSpaUrgentDraftListeners(
      () => draftBuilderRef.current(),
      (draft) => deps.attemptStore.flushUrgentDraftSync(draft),
    );
  }, [bundle, deps.attemptStore]);

  const updateActiveDraftText = useCallback(
    (nextText: string) => {
      setErrorMsg(null);
      setQuotaBlocked(false);
      setDraftsBySectionId((prev) => ({
        ...prev,
        [activeSectionId]: nextText,
      }));
    },
    [activeSectionId],
  );

  const handleSequenceChange = useCallback(
    (questionId: string, options: readonly string[], nextSeq: string) => {
      setSequenceByQuestionId((prev) => ({ ...prev, [questionId]: nextSeq }));
      const tokens = nextSeq
        .split('|')
        .map((label) => {
          const idx = label.trim().charCodeAt(0) - 65;
          const opt = options[idx];
          if (!opt) return '';
          return opt.replace(/^[A-Z0-9]+\s*[.):-]?\s*/i, '').trim();
        })
        .filter(Boolean);
      if (tokens.length > 0) {
        updateActiveDraftText(tokens.join(' '));
      }
    },
    [updateActiveDraftText],
  );

  const handleSubmit = useCallback(async () => {
    if (!bundle || isSubmitting) return;
    const sectionEntries = sortedSections
      .map((sec, idx) => ({
        section: sec,
        idx,
        text: (draftsBySectionId[sec.sectionId] ?? '').trim(),
      }))
      .filter((entry) => entry.text.length > 0);
    const combinedEssayText =
      sectionEntries.length > 1
        ? sectionEntries
            .map((entry) => `[Task ${entry.idx + 1}: ${entry.section.title}]\n${entry.text}`)
            .join('\n\n')
        : (sectionEntries[0]?.text ?? activeEssayText.trim());
    const trimmed = combinedEssayText;
    if (trimmed.length < 20) {
      setErrorMsg(t('writingMinLengthWarning'));
      return;
    }

    const latestQuota = await deps.evaluation.getQuotaStatus();
    if (latestQuota.ok) {
      setQuota(latestQuota.value);
      if (
        !latestQuota.value.isPro &&
        latestQuota.value.dailyWritingUsed >= latestQuota.value.dailyWritingLimit
      ) {
        setQuotaBlocked(true);
        setErrorMsg(t('writingQuotaExhaustedError'));
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const nowMs = deps.clock.nowMs();
    const durationSeconds = Math.max(1, Math.round((nowMs - startedAtRef.current) / 1000));
    const examId = (bundle.pack.examId ?? profileExamId) as SupportedExamId;

    const writingPayload = {
      attemptId: attemptIdRef.current,
      packId: bundle.pack.packId,
      examId,
      edition: deps.edition,
      taskType: activeTaskType,
      promptTitle: activeSection?.title ?? taskMeta.fullTitle,
      promptBody: activeSection?.contentText ?? activeSection?.instructions ?? '',
      essayText: trimmed,
      durationSeconds,
      wordCount: countEssayWords(trimmed),
    };

    const evalRes = await deps.evaluation.submitWritingEvaluation(writingPayload);

    if (!evalRes.ok) {
      if (evalRes.error.kind === 'network') {
        await deps.attemptStore.completeObjectiveAttempt({
          attemptId: attemptIdRef.current,
          examId,
          packId: bundle.pack.packId,
          skill: 'writing',
          status: 'submitted_local',
          syncStatus: 'pending',
          remoteJobId: null,
          submissionJson: JSON.stringify({
            taskType: activeTaskType,
            essayText: trimmed,
            wordCount: countEssayWords(trimmed),
          }),
          evaluationJson: null,
          overallBand: null,
          errorCode: null,
          startedAtUtcMs: startedAtRef.current,
          completedAtMs: nowMs,
          durationSeconds,
          usedStudyMode: examMode === 'study',
          questionCount: 1,
          isCalibratedFullPack: sortedSections.length >= 2,
          contentVersion: bundle.pack.version,
          mockSessionId,
          mockStageKey,
          updatedAtMs: nowMs,
        });
        await deps.syncOutbox.enqueue({
          idempotencyKey: `eval-writing-${attemptIdRef.current}`,
          actionType: 'evaluate_writing',
          entityKind: 'attempt',
          payloadJson: JSON.stringify(writingPayload),
        });
        await deps.attemptStore.deleteDraft(attemptIdRef.current);
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
        await navigate({ to: '/progress' });
        return;
      }

      setIsSubmitting(false);
      if (evalRes.error.kind === 'quota_exceeded' || evalRes.error.kind === 'entitlement_required') {
        setQuotaBlocked(true);
        setErrorMsg(t('writingQuotaExhaustedError'));
      } else {
        setErrorMsg(evalRes.error.message);
      }
      return;
    }

    await deps.attemptStore.completeObjectiveAttempt({
      attemptId: attemptIdRef.current,
      examId,
      packId: bundle.pack.packId,
      skill: 'writing',
      status: 'queued_remote',
      syncStatus: 'pending',
      remoteJobId: evalRes.value.jobId,
      submissionJson: JSON.stringify({
        taskType: activeTaskType,
        essayText: trimmed,
        wordCount: countEssayWords(trimmed),
      }),
      evaluationJson: null,
      overallBand: null,
      errorCode: null,
      startedAtUtcMs: startedAtRef.current,
      completedAtMs: nowMs,
      durationSeconds,
      usedStudyMode: examMode === 'study',
      questionCount: 1,
      isCalibratedFullPack: sortedSections.length >= 2,
      contentVersion: bundle.pack.version,
      mockSessionId,
      mockStageKey,
      updatedAtMs: nowMs,
    });
    await deps.attemptStore.deleteDraft(attemptIdRef.current);
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
    activeEssayText,
    activeSection?.contentText,
    activeSection?.instructions,
    activeSection?.title,
    activeTaskType,
    bundle,
    deps.attemptStore,
    deps.clock,
    deps.edition,
    deps.evaluation,
    deps.syncOutbox,
    draftsBySectionId,
    examMode,
    isSubmitting,
    mockSessionId,
    mockStageKey,
    navigate,
    onMockStageComplete,
    profileExamId,
    setActiveExamLock,
    sortedSections,
    t,
    taskMeta.fullTitle,
  ]);

  handleSubmitRef.current = handleSubmit;

  const shortcuts: readonly KeyboardShortcutHint[] = useMemo(
    () => [{ keys: 'Tab / Enter', description: 'Navigate prompt & editor' }],
    [],
  );

  if (!bundle) {
    return (
      <div data-testid="writing-simulator-screen" className="p-4 sm:p-6 text-sm text-text-secondary">
        {errorMsg ? (
          <SimulatorLoadFallback
            testId="writing-load-fallback"
            onRetry={retryLoad}
            message={errorMsg}
          />
        ) : (
          t('workspaceLoadingLabel')
        )}
      </div>
    );
  }

  const minWords =
    typeof activeSection?.metadata?.['minWords'] === 'number'
      ? (activeSection.metadata['minWords'] as number)
      : taskMeta.defaultMinWords;
  const maxWords =
    typeof activeSection?.metadata?.['maxWords'] === 'number'
      ? (activeSection.metadata['maxWords'] as number)
      : taskMeta.defaultMaxWords;
  const chartSvg =
    typeof activeSection?.metadata?.['chartSvg'] === 'string'
      ? (activeSection.metadata['chartSvg'] as string)
      : null;
  const chartUrl =
    typeof activeSection?.metadata?.['svgUrl'] === 'string'
      ? (activeSection.metadata['svgUrl'] as string)
      : activeSection?.mediaUrl ?? null;

  const remainingQuota = quota
    ? quota.isPro
      ? null
      : Math.max(0, quota.dailyWritingLimit - quota.dailyWritingUsed)
    : null;

  return (
    <div data-testid="writing-simulator-screen" className="flex flex-col gap-3">
      {errorMsg ? (
        <MzBanner
          tone="warning"
          actions={
            quotaBlocked ? (
              <Link
                to="/paywall"
                data-testid="writing-upgrade-cta"
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
        subtitle={taskMeta.fullTitle}
        remainingSeconds={remainingSeconds}
        timerPhase={remainingSeconds === 0 ? 'expired' : 'response'}
        examMode={examMode}
        isPaused={isPaused}
        onTogglePause={() => setIsPaused((p) => !p)}
        onRequestExit={() => void navigate({ to: '/home' })}
        shortcuts={shortcuts}
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            {remainingQuota !== null && quota ? (
              <span
                data-testid="writing-quota-badge"
                className="inline-flex items-center gap-1 rounded-[var(--mz-radius-pill)] border border-border-subtle bg-bg-raised px-2.5 py-1 text-[11px] font-semibold text-text-secondary"
              >
                <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" />
                <span>
                  {t('writingQuotaRemainingBadge', {
                    remaining: remainingQuota,
                    limit: quota.dailyWritingLimit,
                  })}
                </span>
              </span>
            ) : null}

            <span
              data-testid="writing-draft-status"
              className="inline-flex items-center gap-1 rounded-[var(--mz-radius-pill)] border border-border-subtle bg-bg-raised px-2.5 py-1 text-[11px] font-medium text-text-secondary"
            >
              <CheckCircle2 className="h-3 w-3 text-success" aria-hidden="true" />
              <span>
                {draftStatus === 'saving'
                  ? t('writingSavingDraftBadge')
                  : t('writingDraftSavedBadge')}
              </span>
            </span>

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
              <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
              <span data-testid="writing-task-spec-summary">{taskMeta.fullTitle}</span>
            </div>

            <MzButton
              variant="primary"
              size="md"
              data-testid="writing-submit-btn"
              isLoading={isSubmitting}
              onClick={() => void handleSubmit()}
            >
              {isSubmitting
                ? t('writingSubmittingEvaluationLabel')
                : t('writingSubmitEvaluationAction')}
            </MzButton>
          </div>
        }
      >
        <SplitPaneWorkspace
          viewKey="simulator:writing"
          initialRatio={0.45}
          leftLabel={t('splitTabLeftPrompt')}
          rightLabel={t('splitTabRightEssay')}
          leftPane={
            <div className="flex flex-col gap-4">
              {sortedSections.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {sortedSections.map((section, idx) => {
                    const secTaskMeta = getWritingTaskSpec(
                      resolveSectionWritingTaskType(section, bundle.pack.examId),
                    );
                    return (
                      <button
                        key={section.sectionId}
                        type="button"
                        data-testid={`writing-task-tab-${idx}`}
                        onClick={() => setActiveTaskIndex(idx)}
                        className={[
                          'inline-flex min-h-10 items-center rounded-[var(--mz-radius-pill)] border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                          idx === activeTaskIndex
                            ? 'border-primary bg-primary text-on-primary'
                            : 'border-border-subtle bg-bg-raised text-text-secondary hover:bg-surface-hover',
                        ].join(' ')}
                      >
                        {secTaskMeta.shortTabLabel}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <MzCard variant="default">
                <p className="text-xs font-bold text-primary">{taskMeta.fullTitle}</p>
                <LtrExamBoundary>
                  <h2 className="mt-1.5 text-base font-bold text-text-primary">
                    {activeSection?.title}
                  </h2>
                  {activeSection?.instructions ? (
                    <p className="mt-2 text-xs font-medium text-text-secondary">
                      {activeSection.instructions}
                    </p>
                  ) : null}
                  {activeSection?.contentText ? (
                    <div className="mt-3 whitespace-pre-wrap rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3.5 text-sm leading-relaxed text-text-primary">
                      {activeSection.contentText}
                    </div>
                  ) : null}
                </LtrExamBoundary>
              </MzCard>

              {chartSvg || chartUrl ? (
                <ExamSvgChartCard
                  svgMarkup={chartSvg}
                  svgUrl={chartUrl}
                  altText={activeSection?.title ?? 'Writing visual stimulus'}
                  caption={
                    typeof activeSection?.metadata?.['chartCaption'] === 'string'
                      ? (activeSection.metadata['chartCaption'] as string)
                      : null
                  }
                />
              ) : null}

              {activeTaskType === 'detInteractiveWriting' ? (
                <div data-testid="det-interactive-writing-steps">
                  <MzBanner tone="info">
                    {sortedSections.length >= 2
                      ? `DET Interactive Writing — Step ${activeTaskIndex + 1} of ${sortedSections.length}`
                      : 'DET Interactive Writing — Step 1 (5 min Prompt) → Step 2 (3 min Follow-Up)'}
                  </MzBanner>
                </div>
              ) : null}

              {activeTaskType === 'toeflSentenceBuild' && sectionQuestions.length > 0 ? (
                <MzCard variant="alt">
                  <p className="mb-3 text-xs text-text-secondary">{t('writingSentenceBuildHint')}</p>
                  <div className="flex flex-col gap-4">
                    {sectionQuestions.map((q) => (
                      <div key={q.questionId} className="flex flex-col gap-2">
                        <LtrExamBoundary>
                          <p className="text-xs font-semibold text-text-primary">{q.prompt}</p>
                        </LtrExamBoundary>
                        {q.options && q.options.length > 0 ? (
                          <MzSequenceOrderControl
                            options={q.options}
                            currentValue={sequenceByQuestionId[q.questionId] ?? ''}
                            onChanged={(nextSeq) =>
                              handleSequenceChange(q.questionId, q.options ?? [], nextSeq)
                            }
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </MzCard>
              ) : null}
            </div>
          }
          rightPane={
            <DistractionFreeEssayEditor
              value={activeEssayText}
              onChange={updateActiveDraftText}
              examMode={examMode}
              minWords={minWords}
              maxWords={maxWords}
              requiresSingleSentence={taskMeta.requiresSingleSentence}
              draftSaved={draftStatus === 'saved'}
            />
          }
        />
      </SimulatorWorkspaceShell>
    </div>
  );
}
