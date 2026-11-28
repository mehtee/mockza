import { Bookmark, Headphones } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  AudioStudioPlayer,
  type KeyboardShortcutHint,
  MzObjectiveAnswerInput,
  QuestionPaletteBar,
  SimulatorLoadFallback,
  SimulatorWorkspaceShell,
  SplitPaneWorkspace,
  type TranscriptSegmentItem,
} from '@/components/exam-kit';
import { MzButton, MzCard, MzSegmentedControl } from '@/components/ui';
import { BackChevronIcon, ForwardChevronIcon } from '@/components/bidi/DirectionIcon';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { createTranslator } from '@/i18n';
import { makePackMediaKey } from '@/gateways/catalog.gateway';
import { useDeps } from '@/spa/deps';
import { useObjectiveSimulatorSession } from '@/spa/useObjectiveSimulatorSession';

export interface ListeningSimulatorScreenProps {
  readonly packId: string;
  readonly initialExamMode?: 'exam' | 'study';
  readonly mockSessionId?: string | null;
  readonly mockStageKey?: string | null;
  readonly onMockStageComplete?: (attemptId: string) => void;
}

export function ListeningSimulatorScreen({
  packId,
  initialExamMode = 'exam',
  mockSessionId = null,
  mockStageKey = null,
  onMockStageComplete,
}: ListeningSimulatorScreenProps) {
  const deps = useDeps();
  const t = createTranslator(deps.edition);

  const session = useObjectiveSimulatorSession({
    packId,
    skill: 'listening',
    initialExamMode,
    mockSessionId,
    mockStageKey,
    onMockStageComplete,
  });

  const [audioStatus, setAudioStatus] = useState<{
    readonly mediaKey: string;
    readonly ready: boolean;
  } | null>(null);

  const {
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
    retryLoad,
  } = session;

  const activeMediaUrl = activeSection?.mediaUrl ?? bundle?.pack.mediaUrl ?? '';
  const activeMediaKey = makePackMediaKey(packId, activeMediaUrl);
  const audioSource = {
    mediaKey: activeMediaKey,
    fallbackUrl: activeMediaUrl,
  };
  const audioBuffered = audioStatus?.mediaKey === activeMediaKey && audioStatus.ready;

  const transcriptSegments: readonly TranscriptSegmentItem[] = useMemo(
    () =>
      activeSection?.transcript?.map((seg, idx) => ({
        id: `${activeSection.sectionId}-tr-${idx}`,
        startSec: seg.startMs / 1000,
        endSec: seg.endMs / 1000,
        speaker: seg.speaker,
        text: seg.text,
      })) ?? [],
    [activeSection],
  );

  const shortcuts: readonly KeyboardShortcutHint[] = useMemo(
    () => [
      { keys: 'J / K', description: t('simNextQuestionAction') },
      { keys: 'F', description: t('simFlagQuestionAction') },
      { keys: '1–9', description: t('listeningSelectChoiceShortcut') },
    ],
    [t],
  );

  if (!bundle) {
    return (
      <div data-testid="listening-simulator-screen" className="p-4 sm:p-6 text-sm text-text-secondary">
        {errorMsg ? (
          <SimulatorLoadFallback
            testId="listening-load-fallback"
            onRetry={retryLoad}
            message={errorMsg}
          />
        ) : (
          t('workspaceLoadingLabel')
        )}
      </div>
    );
  }

  const visibleQuestions =
    viewMode === 'focused' && activeQuestion ? [activeQuestion] : sectionQuestions;

  return (
    <div data-testid="listening-simulator-screen" className="flex flex-col gap-3">
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
            <span
              data-testid="listening-buffer-badge"
              className="inline-flex items-center gap-1 rounded-[var(--mz-radius-pill)] border border-border-subtle bg-bg-raised px-2.5 py-1 text-[11px] font-semibold text-text-secondary"
            >
              <Headphones className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span>
                {audioBuffered ? t('listeningAudioReadyBadge') : t('listeningPrebufferingLabel')}
              </span>
            </span>
            {!mockSessionId && Object.keys(answersByQuestionId).length === 0 && examMode === 'exam' ? (
              <MzSegmentedControl<'exam' | 'study'>
                ariaLabel="Simulation Mode"
                value={examMode}
                onChange={setExamMode}
                options={[
                  { value: 'exam', label: t('workspaceExamModeBadge') },
                  { value: 'study', label: t('workspaceStudyModeBadge') },
                ]}
              />
            ) : null}
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
                data-testid="listening-prev-btn"
                disabled={activeQuestionIndex <= 0}
                onClick={() => setActiveQuestionIndex((idx) => Math.max(0, idx - 1))}
              >
                <BackChevronIcon edition={deps.edition} className="h-4 w-4" />
                <span>{t('simPrevQuestionAction')}</span>
              </MzButton>
              <MzButton
                variant="secondary"
                size="sm"
                data-testid="listening-next-btn"
                disabled={activeQuestionIndex >= sortedQuestions.length - 1}
                onClick={() =>
                  setActiveQuestionIndex((idx) => Math.min(sortedQuestions.length - 1, idx + 1))
                }
              >
                <span>{t('simNextQuestionAction')}</span>
                <ForwardChevronIcon edition={deps.edition} className="h-4 w-4" />
              </MzButton>
              <MzButton
                variant="primary"
                size="md"
                data-testid="listening-submit-btn"
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
          viewKey="simulator:listening"
          initialRatio={0.44}
          leftLabel={t('splitTabLeftAudio')}
          rightLabel={t('splitTabRightQuestions')}
          leftPane={
            <div className="flex flex-col gap-4">
              {sortedSections.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {sortedSections.map((section, idx) => (
                    <button
                      key={section.sectionId}
                      type="button"
                      data-testid={`listening-section-tab-${idx}`}
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
                      {section.title || t('listeningTrackTabLabel', { index: idx + 1 })}
                    </button>
                  ))}
                </div>
              ) : null}

              <MzCard variant="alt" padding="sm">
                <LtrExamBoundary>
                  <p className="text-xs font-bold text-text-primary">{activeSection?.title}</p>
                </LtrExamBoundary>
                {activeSection?.instructions ? (
                  <div className="mt-1 text-xs text-text-secondary">
                    <LtrExamBoundary>{activeSection.instructions}</LtrExamBoundary>
                  </div>
                ) : null}
                <p className="mt-2 text-[11px] font-medium text-text-tertiary">
                  {examMode === 'exam'
                    ? t('listeningReplayNoticeExam')
                    : t('listeningReplayNoticeStudy')}
                </p>
              </MzCard>

              <AudioStudioPlayer
                source={audioSource}
                onPlaybackStateChange={(playback) => {
                  const ready = playback.status !== 'loading' && playback.status !== 'error';
                  setAudioStatus((previous) =>
                    previous?.mediaKey === activeMediaKey && previous.ready === ready
                      ? previous
                      : { mediaKey: activeMediaKey, ready },
                  );
                }}
                playbackMode={examMode === 'exam' ? 'exam_linear_locked' : 'study_interactive'}
                transcriptSegments={transcriptSegments}
              />

              {activeSection?.contentText && activeSection.sectionType === 'dictation' ? (
                <MzCard variant="default" padding="sm">
                  <LtrExamBoundary>
                    <p className="text-xs leading-relaxed text-text-secondary">
                      {activeSection.contentText}
                    </p>
                  </LtrExamBoundary>
                </MzCard>
              ) : null}
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
                    data-testid={`listening-question-card-${question.questionNumber}`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="text-sm font-semibold text-text-primary">
                        <LtrExamBoundary>
                          {`${question.questionNumber}. ${question.prompt.replace(/\[GAP\]/gi, '________')}`}
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
