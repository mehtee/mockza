import {
  EXAM_TRACK_SPECS,
  resolveExamTrackForPackOrProfile,
  scoreObjectiveAnswers,
  type SkillKind,
  type SupportedExamId,
} from '@mockza/domain';
import type { PassageEvidenceSpan } from '@/components/exam-kit';
import type { ExamBundlePayload } from '@/gateways/catalog.gateway';
import type { AttemptDraftRecord, CompletedAttemptRecord } from '@/gateways/storage.gateway';

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return '00000000-0000-4000-8000-000000000000'.replace(/[0]/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
}

export interface StoredObjectiveSubmission {
  readonly answersByQuestionId: Readonly<Record<string, string>>;
  readonly questionCorrectness: Readonly<Record<string, boolean>>;
  readonly correctCount: number;
  readonly totalCount: number;
  readonly accuracyPercent: number;
  readonly isCalibratedFullPack: boolean;
}

export function resolveObjectiveEvidenceSpan(
  sectionText: string,
  evidence: Record<string, unknown> | null | undefined,
): PassageEvidenceSpan | null {
  if (!evidence || sectionText.length === 0) return null;

  const rawStart = evidence['startOffset'];
  const rawEnd = evidence['endOffset'];
  if (
    typeof rawStart === 'number' &&
    typeof rawEnd === 'number' &&
    Number.isInteger(rawStart) &&
    Number.isInteger(rawEnd) &&
    rawEnd > rawStart &&
    rawEnd <= sectionText.length
  ) {
    return {
      startOffset: rawStart,
      endOffset: rawEnd,
      label: typeof evidence['paragraph'] === 'string' ? evidence['paragraph'] : undefined,
    };
  }

  const exactQuote = evidence['exactQuote'];
  if (typeof exactQuote === 'string' && exactQuote.trim().length > 0) {
    const foundIndex = sectionText.indexOf(exactQuote);
    if (foundIndex >= 0) {
      return {
        startOffset: foundIndex,
        endOffset: foundIndex + exactQuote.length,
        label: typeof evidence['paragraph'] === 'string' ? evidence['paragraph'] : undefined,
      };
    }
  }

  return null;
}

export function buildScoredObjectiveAttempt(params: {
  readonly attemptId: string;
  readonly bundle: ExamBundlePayload;
  readonly skill: Extract<SkillKind, 'reading' | 'listening'>;
  readonly profileExamId: string;
  readonly answersByQuestionId: Readonly<Record<string, string>>;
  readonly startedAtUtcMs: number;
  readonly nowMs: number;
  readonly usedStudyMode: boolean;
  readonly mockSessionId?: string | null;
  readonly mockStageKey?: string | null;
}): {
  readonly record: CompletedAttemptRecord;
  readonly resolvedTrack: SupportedExamId;
} {
  const resolvedTrack = resolveExamTrackForPackOrProfile({
    packId: params.bundle.pack.packId,
    profileExamId: params.profileExamId,
  });
  const moduleType = EXAM_TRACK_SPECS[resolvedTrack].isIelts
    ? resolvedTrack === 'ielts_general'
      ? 'general_training'
      : 'academic'
    : 'academic';

  const scoreReport = scoreObjectiveAnswers({
    skill: params.skill,
    track: resolvedTrack,
    moduleType,
    answers: params.bundle.questions.map((q) => ({
      questionId: q.questionId,
      acceptedAnswers: q.acceptedAnswers,
      userAnswer: params.answersByQuestionId[q.questionId] ?? '',
      maxWords: q.maxWords ?? undefined,
      questionType: q.questionType,
    })),
  });

  const submissionPayload: StoredObjectiveSubmission = {
    answersByQuestionId: params.answersByQuestionId,
    questionCorrectness: scoreReport.questionCorrectness,
    correctCount: scoreReport.correctCount,
    totalCount: scoreReport.totalCount,
    accuracyPercent: scoreReport.accuracyPercent,
    isCalibratedFullPack: scoreReport.isCalibratedFullPack,
  };

  const durationSeconds = Math.max(
    1,
    Math.round((params.nowMs - params.startedAtUtcMs) / 1000),
  );

  const record: CompletedAttemptRecord = {
    attemptId: params.attemptId,
    examId: resolvedTrack,
    packId: params.bundle.pack.packId,
    skill: params.skill,
    status: 'completed',
    syncStatus: 'pending',
    remoteJobId: null,
    submissionJson: JSON.stringify(submissionPayload),
    evaluationJson: null,
    overallBand: scoreReport.bandScore,
    errorCode: null,
    startedAtUtcMs: params.startedAtUtcMs,
    completedAtMs: params.nowMs,
    durationSeconds,
    usedStudyMode: params.usedStudyMode,
    questionCount: params.bundle.questions.length,
    isCalibratedFullPack: scoreReport.isCalibratedFullPack,
    contentVersion: params.bundle.pack.version,
    mockSessionId: params.mockSessionId ?? null,
    mockStageKey: params.mockStageKey ?? null,
    updatedAtMs: params.nowMs,
  };

  return { record, resolvedTrack };
}

/**
 * Registers `pagehide` and `visibilitychange` (hidden) listeners to trigger synchronous
 * best-effort draft persistence without bypassing gateway boundaries.
 */
export function registerSpaUrgentDraftListeners(
  getDraft: () => AttemptDraftRecord | null,
  flush: (draft: AttemptDraftRecord) => void,
): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }
  const handlePageHide = (): void => {
    const draft = getDraft();
    if (draft !== null) {
      flush(draft);
    }
  };
  const handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      const draft = getDraft();
      if (draft !== null) {
        flush(draft);
      }
    }
  };
  window.addEventListener('pagehide', handlePageHide);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => {
    window.removeEventListener('pagehide', handlePageHide);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
