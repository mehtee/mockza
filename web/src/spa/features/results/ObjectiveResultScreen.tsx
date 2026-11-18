import { estimateToeflLegacy120, formatExamScoreWithUnit } from '@mockza/domain';
import { Link } from '@tanstack/react-router';
import { CheckCircle2, Crosshair, HelpCircle, Sparkles, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  AudioStudioPlayer,
  PassageAnnotatorPane,
  type PassageEvidenceSpan,
  SplitPaneWorkspace,
} from '@/components/exam-kit';
import { MzBanner, MzButton, MzCard, MzSegmentedControl } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { ExamBundlePayload } from '@/gateways/catalog.gateway';
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
  const t = createTranslator(deps.edition);

  const [attempt, setAttempt] = useState<CompletedAttemptRecord | null>(null);
  const [bundle, setBundle] = useState<ExamBundlePayload | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'incorrect'>('all');
  const [activeEvidence, setActiveEvidence] = useState<{
    readonly sectionId: string;
    readonly span: PassageEvidenceSpan | null;
    readonly cueSec: number | null;
    readonly seq: number;
  } | null>(null);
  const [explanationsByQId, setExplanationsByQId] = useState<
    Record<string, ExplainQuestionResponse>
  >({});
  const [loadingQuestionId, setLoadingQuestionId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      const attemptRes = await deps.attemptStore.getAttemptById(attemptId);
      if (!mounted) return;
      if (!attemptRes.ok || !attemptRes.value) {
        setErrorMsg('Attempt not found locally.');
        return;
      }
      setAttempt(attemptRes.value);
      const bundleRes = await deps.catalog.ensureExamBundle(attemptRes.value.packId);
      if (!mounted) return;
      if (bundleRes.ok) {
        setBundle(bundleRes.value);
      } else {
        setErrorMsg(bundleRes.error.message);
      }
    }
    void hydrate();
    return () => {
      mounted = false;
    };
  }, [attemptId, deps.attemptStore, deps.catalog]);

  if (!attempt || !bundle) {
    return (
      <div data-testid="objective-result-screen" className="p-6 text-sm text-text-secondary">
        {errorMsg ? <MzBanner tone="danger">{errorMsg}</MzBanner> : 'Loading attempt review...'}
      </div>
    );
  }

  let submission: StoredObjectiveSubmission = {
    answersByQuestionId: {},
    questionCorrectness: {},
    correctCount: 0,
    totalCount: bundle.questions.length,
    accuracyPercent: 0,
    isCalibratedFullPack: attempt.isCalibratedFullPack,
  };
  try {
    submission = JSON.parse(attempt.submissionJson) as StoredObjectiveSubmission;
  } catch {
    // Keep defaults on parse failure.
  }

  const sortedQuestions = [...bundle.questions].sort((a, b) => a.questionNumber - b.questionNumber);
  const filteredQuestions =
    filterMode === 'incorrect'
      ? sortedQuestions.filter((q) => submission.questionCorrectness[q.questionId] !== true)
      : sortedQuestions;

  const activeSection =
    bundle.sections.find((s) => s.sectionId === activeEvidence?.sectionId) ??
    bundle.sections[0] ??
    null;

  const handleAskAiWhy = async (question: ExamBundlePayload['questions'][number]) => {
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

  const handleJumpEvidence = (question: ExamBundlePayload['questions'][number]) => {
    const section =
      bundle.sections.find((s) => s.sectionId === question.sectionId) ?? bundle.sections[0];
    if (!section) return;
    const span = resolveObjectiveEvidenceSpan(section.contentText, question.evidence);
    setActiveEvidence((prev) => ({
      sectionId: section.sectionId,
      span,
      cueSec: question.cueTimestampMs ? Math.round(question.cueTimestampMs / 1000) : null,
      seq: (prev?.seq ?? 0) + 1,
    }));
  };

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
              <p className="text-xs font-semibold text-text-secondary">
                {t('objResultTitle')} · {bundle.pack.title}
              </p>
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
            <MzSegmentedControl<'all' | 'incorrect'>
              ariaLabel="Filter Questions"
              value={filterMode}
              onChange={setFilterMode}
              options={[
                { value: 'all', label: t('objResultFilterAll') },
                { value: 'incorrect', label: t('objResultFilterIncorrect') },
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

      {/* Master-Detail Split Review Pane */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-[var(--mz-radius-card)] border border-border-subtle bg-canvas">
        <SplitPaneWorkspace
          viewKey="review:objective"
          initialRatio={0.5}
          leftLabel="Source Evidence"
          rightLabel="Questions & AI Tutor"
          leftPane={
            attempt.skill === 'listening' ? (
              <div className="flex flex-col gap-4">
                <h2 className="text-base font-bold text-text-primary">{activeSection?.title}</h2>
                <AudioStudioPlayer
                  source={{
                    mediaKey: `${bundle.pack.packId}:${activeSection?.sectionId ?? 'main'}`,
                    fallbackUrl: activeSection?.mediaUrl ?? bundle.pack.mediaUrl ?? '',
                  }}
                  playbackMode="study_interactive"
                  externalSeekRequest={
                    activeEvidence?.cueSec !== null && activeEvidence?.cueSec !== undefined
                      ? { sec: activeEvidence.cueSec, seq: activeEvidence.seq }
                      : null
                  }
                  transcriptSegments={
                    activeSection?.transcript?.map((line, i) => ({
                      id: `tr-${i}`,
                      startSec: Math.round(line.startMs / 1000),
                      endSec: Math.round(line.endMs / 1000),
                      speaker: line.speaker,
                      text: line.text,
                    })) ?? []
                  }
                />
              </div>
            ) : (
              <PassageAnnotatorPane
                title={activeSection?.title}
                rawText={activeSection?.contentText ?? ''}
                annotations={[]}
                evidenceSpan={activeEvidence?.span ?? null}
                readOnly
              />
            )
          }
          rightPane={
            <div className="flex flex-col gap-3">
              {filteredQuestions.length === 0 ? (
                <MzBanner tone="success">{t('objResultReviewAllPassMessage')}</MzBanner>
              ) : (
                filteredQuestions.map((question) => {
                  const isCorrect = submission.questionCorrectness[question.questionId] === true;
                  const userAns = (submission.answersByQuestionId[question.questionId] ?? '').trim();
                  const acceptedText = question.acceptedAnswers.join(' / ');
                  const aiExplain = explanationsByQId[question.questionId];

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
                        {isCorrect ? (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                        ) : (
                          <XCircle className="h-5 w-5 shrink-0 text-error" aria-hidden="true" />
                        )}
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

                      <div className="mt-3 flex flex-wrap gap-2">
                        <MzButton
                          variant="secondary"
                          size="sm"
                          data-testid={`jump-evidence-${question.questionNumber}`}
                          leadingIcon={<Crosshair className="h-3.5 w-3.5" aria-hidden="true" />}
                          onClick={() => handleJumpEvidence(question)}
                        >
                          {t('objResultJumpEvidenceAction')}
                        </MzButton>
                        <MzButton
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
                        </MzButton>
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
    </div>
  );
}
