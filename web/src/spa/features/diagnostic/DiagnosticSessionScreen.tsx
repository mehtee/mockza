import { DIAGNOSTIC_BUDGET_SECONDS, type DiagnosticSkill } from '@mockza/domain';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioStudioPlayer,
  DistractionFreeEssayEditor,
  MzObjectiveAnswerInput,
  PassageAnnotatorPane,
  SimulatorWorkspaceShell,
  SplitPaneWorkspace,
  WaveformMicRecorder,
} from '@/components/exam-kit';
import { MzBanner, MzButton, MzCard } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { RecordedClip } from '@/gateways/audio.gateway';
import type { DiagnosticBankDto, DiagnosticBlockDto } from '@/gateways/diagnostic.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import { useClockStore } from '@/spa/stores/clock.store';
import {
  createInitialPersistedState,
  type DiagnosticPersistedState,
  generateUuidV4,
  parseDiagnosticStateJson,
  pickNextAdaptiveBlock,
  recordAdaptiveBlockAttempt,
  serializeDiagnosticRecord,
} from './diagnostic-state';

export interface DiagnosticSessionScreenProps {
  readonly diagId?: string;
  readonly retakeSkill?: DiagnosticSkill;
}

export function DiagnosticSessionScreen({
  diagId: routeDiagId,
  retakeSkill,
}: DiagnosticSessionScreenProps = {}) {
  const deps = useDeps();
  const t = createTranslator(deps.edition);
  const navigate = useNavigate();
  const setActiveExamLock = useClockStore((s) => s.setActiveExamLock);

  const [bank, setBank] = useState<DiagnosticBankDto | null>(null);
  const [diagState, setDiagState] = useState<DiagnosticPersistedState | null>(null);
  const [blockChoices, setBlockChoices] = useState<[number | null, number | null]>([null, null]);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    DIAGNOSTIC_BUDGET_SECONDS.collectionTotalSeconds,
  );
  const [isPaused, setIsPaused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const remainingSecondsRef = useRef(remainingSeconds);
  remainingSecondsRef.current = remainingSeconds;

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      const [bankRes, sessionRecordRes] = await Promise.all([
        deps.diagnostic.fetchDiagnosticBank(),
        routeDiagId
          ? deps.attemptStore.getDiagnosticSession(routeDiagId)
          : deps.attemptStore.getLatestDiagnosticSession(),
      ]);
      if (!mounted) return;
      if (!bankRes.ok) {
        setErrorMsg(bankRes.error.message);
        return;
      }
      setBank(bankRes.value);

      const parsed = parseDiagnosticStateJson(sessionRecordRes.ok ? sessionRecordRes.value : null);
      if (parsed) {
        const effectiveState: DiagnosticPersistedState = retakeSkill
          ? {
              ...parsed,
              retakeSkill,
              currentStage: retakeSkill,
              readingHistory: retakeSkill === 'reading' ? [] : parsed.readingHistory,
              readingStopReason: retakeSkill === 'reading' ? null : parsed.readingStopReason,
              readingSkipped: retakeSkill === 'reading' ? false : parsed.readingSkipped,
              listeningHistory: retakeSkill === 'listening' ? [] : parsed.listeningHistory,
              listeningStopReason: retakeSkill === 'listening' ? null : parsed.listeningStopReason,
              listeningSkipped: retakeSkill === 'listening' ? false : parsed.listeningSkipped,
              writingText: retakeSkill === 'writing' ? '' : parsed.writingText,
              writingSkipped: retakeSkill === 'writing' ? false : parsed.writingSkipped,
              speakingTurns: retakeSkill === 'speaking' ? [] : parsed.speakingTurns,
              speakingSkipped: retakeSkill === 'speaking' ? false : parsed.speakingSkipped,
            }
          : parsed;
        setDiagState(effectiveState);
        const mult = effectiveState.mode === 'extended' ? 3 : 1;
        setRemainingSeconds(bankRes.value.budgetSeconds.collectionTotal * mult);
        return;
      }

      // Direct load without prior intro -> auto-bootstrap a clean session
      const newDiagId = routeDiagId ?? generateUuidV4();
      const createRes = await deps.diagnostic.createSession({
        diagId: newDiagId,
        examId: 'ielts_academic',
        mode: 'standard',
        selectionSeed: newDiagId,
      });
      if (!mounted) return;
      const fresh = createInitialPersistedState({
        diagId: newDiagId,
        examId: 'ielts_academic',
        mode: 'standard',
        skipSpeaking: false,
      });
      const enriched: DiagnosticPersistedState = {
        ...fresh,
        currentStage: retakeSkill ?? 'reading',
        retakeSkill: retakeSkill ?? null,
        remoteSession: createRes.ok ? createRes.value : null,
      };
      setDiagState(enriched);
      await deps.attemptStore.saveDiagnosticSession(
        serializeDiagnosticRecord(enriched, bankRes.value, deps.clock.nowMs()),
      );
    }
    void hydrate();
    return () => {
      mounted = false;
    };
  }, [deps.attemptStore, deps.clock, deps.diagnostic, retakeSkill, routeDiagId]);

  const hasDiagState = Boolean(diagState);
  useEffect(() => {
    if (!hasDiagState) return;
    setActiveExamLock(true, t('diagIntroTitle'));
    return () => {
      setActiveExamLock(false);
    };
  }, [hasDiagState, setActiveExamLock, t]);

  useEffect(() => {
    if (!diagState || isPaused) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [diagState, isPaused]);

  const persistProgress = useCallback(
    async (next: DiagnosticPersistedState) => {
      setDiagState(next);
      if (bank) {
        await deps.attemptStore.saveDiagnosticSession(
          serializeDiagnosticRecord(next, bank, deps.clock.nowMs()),
        );
      }
    },
    [bank, deps.attemptStore, deps.clock],
  );

  const finalizeDiagnostic = useCallback(
    async (finalState: DiagnosticPersistedState) => {
      setIsSubmitting(true);
      setErrorMsg(null);

      const res = finalState.retakeSkill
        ? await deps.diagnostic.retakeSkill(finalState.diagId, {
            skill: finalState.retakeSkill,
            ...(finalState.retakeSkill === 'reading'
              ? {
                  readingHistory: finalState.readingHistory.map((h) => ({
                    blockId: h.blockId,
                    tier: h.tier,
                    selectedOptionIndices: [...h.selectedOptionIndices],
                    ...(h.noEvidenceReason ? { noEvidenceReason: h.noEvidenceReason } : {}),
                  })),
                  readingStopReason: finalState.readingStopReason ?? 'sampling_complete',
                }
              : {}),
            ...(finalState.retakeSkill === 'listening'
              ? {
                  listeningHistory: finalState.listeningHistory.map((h) => ({
                    blockId: h.blockId,
                    tier: h.tier,
                    selectedOptionIndices: [...h.selectedOptionIndices],
                    ...(h.noEvidenceReason ? { noEvidenceReason: h.noEvidenceReason } : {}),
                  })),
                  listeningStopReason: finalState.listeningStopReason ?? 'sampling_complete',
                }
              : {}),
            ...(finalState.retakeSkill === 'writing'
              ? {
                  writing: {
                    attemptId: finalState.writingAttemptId,
                    promptTitle: bank?.writingPrompt.title ?? 'Writing Sample',
                    basePrompt: bank?.writingPrompt.basePrompt ?? '',
                    baseResponse: finalState.writingText,
                    skipped: finalState.writingSkipped,
                  },
                }
              : {}),
            ...(finalState.retakeSkill === 'speaking'
              ? {
                  speaking: {
                    attemptId: finalState.speakingAttemptId,
                    basePrompt: bank?.speakingPrompt.basePrompt ?? '',
                    turns: [...finalState.speakingTurns],
                    skipped: finalState.speakingSkipped || finalState.speakingTurns.length === 0,
                  },
                }
              : {}),
          })
        : await deps.diagnostic.submitSession(finalState.diagId, {
            examId: finalState.examId,
            mode: finalState.mode,
            readingHistory: finalState.readingHistory.map((h) => ({
              blockId: h.blockId,
              tier: h.tier,
              selectedOptionIndices: [...h.selectedOptionIndices],
              ...(h.noEvidenceReason ? { noEvidenceReason: h.noEvidenceReason } : {}),
            })),
            readingStopReason: finalState.readingStopReason,
            readingSkipped: finalState.readingSkipped,
            listeningHistory: finalState.listeningHistory.map((h) => ({
              blockId: h.blockId,
              tier: h.tier,
              selectedOptionIndices: [...h.selectedOptionIndices],
              ...(h.noEvidenceReason ? { noEvidenceReason: h.noEvidenceReason } : {}),
            })),
            listeningStopReason: finalState.listeningStopReason,
            listeningSkipped: finalState.listeningSkipped,
            writing: {
              attemptId: finalState.writingAttemptId,
              promptTitle: bank?.writingPrompt.title ?? 'Writing Sample',
              basePrompt: bank?.writingPrompt.basePrompt ?? '',
              baseResponse: finalState.writingText,
              skipped: finalState.writingSkipped || finalState.writingText.trim().length === 0,
            },
            speaking: {
              attemptId: finalState.speakingAttemptId,
              basePrompt: bank?.speakingPrompt.basePrompt ?? '',
              turns: [...finalState.speakingTurns],
              skipped: finalState.speakingSkipped || finalState.speakingTurns.length === 0,
            },
          });

      setIsSubmitting(false);
      if (!res.ok) {
        setErrorMsg(res.error.message);
        return;
      }

      const completed: DiagnosticPersistedState = {
        ...finalState,
        remoteSession: res.value,
      };
      await persistProgress(completed);
      setActiveExamLock(false);
      await navigate({
        to: '/diagnostic/result/$diagId',
        params: { diagId: completed.diagId },
      });
    },
    [bank, deps.diagnostic, navigate, persistProgress, setActiveExamLock],
  );

  const currentObjectiveSelection = useMemo(() => {
    if (!bank || !diagState) return null;
    if (diagState.currentStage !== 'reading' && diagState.currentStage !== 'listening') {
      return null;
    }
    const skill = diagState.currentStage;
    const blocks = skill === 'reading' ? bank.readingBlocks : bank.listeningBlocks;
    const history = skill === 'reading' ? diagState.readingHistory : diagState.listeningHistory;
    return pickNextAdaptiveBlock({
      skill,
      blocks,
      history,
      selectionSeed: diagState.diagId,
      remainingStageSeconds: remainingSecondsRef.current,
      remainingGlobalSeconds: remainingSecondsRef.current,
      mode: diagState.mode,
    });
  }, [bank, diagState]);

  const activeBlock: DiagnosticBlockDto | null = currentObjectiveSelection?.blockDto ?? null;

  const diagnosticAudioSource = useMemo(
    () =>
      activeBlock
        ? {
            mediaKey: activeBlock.blockId,
            fallbackUrl: activeBlock.mediaUrl ?? `/v1/media/diagnostic/${activeBlock.blockId}.m4a`,
          }
        : {
            mediaKey: 'diag-empty',
            fallbackUrl: '',
          },
    [activeBlock],
  );

  const diagnosticTranscriptSegments = useMemo(() => {
    if (diagState?.mode !== 'accessible' || !activeBlock?.scriptText) {
      return [];
    }
    return [{ id: 'diag-seg', startSec: 0, text: activeBlock.scriptText }];
  }, [activeBlock, diagState?.mode]);

  const advanceObjectiveBlock = useCallback(
    async (dontKnow: boolean) => {
      if (!diagState || !bank || !activeBlock) return;
      const skill = activeBlock.skill;
      const attempt = recordAdaptiveBlockAttempt({
        block: activeBlock,
        selectedChoices: dontKnow ? [null, null] : blockChoices,
        noEvidenceReason: dontKnow ? 'dont_know' : undefined,
      });

      const nextHistory =
        skill === 'reading'
          ? [...diagState.readingHistory, attempt]
          : [...diagState.listeningHistory, attempt];

      const blocks = skill === 'reading' ? bank.readingBlocks : bank.listeningBlocks;
      const nextProbe = pickNextAdaptiveBlock({
        skill,
        blocks,
        history: nextHistory,
        selectionSeed: diagState.diagId,
        remainingStageSeconds: remainingSeconds,
        remainingGlobalSeconds: remainingSeconds,
        mode: diagState.mode,
      });

      setBlockChoices([null, null]);

      if (nextProbe.selection.action === 'present' && nextProbe.blockDto) {
        await persistProgress({
          ...diagState,
          ...(skill === 'reading'
            ? { readingHistory: nextHistory }
            : { listeningHistory: nextHistory }),
        });
        return;
      }

      const stopReason = nextProbe.selection.stopReason ?? 'sampling_complete';
      const afterBlockState: DiagnosticPersistedState = {
        ...diagState,
        ...(skill === 'reading'
          ? { readingHistory: nextHistory, readingStopReason: stopReason }
          : { listeningHistory: nextHistory, listeningStopReason: stopReason }),
      };

      if (diagState.retakeSkill === skill) {
        await finalizeDiagnostic(afterBlockState);
        return;
      }

      const nextStage = skill === 'reading' ? 'listening' : 'writing';
      await persistProgress({ ...afterBlockState, currentStage: nextStage });
    },
    [
      activeBlock,
      bank,
      blockChoices,
      diagState,
      finalizeDiagnostic,
      persistProgress,
      remainingSeconds,
    ],
  );

  const skipStage = useCallback(async () => {
    if (!diagState) return;
    if (diagState.retakeSkill) {
      setActiveExamLock(false);
      await navigate({
        to: '/diagnostic/result/$diagId',
        params: { diagId: diagState.diagId },
      });
      return;
    }

    if (diagState.currentStage === 'reading') {
      await persistProgress({ ...diagState, readingSkipped: true, currentStage: 'listening' });
    } else if (diagState.currentStage === 'listening') {
      await persistProgress({ ...diagState, listeningSkipped: true, currentStage: 'writing' });
    } else if (diagState.currentStage === 'writing') {
      if (diagState.skipSpeaking) {
        await finalizeDiagnostic({ ...diagState, writingSkipped: true, speakingSkipped: true });
      } else {
        await persistProgress({ ...diagState, writingSkipped: true, currentStage: 'speaking' });
      }
    } else {
      await finalizeDiagnostic({ ...diagState, speakingSkipped: true });
    }
  }, [diagState, finalizeDiagnostic, navigate, persistProgress, setActiveExamLock]);

  const handleSpeakingRecordingComplete = useCallback(
    async (clip: RecordedClip) => {
      if (!diagState || !bank) return;
      setIsUploadingAudio(true);
      const uploadRes = await deps.diagnostic.uploadSpeakingTurnAudio({
        attemptId: diagState.speakingAttemptId,
        partIndex: 1,
        clip,
      });
      setIsUploadingAudio(false);

      if (!uploadRes.ok) {
        setErrorMsg(uploadRes.error.message);
        return;
      }

      await persistProgress({
        ...diagState,
        speakingSkipped: false,
        speakingTurns: [
          {
            partIndex: 1,
            promptText: bank.speakingPrompt.basePrompt,
            objectKey: uploadRes.value.objectKey,
            durationMs: clip.durationMs,
          },
        ],
      });
    },
    [bank, deps.diagnostic, diagState, persistProgress],
  );

  if (!diagState || !bank) {
    return (
      <div data-testid="diagnostic-session-screen" className="p-6 text-sm text-text-secondary">
        {errorMsg ? <MzBanner tone="danger">{errorMsg}</MzBanner> : 'Loading adaptive check...'}
      </div>
    );
  }

  const stageLabel =
    diagState.currentStage === 'reading'
      ? t('diagStageReadingLabel')
      : diagState.currentStage === 'listening'
        ? t('diagStageListeningLabel')
        : diagState.currentStage === 'writing'
          ? t('diagStageWritingLabel')
          : t('diagStageSpeakingLabel');

  const renderBody = () => {
    if (
      (diagState.currentStage === 'reading' || diagState.currentStage === 'listening') &&
      activeBlock
    ) {
      const leftStimulus =
        diagState.currentStage === 'reading' ? (
          <PassageAnnotatorPane
            title={activeBlock.title}
            rawText={activeBlock.passageText ?? ''}
            annotations={[]}
            readOnly
          />
        ) : (
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-bold text-text-primary">{activeBlock.title}</h3>
            <AudioStudioPlayer
              source={diagnosticAudioSource}
              playbackMode={
                diagState.mode === 'accessible' ? 'study_interactive' : 'exam_linear_locked'
              }
              transcriptSegments={diagnosticTranscriptSegments}
            />
          </div>
        );

      const rightQuestions = (
        <div className="flex flex-col gap-5">
          {activeBlock.questions.map((question, qIndex) => {
            const selectedIdx = blockChoices[qIndex] ?? null;
            const currentAnswerValue =
              selectedIdx !== null ? (question.options[selectedIdx] ?? '') : '';

            return (
              <MzCard key={question.questionId} variant="default" padding="md">
                <div className="mb-3 text-sm font-semibold text-text-primary">
                  <LtrExamBoundary>{`${qIndex + 1}. ${question.prompt}`}</LtrExamBoundary>
                </div>
                <MzObjectiveAnswerInput
                  question={{
                    questionId: question.questionId,
                    number: qIndex + 1,
                    questionType: 'mcq_single',
                    prompt: question.prompt,
                    options: [...question.options],
                  }}
                  value={currentAnswerValue}
                  onChange={(pickedValue) => {
                    const matchedIdx = question.options.findIndex(
                      (opt, idx) =>
                        opt === pickedValue || String.fromCharCode(65 + idx) === pickedValue,
                    );
                    setBlockChoices((prev) =>
                      qIndex === 0
                        ? [matchedIdx >= 0 ? matchedIdx : null, prev[1]]
                        : [prev[0], matchedIdx >= 0 ? matchedIdx : null],
                    );
                  }}
                />
              </MzCard>
            );
          })}
        </div>
      );

      return (
        <SplitPaneWorkspace
          viewKey={`diagnostic:${diagState.currentStage}`}
          leftPane={leftStimulus}
          rightPane={rightQuestions}
        />
      );
    }

    if (diagState.currentStage === 'writing') {
      return (
        <SplitPaneWorkspace
          viewKey="diagnostic:writing"
          leftPane={
            <MzCard variant="default">
              <h3 className="text-base font-bold text-text-primary">
                {bank.writingPrompt.title}
              </h3>
              <LtrExamBoundary>
                <p className="mt-3 text-sm leading-relaxed text-text-primary">
                  {bank.writingPrompt.basePrompt}
                </p>
              </LtrExamBoundary>
              <p className="mt-3 text-xs text-text-secondary">
                {bank.writingPrompt.suggestedWordsLabel}
              </p>
            </MzCard>
          }
          rightPane={
            <DistractionFreeEssayEditor
              value={diagState.writingText}
              onChange={(next) => {
                setDiagState((prev) => (prev ? { ...prev, writingText: next } : prev));
              }}
              examMode={diagState.mode === 'standard' ? 'exam' : 'study'}
              minWords={40}
            />
          }
        />
      );
    }

    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-5 p-6">
        <MzCard variant="hero">
          <h3 className="text-base font-bold text-text-primary">{bank.speakingPrompt.title}</h3>
          <LtrExamBoundary>
            <p className="mt-2 text-sm text-text-primary">{bank.speakingPrompt.basePrompt}</p>
            <ul className="mt-3 list-disc space-y-1 ps-5 text-xs text-text-secondary">
              {bank.speakingPrompt.cueLabels.map((cue) => (
                <li key={cue}>{cue}</li>
              ))}
            </ul>
          </LtrExamBoundary>
        </MzCard>

        <WaveformMicRecorder
          maxDurationSec={60}
          disabled={isSubmitting || isUploadingAudio}
          onRecordingComplete={(clip) => void handleSpeakingRecordingComplete(clip)}
        />
      </div>
    );
  };

  const renderFooter = () => {
    if (diagState.currentStage === 'reading' || diagState.currentStage === 'listening') {
      const answeredCount =
        (blockChoices[0] !== null ? 1 : 0) + (blockChoices[1] !== null ? 1 : 0);
      return (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <MzButton
              variant="ghost"
              size="sm"
              data-testid="diag-skip-stage-btn"
              onClick={() => void skipStage()}
            >
              {t('diagSkipStageAction')}
            </MzButton>
            <MzButton
              variant="secondary"
              size="sm"
              data-testid="diag-dont-know-btn"
              onClick={() => void advanceObjectiveBlock(true)}
            >
              {t('diagDontKnowBlockAction')}
            </MzButton>
          </div>

          <MzButton
            variant="primary"
            size="md"
            data-testid="diag-next-block-btn"
            disabled={answeredCount < 2 || isSubmitting}
            isLoading={isSubmitting}
            onClick={() => void advanceObjectiveBlock(false)}
          >
            {t('diagSubmitBlockAction')}
          </MzButton>
        </div>
      );
    }

    if (diagState.currentStage === 'writing') {
      return (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MzButton
            variant="ghost"
            size="sm"
            data-testid="diag-skip-stage-btn"
            onClick={() => void skipStage()}
          >
            {t('diagSkipStageAction')}
          </MzButton>
          <MzButton
            variant="primary"
            size="md"
            data-testid="diag-submit-writing-btn"
            isLoading={isSubmitting}
            disabled={diagState.writingText.trim().length < 20}
            onClick={async () => {
              if (diagState.retakeSkill === 'writing' || diagState.skipSpeaking) {
                await finalizeDiagnostic({
                  ...diagState,
                  writingSkipped: false,
                  speakingSkipped: diagState.skipSpeaking,
                });
              } else {
                await persistProgress({
                  ...diagState,
                  writingSkipped: false,
                  currentStage: 'speaking',
                });
              }
            }}
          >
            {t('diagSubmitWritingAction')}
          </MzButton>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MzButton
          variant="ghost"
          size="sm"
          data-testid="diag-skip-stage-btn"
          onClick={() => void skipStage()}
        >
          {t('diagSkipStageAction')}
        </MzButton>
        <MzButton
          variant="primary"
          size="md"
          data-testid="diag-finish-btn"
          isLoading={isSubmitting || isUploadingAudio}
          onClick={() =>
            void finalizeDiagnostic({
              ...diagState,
              speakingSkipped: diagState.speakingTurns.length === 0,
            })
          }
        >
          {t('diagCompleteDiagnosticAction')}
        </MzButton>
      </div>
    );
  };

  return (
    <div data-testid="diagnostic-session-screen">
      {errorMsg ? (
        <div className="mb-3">
          <MzBanner tone="danger">{errorMsg}</MzBanner>
        </div>
      ) : null}

      <SimulatorWorkspaceShell
        breadcrumb={`${t('diagIntroTitle')} · ${stageLabel}`}
        subtitle={activeBlock?.title}
        remainingSeconds={diagState.mode === 'extended' ? null : remainingSeconds}
        examMode={diagState.mode === 'standard' ? 'exam' : 'study'}
        isPaused={isPaused}
        onTogglePause={() => setIsPaused((p) => !p)}
        onRequestExit={() => void navigate({ to: '/home' })}
        footer={renderFooter()}
      >
        {renderBody()}
      </SimulatorWorkspaceShell>
    </div>
  );
}
