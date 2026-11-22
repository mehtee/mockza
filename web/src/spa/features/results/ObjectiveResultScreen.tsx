import { estimateToeflLegacy120, formatExamScoreWithUnit } from '@mockza/domain';
import { Link, useNavigate } from '@tanstack/react-router';
import { CheckCircle2, Crosshair, HelpCircle, Mic, Sparkles, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  AudioStudioPlayer,
  PassageAnnotatorPane,
  SplitPaneWorkspace,
} from '@/components/exam-kit';
import { InlineListenButton } from '@/components/speech/InlineListenButton';
import { SpeechPracticeDrawer } from '@/components/speech/SpeechPracticeDrawer';
import { PlanImpactCard } from '@/components/personalization/PlanImpactCard';
import { MzBanner, MzButton, MzCard, MzSegmentedControl } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { makePackMediaKey, type ExamBundlePayload } from '@/gateways/catalog.gateway';
import { resolveWebRoadmapStepPath } from '@/spa/roadmap-route-resolver';
import type { ExplainQuestionResponse } from '@/gateways/evaluation.gateway';
import type { CompletedAttemptRecord } from '@/gateways/storage.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import {
  resolveObjectiveEvidenceSpan,
  type StoredObjectiveSubmission,
} from '@/spa/objective-sim-helpers';

export interface ObjectiveResultScreenProps {
  readonly attemptId: string;
}

export function ObjectiveResultScreen({ attemptId }: ObjectiveResultScreenProps) {
  const deps = useDeps();
  const navigate = useNavigate();
  const t = createTranslator(deps.edition);

  const [attempt, setAttempt] = useState<CompletedAttemptRecord | null>(null);
  const [bundle, setBundle] = useState<ExamBundlePayload | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'incorrect' | 'flagged'>('all');
  const [evidenceRequest, setEvidenceRequest] = useState<{
    readonly questionId: string;
    readonly seq: number;
    readonly replay?: boolean;
  } | null>(null);
  const [loadingBundle, setLoadingBundle] = useState(true);
  const [explanationsByQId, setExplanationsByQId] = useState<
    Record<string, ExplainQuestionResponse>
  >({});
  const [loadingQuestionId, setLoadingQuestionId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shadowTarget, setShadowTarget] = useState<{
    readonly text: string;
    readonly questionId: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      const attemptRes = await deps.attemptStore.getAttemptById(attemptId);
      if (!mounted) return;
      if (!attemptRes.ok || !attemptRes.value) {
        setLoadingBundle(false);
        return;
      }
      setAttempt(attemptRes.value);
      const bundleRes = await deps.catalog.ensureExamBundle(
        attemptRes.value.packId,
        attemptRes.value.contentVersion ?? undefined,
      );
      if (!mounted) return;
      if (
        bundleRes.ok &&
        (attemptRes.value.contentVersion == null ||
          bundleRes.value.pack.version === attemptRes.value.contentVersion)
      ) {
        setBundle(bundleRes.value);
      }
      setLoadingBundle(false);
    }
    void hydrate();
    return () => {
      mounted = false;
    };
  }, [attemptId, deps.attemptStore, deps.catalog]);

  const submission = useMemo(() => {
    if (!attempt) return null;
    try {
      const stored = JSON.parse(attempt.submissionJson) as StoredObjectiveSubmission;
      return stored?.answersByQuestionId && stored.questionCorrectness ? stored : null;
    } catch {
      return null;
    }
  }, [attempt]);

  const sortedQuestions = useMemo(
    () => [...(submission?.reviewQuestions ?? bundle?.questions ?? [])]
      .sort((a, b) => a.questionNumber - b.questionNumber),
    [submission, bundle],
  );
  const firstMiss = sortedQuestions.find(
    (q) => submission?.questionCorrectness[q.questionId] !== true,
  );
  const activeQuestion =
    sortedQuestions.find((q) => q.questionId === evidenceRequest?.questionId) ??
    firstMiss ??
    sortedQuestions[0];
  const activeSection =
    bundle?.sections.find((s) => s.sectionId === activeQuestion?.sectionId) ?? null;
  const activeSpan = activeSection
    ? resolveObjectiveEvidenceSpan(activeSection.contentText, activeQuestion?.evidence)
    : null;
  const cueMs = activeQuestion?.cueTimestampMs;
  const cueLine = activeSection?.transcript?.find(
    (line) => cueMs != null && line.startMs <= cueMs && cueMs < line.endMs,
  );
  const mediaUrl = activeSection?.mediaUrl ??
    (activeSection === bundle?.sections[0] ? bundle?.pack.mediaUrl : null);
  const reviewTranscriptSegments = useMemo(
    () =>
      activeSection?.transcript?.map((line, i) => ({
        id: `tr-${i}`,
        startSec: line.startMs / 1000,
        endSec: line.endMs / 1000,
        speaker: line.speaker,
        text: line.text,
      })) ?? [],
    [activeSection],
  );

  if (!attempt || !submission) {
    return (
      <div data-testid="objective-result-screen" className="p-6 text-sm text-text-secondary">
        {errorMsg || !loadingBundle || (attempt && !submission)
          ? <MzBanner tone="danger">{errorMsg ?? t('objResultUnavailable')}</MzBanner>
          : t('objResultLoading')}
      </div>
    );
  }

  const flaggedSet = new Set(submission.flaggedQuestionIds ?? []);
  const reviewOrder = firstMiss
    ? [firstMiss, ...sortedQuestions.filter((question) => question !== firstMiss)]
    : sortedQuestions;
  const filteredQuestions =
    filterMode === 'incorrect'
      ? reviewOrder.filter((q) => submission.questionCorrectness[q.questionId] !== true)
      : filterMode === 'flagged'
        ? reviewOrder.filter((q) => flaggedSet.has(q.questionId))
        : reviewOrder;

  const handleAskAiWhy = async (question: ExamBundlePayload['questions'][number]) => {
    if (!bundle) return;
    setLoadingQuestionId(question.questionId);
    const res = await deps.evaluation.explainObjectiveQuestion({
      packId: bundle.pack.packId,
      packVersion: bundle.pack.version,
      questionId: question.questionId,
      skill: attempt.skill === 'listening' ? 'listening' : 'reading',
      questionType: question.questionType,
      userAnswer: submission.answersByQuestionId[question.questionId] ?? '',
      edition: deps.edition,
    });
    setLoadingQuestionId(null);

    if (!res.ok) {
      setErrorMsg(res.error.message);
      return;
    }

    setExplanationsByQId((prev) => ({
      ...prev,
      [question.questionId]: res.value,
    }));
  };

  const drillId = attempt.examId.startsWith('ielts_') && firstMiss
    ? attempt.skill === 'listening' ? 'ielts-micro-drill-03' : 'ielts-micro-drill-04'
    : null;

  return (
    <div
      data-testid="objective-result-screen"
      className="mx-auto flex h-[calc(100dvh-2rem)] min-h-[600px] max-w-7xl flex-col gap-4 pb-4 text-start"
    >
      {/* Top Hero Summary */}
      <MzCard variant="hero" padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <h1 className="font-editorial text-3xl text-text-primary">
                {submission.packTitle ?? bundle?.pack.title ?? t('objResultTitle')}
              </h1>
              <div className="mt-1 flex flex-wrap items-baseline gap-3">
                <LtrExamBoundary>
                  <span
                    data-testid="objective-result-band"
                    className="font-mono-exam text-2xl font-bold text-primary"
                  >
                    {attempt.overallBand !== null
                      ? formatExamScoreWithUnit(attempt.overallBand, attempt.examId)
                      : '—'}
                  </span>
                </LtrExamBoundary>
                {attempt.examId === 'toefl_ibt' && attempt.overallBand !== null ? (
                  <span className="font-mono-exam text-xs font-semibold text-focus">
                    ~{estimateToeflLegacy120(attempt.overallBand)}/120
                  </span>
                ) : null}
                <span className="text-xs font-semibold text-text-primary">
                  {t('objResultAccuracyLabel', {
                    correct: submission.correctCount,
                    total: submission.totalCount,
                    percent: submission.accuracyPercent,
                  })}
                </span>
                <span className="rounded-[var(--mz-radius-pill)] border border-border-subtle bg-canvas/70 px-2.5 py-0.5 text-[11px] font-semibold text-text-secondary">
                  {attempt.isCalibratedFullPack
                    ? t('objResultCalibratedBadge')
                    : t('objResultSampleBadge')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <MzSegmentedControl<'all' | 'incorrect' | 'flagged'>
              ariaLabel={t('objResultFilterAll')}
              value={filterMode}
              onChange={setFilterMode}
              options={[
                { value: 'all', label: t('objResultFilterAll') },
                { value: 'incorrect', label: t('objResultFilterIncorrect') },
                { value: 'flagged', label: t('objResultFilterFlagged') },
              ]}
            />
            <Link
              to="/home"
              data-testid="objective-result-home-link"
              className="inline-flex h-8 items-center justify-center rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-3 text-xs font-semibold text-text-primary hover:bg-surface-hover"
            >
              {t('objResultBackHomeAction')}
            </Link>
          </div>
        </div>
      </MzCard>

      {errorMsg ? <MzBanner tone="danger">{errorMsg}</MzBanner> : null}

      <PlanImpactCard
        skill={attempt.skill === 'listening' ? 'listening' : 'reading'}
        scoreBand={attempt.overallBand}
        onOpenNextStep={(step) => void navigate({ to: resolveWebRoadmapStepPath(step) as never })}
        onOpenRoadmap={() => void navigate({ to: '/roadmap' })}
      />

      {!loadingBundle && !bundle ? (
        <MzBanner tone="info">{t('objResultSourceUnavailable')}</MzBanner>
      ) : null}

      {/* Master-Detail Split Review Pane */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-[var(--mz-radius-card)] border border-border-subtle bg-canvas">
        <SplitPaneWorkspace
          viewKey="review:objective"
          initialRatio={0.5}
          leftLabel={t('objResultSourceTitle')}
          rightLabel={t('objResultTitle')}
          leftPane={
            attempt.skill === 'listening' ? (
              <div className="flex flex-col gap-4">
                <h2 className="text-base font-bold text-text-primary">{activeSection?.title}</h2>
                {mediaUrl && activeSection ? (
                  <AudioStudioPlayer
                    source={{
                      mediaKey: makePackMediaKey(attempt.packId, mediaUrl),
                      fallbackUrl: mediaUrl,
                    }}
                    playbackMode="study_interactive"
                    externalSeekRequest={
                      cueMs != null
                        ? {
                            sec: cueMs / 1000,
                            seq: evidenceRequest?.seq ?? 0,
                            replayEndSec: evidenceRequest?.replay && cueLine
                              ? cueLine.endMs / 1000
                              : undefined,
                          }
                        : null
                    }
                    transcriptSegments={reviewTranscriptSegments}
                  />
                ) : null}
              </div>
            ) : (
              <PassageAnnotatorPane
                title={activeSection?.title}
                rawText={activeSection?.contentText ?? ''}
                annotations={[]}
                evidenceSpan={activeSpan}
                allowSpeechPractice
                packId={attempt.packId}
              />
            )
          }
          rightPane={
            <div className="flex flex-col gap-3">
              {filteredQuestions.length === 0 ? (
                <MzBanner tone="info">
                  {sortedQuestions.length && filterMode === 'incorrect'
                    ? t('objResultReviewAllPassMessage')
                    : t('objResultNoQuestions')}
                </MzBanner>
              ) : (
                filteredQuestions.map((question) => {
                  const isCorrect = submission.questionCorrectness[question.questionId] === true;
                  const userAns = (submission.answersByQuestionId[question.questionId] ?? '').trim();
                  const acceptedText = question.acceptedAnswers.join(' / ');
                  const aiExplain = explanationsByQId[question.questionId];
                  const evidence = question.evidence;
                  const notes = [
                    evidence?.['rationale'],
                    evidence?.['distractorNote'] ?? evidence?.['distractorExplanation'],
                    evidence?.['notGivenOmissionReason'],
                  ]
                    .filter((value): value is string => typeof value === 'string' && value.trim() !== '');
                  const quote = evidence?.['exactQuote'];
                  const source = bundle?.sections.find((section) => section.sectionId === question.sectionId);
                  const hasCue = question.cueTimestampMs != null;
                  const hasSource = source && (attempt.skill === 'listening'
                    ? hasCue && Boolean(source.mediaUrl ?? (source === bundle?.sections[0] ? bundle?.pack.mediaUrl : null))
                    : Boolean(resolveObjectiveEvidenceSpan(source.contentText, evidence)));


                  return (
                    <MzCard
                      key={question.questionId}
                      variant="default"
                      data-testid={`result-question-card-${question.questionNumber}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-semibold text-text-primary">
                          <LtrExamBoundary>
                            {`${question.questionNumber}. ${question.prompt}`}
                          </LtrExamBoundary>
                        </div>
                        <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${isCorrect ? 'text-success' : 'text-error'}`}>
                          {isCorrect
                            ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                            : <XCircle className="h-4 w-4" aria-hidden="true" />}
                          {t(isCorrect ? 'objResultCorrect' : userAns ? 'objResultMissed' : 'objResultSkipped')}
                        </span>
                      </div>

                      <div className="mt-2.5 flex flex-wrap gap-3 text-xs">
                        <span className={isCorrect ? 'text-success font-medium' : 'text-error font-medium'}>
                          {t('objResultYourAnswerLabel')}:{' '}
                          <LtrExamBoundary>
                            <span className="font-mono-exam">
                              {userAns || t('objResultNoAnswerFallback')}
                            </span>
                          </LtrExamBoundary>
                        </span>
                        {!isCorrect ? (
                          <span className="text-text-secondary">
                            {t('objResultCorrectAnswerLabel')}:{' '}
                            <LtrExamBoundary>
                              <span className="font-mono-exam font-semibold text-text-primary">
                                {acceptedText}
                              </span>
                            </LtrExamBoundary>
                          </span>
                        ) : null}
                      </div>

                      {typeof quote === 'string' && quote ? (
                        <div className="mt-3 space-y-2 border-s-2 border-primary bg-surface-alt p-3">
                          <blockquote className="text-sm text-text-primary" dir="ltr">
                            {quote}
                          </blockquote>
                          <div className="flex flex-wrap items-center gap-2">
                            <InlineListenButton
                              text={quote}
                              sourceContext={attempt.skill === 'listening' ? 'listening_feedback' : 'reading'}
                              testId={`result-quote-listen-${question.questionNumber}`}
                              size="sm"
                            />
                            <button
                              type="button"
                              data-testid={`result-quote-practice-${question.questionNumber}`}
                              onClick={() =>
                                setShadowTarget({
                                  text: quote,
                                  questionId: question.questionId,
                                })
                              }
                              className="inline-flex h-7 items-center gap-1 rounded-[var(--mz-radius-compact)] border border-primary/40 bg-canvas px-2 text-[11px] font-semibold text-primary hover:bg-surface-hover"
                            >
                              <Mic className="h-3 w-3" aria-hidden="true" />
                              <span>{t('speechPracticeBtn')}</span>
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {notes.length > 0 ? (
                        <div className="mt-3 space-y-1 text-sm text-text-secondary" dir="ltr">
                          {[...new Set(notes)].map((note) => <p key={note}>{note}</p>)}
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {hasSource ? <MzButton
                          variant="secondary"
                          size="sm"
                          data-testid={`jump-evidence-${question.questionNumber}`}
                          leadingIcon={<Crosshair className="h-3.5 w-3.5" aria-hidden="true" />}
                          onClick={() => setEvidenceRequest((prev) => ({
                            questionId: question.questionId,
                            seq: (prev?.seq ?? 0) + 1,
                          }))}
                        >
                          {t(attempt.skill === 'listening' ? 'objResultReplay' : 'objResultJumpEvidenceAction')}
                        </MzButton> : null}
                        {attempt.skill === 'listening' && hasSource &&
                        source?.transcript?.some((line) =>
                          question.cueTimestampMs != null &&
                          line.startMs <= question.cueTimestampMs &&
                          question.cueTimestampMs < line.endMs,
                        ) ? (
                          <MzButton
                            variant="secondary"
                            size="sm"
                            onClick={() => setEvidenceRequest((prev) => ({
                              questionId: question.questionId,
                              seq: (prev?.seq ?? 0) + 1,
                              replay: true,
                            }))}
                          >
                            {t('objResultReplayClip')}
                          </MzButton>
                        ) : null}
                        {bundle ? <MzButton
                          variant="secondary"
                          size="sm"
                          data-testid={`ask-ai-why-${question.questionNumber}`}
                          isLoading={loadingQuestionId === question.questionId}
                          leadingIcon={<HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                          onClick={() => void handleAskAiWhy(question)}
                        >
                          {loadingQuestionId === question.questionId
                            ? t('objResultLoadingTutorLabel')
                            : t('objResultAskAiWhyAction')}
                        </MzButton> : null}
                      </div>

                      {aiExplain ? (
                        <div
                          data-testid={`ai-explanation-${question.questionNumber}`}
                          className="mt-3 rounded-[var(--mz-radius-compact)] border border-primary/40 bg-surface-alt p-3 text-xs"
                        >
                          <p className="inline-flex items-center gap-1 font-bold text-primary">
                            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{t('objResultAskAiWhyAction')}</span>
                          </p>
                          <p className="mt-1.5 leading-relaxed text-text-primary">
                            {aiExplain.explanation}
                          </p>
                          {aiExplain.evidenceQuote ? (
                            <blockquote className="mt-2 border-s-2 border-primary ps-2.5 italic text-text-secondary">
                              {aiExplain.evidenceQuote}
                            </blockquote>
                          ) : null}
                          {aiExplain.whyWrongOptions.length > 0 ? (
                            <ul className="mt-2 space-y-1 text-text-secondary">
                              {aiExplain.whyWrongOptions.map((item) => (
                                <li key={item.option}>
                                  <strong>{item.option}:</strong> {item.reason}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ) : null}
                    </MzCard>
                  );
                })
              )}
            </div>
          }
        />
      </div>
      <MzCard variant="default" padding="sm" className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-editorial text-xl">{t('objResultNextStep')}</h2>
        {drillId ? (
          <Link
            to="/practice/drills/$drillId"
            params={{ drillId }}
            search={{ track: attempt.examId }}
            className="font-semibold text-primary underline"
          >
            {t(attempt.skill === 'listening' ? 'objResultListeningDrill' : 'objResultReadingDrill')}
          </Link>
        ) : (
          <Link
            to="/practice"
            search={{ track: attempt.examId, skill: attempt.skill === 'listening' ? 'listening' : 'reading' }}
            className="font-semibold text-primary underline"
          >
            {t('objResultAnotherSet')}
          </Link>
        )}
      </MzCard>

      <SpeechPracticeDrawer
        open={shadowTarget !== null}
        onClose={() => setShadowTarget(null)}
        targetText={shadowTarget?.text ?? ''}
        practiceKind="feedback_shadow"
        sourceRefType={attempt?.skill === 'listening' ? 'listening_feedback' : 'reading_passage'}
        sourceRefId={shadowTarget?.questionId}
        examTrack={attempt?.examId}
      />
    </div>
  );
}
