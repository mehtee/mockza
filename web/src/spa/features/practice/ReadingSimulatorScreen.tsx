import { Bookmark, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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
import type { AnnotationColorCode, PassageAnnotationRecord } from '@/gateways/storage.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import { generateUuid } from '@/spa/objective-sim-helpers';
import { useObjectiveSimulatorSession } from '@/spa/useObjectiveSimulatorSession';

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

  const session = useObjectiveSimulatorSession({
    packId,
    skill: 'reading',
    initialExamMode,
    mockSessionId,
    mockStageKey,
    onMockStageComplete,
  });

  const [annotations, setAnnotations] = useState<PassageAnnotationRecord[]>([]);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void deps.attemptStore.getPassageAnnotations(packId).then((res) => {
      if (mounted && res.ok) {
        setAnnotations([...res.value]);
      }
    });
    return () => {
      mounted = false;
    };
  }, [deps.attemptStore, packId]);

  const {
    attemptId,
    profileExamId,
    bundle,
    examMode,
    setExamMode,
    viewMode,
    setViewMode,
    isPaused,
    setIsPaused,
    remainingSeconds,
    activeQuestionIndex,
    setActiveQuestionIndex,
    answersByQuestionId,
    flaggedQuestionIds,
    errorMsg,
    isSubmitting,
    sortedQuestions,
    sortedSections,
    activeQuestion,
    activeSectionIndex,
    activeSection,
    sectionQuestions,
    handleAnswerChange,
    toggleFlag,
    handleSubmit,
    requestExit,
  } = session;

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

  const handleUpdateAnnotationNote = useCallback(
    async (annotationId: string, noteText: string | null) => {
      const nowMs = deps.clock.nowMs();
      const updated = annotations.map((ann) =>
        ann.annotationId === annotationId ? { ...ann, noteText, updatedAtMs: nowMs } : ann,
      );
      setAnnotations(updated);
      await deps.attemptStore.savePassageAnnotations(packId, updated);
    },
    [annotations, deps.attemptStore, deps.clock, packId],
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
        sourceAttemptId: attemptId,
        sourceRefLabel: activeSection?.title ?? null,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      });
      setStatusBanner(t('simBookmarkSavedToast', { word: cleanWord }));
    },
    [
      activeSection?.title,
      attemptId,
      bundle?.pack.examId,
      deps.clock,
      deps.vocabStore,
      packId,
      profileExamId,
      t,
    ],
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
      {statusBanner ? <MzBanner tone="success">{statusBanner}</MzBanner> : null}

      <SimulatorWorkspaceShell
        breadcrumb={bundle.pack.title}
        subtitle={activeSection?.title}
        remainingSeconds={remainingSeconds}
        timerPhase={remainingSeconds === 0 ? 'expired' : 'response'}
        examMode={examMode}
        isPaused={isPaused}
        onTogglePause={() => setIsPaused((p) => !p)}
        onRequestExit={requestExit}
        shortcuts={shortcuts}
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            <MzSegmentedControl<'exam' | 'study'>
              ariaLabel="Simulation Mode"
              value={examMode}
              onChange={setExamMode}
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
                onUpdateAnnotationNote={(id, note) => void handleUpdateAnnotationNote(id, note)}
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
