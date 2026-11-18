import type { SkillKind } from '@mockza/domain';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExamBundlePayload } from '@/gateways/catalog.gateway';
import { useDeps } from '@/spa/deps';
import { buildScoredObjectiveAttempt, generateUuid } from '@/spa/objective-sim-helpers';
import { useClockStore } from '@/spa/stores/clock.store';

export interface UseObjectiveSimulatorSessionOptions {
  readonly packId: string;
  readonly skill: Extract<SkillKind, 'reading' | 'listening'>;
  readonly initialExamMode?: 'exam' | 'study';
  readonly mockSessionId?: string | null;
  readonly mockStageKey?: string | null;
  readonly onMockStageComplete?: (attemptId: string) => void;
}

export function useObjectiveSimulatorSession({
  packId,
  skill,
  initialExamMode = 'exam',
  mockSessionId = null,
  mockStageKey = null,
  onMockStageComplete,
}: UseObjectiveSimulatorSessionOptions) {
  const deps = useDeps();
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      const [bundleRes, profileRes, draftRes] = await Promise.all([
        deps.catalog.ensureExamBundle(packId),
        deps.attemptStore.getUserProfile(),
        deps.attemptStore.getActiveDraft(packId, skill),
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
  }, [deps.attemptStore, deps.catalog, packId, skill]);

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

  const persistDraft = useCallback(
    (
      nextAnswers: Record<string, string>,
      nextFlags: Record<string, boolean>,
      nextIndex: number,
    ) => {
      if (!bundle) return;
      void deps.attemptStore.saveAttemptDraft({
        attemptId: attemptIdRef.current,
        packId,
        skill,
        examId: bundle.pack.examId as never,
        taskType: skill,
        draftText: '',
        wordCount: 0,
        answersJson: nextAnswers,
        flaggedQuestionIds: Object.entries(nextFlags)
          .filter(([, flagged]) => flagged)
          .map(([qId]) => qId),
        currentQuestionIndex: nextIndex,
        timerRemainingSec: remainingSeconds,
        usedStudyMode: examMode === 'study',
        mockSessionId,
        mockStageKey,
        updatedAtMs: deps.clock.nowMs(),
      });
    },
    [
      bundle,
      deps.attemptStore,
      deps.clock,
      examMode,
      mockSessionId,
      mockStageKey,
      packId,
      remainingSeconds,
      skill,
    ],
  );

  const handleAnswerChange = useCallback(
    (questionId: string, nextValue: string) => {
      setAnswersByQuestionId((prev) => {
        const updated = { ...prev, [questionId]: nextValue };
        persistDraft(updated, flaggedQuestionIds, activeQuestionIndex);
        return updated;
      });
    },
    [activeQuestionIndex, flaggedQuestionIds, persistDraft],
  );

  const toggleFlag = useCallback(
    (questionId: string) => {
      setFlaggedQuestionIds((prev) => {
        const updated = { ...prev, [questionId]: !prev[questionId] };
        persistDraft(answersByQuestionId, updated, activeQuestionIndex);
        return updated;
      });
    },
    [activeQuestionIndex, answersByQuestionId, persistDraft],
  );

  const handleSubmit = useCallback(async () => {
    if (!bundle || isSubmitting) return;
    setIsSubmitting(true);

    const nowMs = deps.clock.nowMs();
    const { record } = buildScoredObjectiveAttempt({
      attemptId: attemptIdRef.current,
      bundle,
      skill,
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
    skill,
  ]);

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

  const requestExit = useCallback(() => {
    void navigate({ to: '/home' });
  }, [navigate]);

  return {
    attemptId: attemptIdRef.current,
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
  };
}
