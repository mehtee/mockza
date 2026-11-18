import { useNavigate } from '@tanstack/react-router';
import { Bookmark, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type KeyboardShortcutHint,
  MzObjectiveAnswerInput,
  PassageAnnotatorPane,
  type PassageSelectionDraft,
  QuestionPaletteBar,
  SimulatorWorkspaceShell,
  SplitPaneWorkspace,
} from '@/components/exam-kit';
import { MzBanner, MzButton, MzCard, MzSegmentedControl } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { ExamBundlePayload } from '@/gateways/catalog.gateway';
import type { AnnotationColorCode, PassageAnnotationRecord } from '@/gateways/storage.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import { useClockStore } from '@/spa/stores/clock.store';
import { buildScoredObjectiveAttempt, generateUuid } from '@/spa/objective-sim-helpers';

export interface ReadingSimulatorScreenProps {
  readonly packId: string;
  readonly initialExamMode?: 'exam' | 'study';
  readonly mockSessionId?: string | null;
  readonly mockStageKey?: string | null;
  readonly onMockStageComplete?: (attemptId: string) => void;
}

export function ReadingSimulatorScreen({
  packId,
  initialExamMode = 'exam',
  mockSessionId = null,
  mockStageKey = null,
  onMockStageComplete,
}: ReadingSimulatorScreenProps) {
  const deps = useDeps();
  const t = createTranslator(deps.edition);
  const navigate = useNavigate();
  const setActiveExamLock = useClockStore((s) => s.setActiveExamLock);

  const attemptIdRef = useRef(generateUuid());
  const startedAtRef = useRef(deps.clock.nowMs());
  const autoSubmittedRef = useRef(false);

  const [bundle, setBundle] = useState<ExamBundlePayload | null>(null);
  const [profileExamId, setProfileExamId] = useState('ielts_academic');
  const [examMode, setExamMode] = useState<'exam' | 'study'>(initialExamMode);
  const [viewMode, setViewMode] = useState<'focused' | 'all'>('focused');
  const [isPaused, setIsPaused] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(3600);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [answersByQuestionId, setAnswersByQuestionId] = useState<Record<string, string>>({});
  const [flaggedQuestionIds, setFlaggedQuestionIds] = useState<Record<string, boolean>>({});
  const [annotations, setAnnotations] = useState<PassageAnnotationRecord[]>([]);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      const [bundleRes, profileRes, annRes, draftRes] = await Promise.all([
        deps.catalog.ensureExamBundle(packId),
        deps.attemptStore.getUserProfile(),
        deps.attemptStore.getPassageAnnotations(packId),
        deps.attemptStore.getActiveDraft(packId, 'reading'),
      ]);
      if (!mounted) return;
      if (!bundleRes.ok) {
        setErrorMsg(bundleRes.error.message);
        return;
      }
      setBundle(bundleRes.value);
      const durationSec = bundleRes.value.pack.durationSeconds || 3600;
      setRemainingSeconds(durationSec);

      if (profileRes.ok && profileRes.value?.examId) {
        setProfileExamId(profileRes.value.examId);
      }
      if (annRes.ok) {
        setAnnotations([...annRes.value]);
      }
      if (draftRes.ok && draftRes.value) {
        attemptIdRef.current = draftRes.value.attemptId;
        setRemainingSeconds(draftRes.value.timerRemainingSec || durationSec);
        const restoredAnswers: Record<string, string> = {};
        for (const [k, v] of Object.entries(draftRes.value.answersJson)) {
          if (typeof v === 'string') {
            restoredAnswers[k] = v;
          }
        }
        setAnswersByQuestionId(restoredAnswers);
        const restoredFlags: Record<string, boolean> = {};
        for (const qId of draftRes.value.flaggedQuestionIds) {
          restoredFlags[qId] = true;
        }
        setFlaggedQuestionIds(restoredFlags);
        setActiveQuestionIndex(draftRes.value.currentQuestionIndex);
      }
    }
    void hydrate();
    return () => {
      mounted = false;
    };
  }, [deps.attemptStore, deps.catalog, packId]);

  useEffect(() => {
    if (!bundle) return;
    setActiveExamLock(examMode === 'exam', bundle.pack.title);
    return () => {
      setActiveExamLock(false);
    };
  }, [bundle, examMode, setActiveExamLock]);

  const sortedQuestions = useMemo(
    () =>
      bundle
        ? [...bundle.questions].sort((a, b) => a.questionNumber - b.questionNumber)
        : [],
    [bundle],
  );

  const sortedSections = useMemo(
    () =>
      bundle
        ? [...bundle.sections].sort((a, b) => a.sectionIndex - b.sectionIndex)
        : [],
    [bundle],
  );

  const activeQuestion = sortedQuestions[activeQuestionIndex] ?? sortedQuestions[0] ?? null;
  const activeSectionIndex = useMemo(() => {
    if (!activeQuestion) return 0;
    const idx = sortedSections.findIndex((s) => s.sectionId === activeQuestion.sectionId);
    return idx >= 0 ? idx : 0;
  }, [activeQuestion, sortedSections]);
  const activeSection = sortedSections[activeSectionIndex] ?? sortedSections[0] ?? null;

  const sectionQuestions = useMemo(
    () =>
      activeSection
        ? sortedQuestions.filter((q) => q.sectionId === activeSection.sectionId)
        : sortedQuestions,
    [activeSection, sortedQuestions],
  );

  const handleAnswerChange = useCallback(
    (questionId: string, nextValue: string) => {
      setAnswersByQuestionId((prev) => {
        const updated = { ...prev, [questionId]: nextValue };
        if (bundle) {
          void deps.attemptStore.saveAttemptDraft({
            attemptId: attemptIdRef.current,
            packId,
            skill: 'reading',
            examId: bundle.pack.examId as never,
            taskType: 'reading',
            draftText: '',
            wordCount: 0,
            answersJson: updated,
            flaggedQuestionIds: Object.entries(flaggedQuestionIds)
              .filter(([, flagged]) => flagged)
              .map(([qId]) => qId),
            currentQuestionIndex: activeQuestionIndex,
            timerRemainingSec: remainingSeconds,
            usedStudyMode: examMode === 'study',
            mockSessionId,
            mockStageKey,
            updatedAtMs: deps.clock.nowMs(),
          });
        }
        return updated;
      });
    },
    [
      activeQuestionIndex,
      bundle,
      deps.attemptStore,
      deps.clock,
      examMode,
      flaggedQuestionIds,
      mockSessionId,
      mockStageKey,
      packId,
      remainingSeconds,
    ],
  );

  const toggleFlag = useCallback(
    (questionId: string) => {
      setFlaggedQuestionIds((prev) => ({
        ...prev,
        [questionId]: !prev[questionId],
      }));
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!bundle || isSubmitting) return;
    setIsSubmitting(true);

    const nowMs = deps.clock.nowMs();
    const { record } = buildScoredObjectiveAttempt({
      attemptId: attemptIdRef.current,
      bundle,
      skill: 'reading',
      profileExamId,
      answersByQuestionId,
      startedAtUtcMs: startedAtRef.current,
      nowMs,
      usedStudyMode: examMode === 'study',
      mockSessionId,
      mockStageKey,
    });

    await deps.attemptStore.completeObjectiveAttempt(record);
    await deps.attemptStore.deleteDraft(record.attemptId);
    await deps.attemptStore.incrementDailyStudyLog({
      serialDay: deps.clock.todaySerialDay(),
      addSeconds: record.durationSeconds,
      addCompletedItems: 1,
    });

    setIsSubmitting(false);
    setActiveExamLock(false);

    if (onMockStageComplete) {
      onMockStageComplete(record.attemptId);
      return;
    }

    await navigate({
      to: '/practice/objective-result/$attemptId',
      params: { attemptId: record.attemptId },
    });
  }, [
    answersByQuestionId,
    bundle,
    deps.attemptStore,
    deps.clock,
    examMode,
    isSubmitting,
    mockSessionId,
    mockStageKey,
    navigate,
    onMockStageComplete,
    profileExamId,
    setActiveExamLock,
  ]);

  // Countdown timer with automatic Exam Mode submission on expiry
  useEffect(() => {
    if (!bundle || isPaused) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (examMode === 'exam' && !autoSubmittedRef.current) {
            autoSubmittedRef.current = true;
            void handleSubmit();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [bundle, examMode, handleSubmit, isPaused]);

  // Desktop keyboard shortcuts: J/K step question, F flag current
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const lower = event.key.toLowerCase();
      if (lower === 'j') {
        event.preventDefault();
        setActiveQuestionIndex((idx) => Math.min(sortedQuestions.length - 1, idx + 1));
      } else if (lower === 'k') {
        event.preventDefault();
        setActiveQuestionIndex((idx) => Math.max(0, idx - 1));
      } else if (lower === 'f' && activeQuestion) {
        event.preventDefault();
        toggleFlag(activeQuestion.questionId);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeQuestion, sortedQuestions.length, toggleFlag]);

  const handleAddAnnotation = useCallback(
    async (input: {
      readonly startOffset: number;
      readonly endOffset: number;
      readonly colorCode: AnnotationColorCode;
      readonly noteText: string | null;
    }) => {
      const nowMs = deps.clock.nowMs();
      const newAnn: PassageAnnotationRecord = {
        annotationId: generateUuid(),
        packId,
        passageIndex: activeSectionIndex,
        startOffset: input.startOffset,
        endOffset: input.endOffset,
        colorCode: input.colorCode,
        noteText: input.noteText,
        isDeleted: 0,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      };
      const updated = [...annotations, newAnn];
      setAnnotations(updated);
      await deps.attemptStore.savePassageAnnotations(packId, updated);
    },
    [activeSectionIndex, annotations, deps.attemptStore, deps.clock, packId],
  );

  const handleDeleteAnnotation = useCallback(
    async (annotationId: string) => {
      const nowMs = deps.clock.nowMs();
      const updated = annotations.map((ann) =>
        ann.annotationId === annotationId
          ? { ...ann, isDeleted: 1 as const, updatedAtMs: nowMs }
          : ann,
      );
      setAnnotations(updated);
      await deps.attemptStore.savePassageAnnotations(packId, updated);
    },
    [annotations, deps.attemptStore, deps.clock, packId],
  );

  const handleSaveToVocab = useCallback(
    async (draft: PassageSelectionDraft) => {
      const nowMs = deps.clock.nowMs();
      const cleanWord = draft.selectedText.trim().slice(0, 64);
      if (!cleanWord) return;
      await deps.vocabStore.upsertMistakeCard({
        cardId: generateUuid(),
        examId: (bundle?.pack.examId ?? profileExamId) as never,
        headword: cleanWord,
        ipa: null,
        definition: draft.contextSentence,
        glossFa: null,
        topicTag: 'reading',
        sourceKind: 'mistake_to_deck',
        tags: ['reading', packId],
        contextSentence: draft.contextSentence,
        paraphraseHints: [],
        usageNote: null,
        sourceSkill: 'reading',
        sourceAttemptId: attemptIdRef.current,
        sourceRefLabel: activeSection?.title ?? null,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      });
      setStatusBanner(t('simBookmarkSavedToast', { word: cleanWord }));
    },
    [activeSection?.title, bundle?.pack.examId, deps.clock, deps.vocabStore, packId, profileExamId, t],
  );

  const shortcuts: readonly KeyboardShortcutHint[] = [
    { keys: 'J / K', description: 'Next / Previous question' },
    { keys: '1 – 9', description: 'Pick option in Focused view' },
    { keys: 'F', description: 'Flag / Unflag current question' },
    { keys: 'H', description: 'Highlight selected passage text' },
  ];

  if (!bundle) {
    return (
      <div data-testid="reading-simulator-screen" className="p-6 text-sm text-text-secondary">
        {errorMsg ? <MzBanner tone="danger">{errorMsg}</MzBanner> : 'Loading Reading Simulator...'}
      </div>
    );
  }

  const passageAnnotations = annotations.filter(
    (ann) => ann.passageIndex === activeSectionIndex && ann.isDeleted !== 1,
  );

  const visibleQuestions =
    viewMode === 'focused' && activeQuestion ? [activeQuestion] : sectionQuestions;

  const PrevIcon = deps.edition === 'irn' ? ChevronRight : ChevronLeft;
  const NextIcon = deps.edition === 'irn' ? ChevronLeft : ChevronRight;

  return (
    <div data-testid="reading-simulator-screen" className="flex flex-col gap-3">
      {statusBanner ? (
        <MzBanner tone="success">{statusBanner}</MzBanner>
      ) : null}

      <SimulatorWorkspaceShell
        breadcrumb={bundle.pack.title}
        subtitle={activeSection?.title}
        remainingSeconds={remainingSeconds}
        timerPhase={remainingSeconds === 0 ? 'expired' : 'response'}
        examMode={examMode}
        isPaused={isPaused}
        onTogglePause={() => setIsPaused((p) => !p)}
        onRequestExit={() => void navigate({ to: '/home' })}
        shortcuts={shortcuts}
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            <MzSegmentedControl<'exam' | 'study'>
              ariaLabel="Simulation Mode"
              value={examMode}
              onChange={(mode) => setExamMode(mode)}
              options={[
                { value: 'exam', label: t('workspaceExamModeBadge') },
                { value: 'study', label: t('workspaceStudyModeBadge') },
              ]}
            />
            <MzSegmentedControl<'focused' | 'all'>
              ariaLabel="Question Layout"
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: 'focused', label: t('simViewFocusedLabel') },
                { value: 'all', label: t('simViewAllLabel') },
              ]}
            />
          </div>
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <QuestionPaletteBar
                activeIndex={activeQuestionIndex}
                onSelectQuestion={setActiveQuestionIndex}
                items={sortedQuestions.map((q, index) => ({
                  index,
                  number: q.questionNumber,
                  isAnswered: (answersByQuestionId[q.questionId] ?? '').trim().length > 0,
                  isFlagged: Boolean(flaggedQuestionIds[q.questionId]),
                }))}
              />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <MzButton
                variant="secondary"
                size="sm"
                data-testid="reading-prev-btn"
                disabled={activeQuestionIndex <= 0}
                onClick={() => setActiveQuestionIndex((idx) => Math.max(0, idx - 1))}
              >
                <PrevIcon className="h-4 w-4" aria-hidden="true" />
                <span>{t('simPrevQuestionAction')}</span>
              </MzButton>
              <MzButton
                variant="secondary"
                size="sm"
                data-testid="reading-next-btn"
                disabled={activeQuestionIndex >= sortedQuestions.length - 1}
                onClick={() =>
                  setActiveQuestionIndex((idx) => Math.min(sortedQuestions.length - 1, idx + 1))
                }
              >
                <span>{t('simNextQuestionAction')}</span>
                <NextIcon className="h-4 w-4" aria-hidden="true" />
              </MzButton>
              <MzButton
                variant="primary"
                size="md"
                data-testid="reading-submit-btn"
                isLoading={isSubmitting}
                onClick={() => void handleSubmit()}
              >
                {isSubmitting ? t('simSubmittingLabel') : t('simSubmitTestAction')}
              </MzButton>
            </div>
          </div>
        }
      >
        <SplitPaneWorkspace
          viewKey="simulator:reading"
          initialRatio={0.55}
          leftLabel="Reading Passage"
          rightLabel="Questions"
          leftPane={
            <div className="flex flex-col gap-4">
              {sortedSections.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {sortedSections.map((section, idx) => (
                    <button
                      key={section.sectionId}
                      type="button"
                      data-testid={`reading-section-tab-${idx}`}
                      onClick={() => {
                        const firstInSec = sortedQuestions.findIndex(
                          (q) => q.sectionId === section.sectionId,
                        );
                        if (firstInSec >= 0) setActiveQuestionIndex(firstInSec);
                      }}
                      className={[
                        'rounded-[var(--mz-radius-pill)] border px-3 py-1 text-xs font-semibold transition-colors',
                        idx === activeSectionIndex
                          ? 'border-primary bg-primary text-on-primary'
                          : 'border-border-subtle bg-bg-raised text-text-secondary hover:bg-surface-hover',
                      ].join(' ')}
                    >
                      {section.title}
                    </button>
                  ))}
                </div>
              ) : null}

              <PassageAnnotatorPane
                title={activeSection?.title}
                rawText={activeSection?.contentText ?? ''}
                annotations={passageAnnotations}
                onAddAnnotation={(ann) => void handleAddAnnotation(ann)}
                onDeleteAnnotation={(id) => void handleDeleteAnnotation(id)}
                onSaveToVocab={(draft) => void handleSaveToVocab(draft)}
              />
            </div>
          }
          rightPane={
            <div className="flex flex-col gap-4">
              {visibleQuestions.map((question) => {
                const isFlagged = Boolean(flaggedQuestionIds[question.questionId]);
                return (
                  <MzCard
                    key={question.questionId}
                    variant="default"
                    data-testid={`reading-question-card-${question.questionNumber}`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="text-sm font-semibold text-text-primary">
                        <LtrExamBoundary>
                          {`${question.questionNumber}. ${question.prompt}`}
                        </LtrExamBoundary>
                      </div>
                      <button
                        type="button"
                        data-testid={`flag-question-${question.questionNumber}`}
                        aria-pressed={isFlagged}
                        onClick={() => toggleFlag(question.questionId)}
                        className={[
                          'inline-flex shrink-0 items-center gap-1 rounded-[var(--mz-radius-pill)] border px-2.5 py-0.5 text-[11px] font-semibold transition-colors',
                          isFlagged
                            ? 'border-warning bg-amber-bg text-warning'
                            : 'border-border-subtle bg-bg-raised text-text-secondary hover:bg-surface-hover',
                        ].join(' ')}
                      >
                        <Bookmark className="h-3 w-3" aria-hidden="true" />
                        <span>{t('simFlaggedBadge')}</span>
                      </button>
                    </div>

                    <MzObjectiveAnswerInput
                      question={{
                        questionId: question.questionId,
                        number: question.questionNumber,
                        questionType: question.questionType,
                        prompt: question.prompt,
                        options: question.options ?? undefined,
                        acceptedVariants: question.acceptedAnswers,
                        maxWords: question.maxWords ?? undefined,
                      }}
                      value={answersByQuestionId[question.questionId] ?? ''}
                      enableNumberShortcuts={
                        viewMode === 'focused' && activeQuestion?.questionId === question.questionId
                      }
                      onChange={(val) => handleAnswerChange(question.questionId, val)}
                    />
                  </MzCard>
                );
              })}
            </div>
          }
        />
      </SimulatorWorkspaceShell>
    </div>
  );
}
