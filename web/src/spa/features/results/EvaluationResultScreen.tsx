import {
  computeDetSubscores,
  estimateToeflLegacy120,
  formatExamScoreWithUnit,
  type SupportedExamId,
} from '@mockza/domain';
import { Link } from '@tanstack/react-router';
import { BookmarkPlus, CheckCircle2, Flame, GitCompare, Sparkles } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { SplitPaneWorkspace } from '@/components/exam-kit';
import { MzBanner, MzButton, MzCard } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { CompletedAttemptRecord, EvaluationOutputDto } from '@/gateways/storage.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import { generateUuid } from '@/spa/objective-sim-helpers';

export interface EvaluationResultScreenProps {
  readonly id: string;
}

interface TextSlice {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly text: string;
  readonly edit: NonNullable<EvaluationOutputDto['inlineEdits']>[number] | null;
}

function buildInlineEditSlices(
  rawText: string,
  edits: NonNullable<EvaluationOutputDto['inlineEdits']>,
): readonly TextSlice[] {
  if (!rawText) return [];
  const valid = edits
    .filter((e) => e.startOffset >= 0 && e.endOffset > e.startOffset && e.endOffset <= rawText.length)
    .sort((a, b) => a.startOffset - b.startOffset);

  if (valid.length === 0) {
    return [{ startOffset: 0, endOffset: rawText.length, text: rawText, edit: null }];
  }

  const slices: TextSlice[] = [];
  let cursor = 0;
  for (const edit of valid) {
    if (edit.startOffset < cursor) continue;
    if (edit.startOffset > cursor) {
      slices.push({
        startOffset: cursor,
        endOffset: edit.startOffset,
        text: rawText.slice(cursor, edit.startOffset),
        edit: null,
      });
    }
    slices.push({
      startOffset: edit.startOffset,
      endOffset: edit.endOffset,
      text: rawText.slice(edit.startOffset, edit.endOffset),
      edit,
    });
    cursor = edit.endOffset;
  }
  if (cursor < rawText.length) {
    slices.push({
      startOffset: cursor,
      endOffset: rawText.length,
      text: rawText.slice(cursor),
      edit: null,
    });
  }
  return slices;
}

export function EvaluationResultScreen({ id }: EvaluationResultScreenProps) {
  const deps = useDeps();
  const t = createTranslator(deps.edition);

  const [attempt, setAttempt] = useState<CompletedAttemptRecord | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationOutputDto | null>(null);
  const [examId, setExamId] = useState<SupportedExamId>('ielts_academic');
  const [submittedEssay, setSubmittedEssay] = useState<string>('');
  const [selectedEditId, setSelectedEditId] = useState<string | null>(null);
  const [addedVocabIds, setAddedVocabIds] = useState<Record<string, boolean>>({});
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      const [attemptRes, byAttemptRes, byEvalRes] = await Promise.all([
        deps.attemptStore.getAttemptById(id),
        deps.attemptStore.getEvaluationResultByAttemptId(id),
        deps.attemptStore.getEvaluationResultById(id),
      ]);
      if (!mounted) return;

      const att = attemptRes.ok ? attemptRes.value : null;
      const evRecord = (byAttemptRes.ok && byAttemptRes.value) || (byEvalRes.ok && byEvalRes.value) || null;
      if (att) {
        setAttempt(att);
        setExamId(att.examId);
        try {
          const parsedSub = JSON.parse(att.submissionJson) as { readonly essayText?: string };
          if (typeof parsedSub.essayText === 'string') {
            setSubmittedEssay(parsedSub.essayText);
          }
        } catch {
          // Ignore invalid JSON
        }
      }

      if (evRecord) {
        setEvaluation(evRecord.resultJson);
        if (!att) setExamId(evRecord.examId);
        return;
      }

      if (att?.evaluationJson) {
        try {
          setEvaluation(JSON.parse(att.evaluationJson) as EvaluationOutputDto);
          return;
        } catch {
          // Fallback to job poll
        }
      }

      const pollRes = await deps.evaluation.pollEvaluationJob(id);
      if (!mounted) return;
      if (pollRes.ok && pollRes.value.status === 'completed' && pollRes.value.result) {
        setEvaluation(pollRes.value.result);
      } else {
        setErrorMsg('Evaluation report not found locally.');
      }
    }
    void hydrate();
    return () => {
      mounted = false;
    };
  }, [deps.attemptStore, deps.evaluation, id]);

  const inlineEdits = useMemo(() => evaluation?.inlineEdits ?? [], [evaluation?.inlineEdits]);
  const textSlices = useMemo(
    () => buildInlineEditSlices(submittedEssay, inlineEdits),
    [inlineEdits, submittedEssay],
  );
  const selectedEdit =
    inlineEdits.find((e) => e.editId === selectedEditId) ?? inlineEdits[0] ?? null;

  const handleAddVocabUpgrade = async (
    item: NonNullable<EvaluationOutputDto['vocabUpgrades']>[number],
  ) => {
    const nowMs = deps.clock.nowMs();
    await deps.vocabStore.upsertMistakeCard({
      cardId: generateUuid(),
      examId,
      headword: item.term,
      ipa: item.ipa ?? null,
      definition: item.definition,
      glossFa: item.glossFa ?? null,
      topicTag: 'evaluation_upgrade',
      sourceKind: 'mistake_to_deck',
      tags: ['ai_upgrade', examId],
      contextSentence: item.contextSentence,
      paraphraseHints: [...item.paraphrases],
      usageNote: item.bandRationale,
      sourceSkill: attempt?.skill ?? (evaluation?.transcriptSegments ? 'speaking' : 'writing'),
      sourceAttemptId: attempt?.attemptId ?? evaluation?.attemptId ?? id,
      sourceRefLabel: evaluation?.modelRewrite?.title ?? 'AI Upgrade',
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    });
    setAddedVocabIds((prev) => ({ ...prev, [item.id]: true }));
    setStatusToast(t('simBookmarkSavedToast', { word: item.term }));
  };

  if (!evaluation) {
    return (
      <div data-testid="evaluation-result-screen" className="p-6 text-sm text-text-secondary">
        {errorMsg ? <MzBanner tone="danger">{errorMsg}</MzBanner> : 'Loading AI evaluation report...'}
      </div>
    );
  }

  const detSubscores =
    examId === 'det'
      ? computeDetSubscores({
          reading: evaluation.overallBand,
          listening: evaluation.overallBand,
          writing: evaluation.overallBand,
          speaking: evaluation.overallBand,
        })
      : null;

  return (
    <div
      data-testid="evaluation-result-screen"
      className="mx-auto flex h-[calc(100dvh-2rem)] min-h-[620px] max-w-7xl flex-col gap-4 pb-4 text-start"
    >
      {statusToast ? <MzBanner tone="success">{statusToast}</MzBanner> : null}

      {/* Top Hero Header */}
      <MzCard variant="hero" padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-text-secondary">{t('evalResultTitle')}</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <LtrExamBoundary>
                <span
                  data-testid="eval-result-overall-band"
                  className="font-mono-exam text-3xl font-bold text-primary"
                >
                  {formatExamScoreWithUnit(evaluation.overallBand, examId)}
                </span>
              </LtrExamBoundary>
              {examId === 'toefl_ibt' ? (
                <span className="font-mono-exam text-xs font-semibold text-focus">
                  ~{estimateToeflLegacy120(evaluation.overallBand)}/120
                </span>
              ) : null}
              <span className="rounded-[var(--mz-radius-pill)] border border-border-subtle bg-canvas/70 px-2.5 py-0.5 text-[11px] font-medium text-text-secondary">
                {evaluation.modelId} · {evaluation.rubricVersion}
              </span>
            </div>

            {detSubscores ? (
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-text-secondary">
                <span>Literacy: {detSubscores.literacy}</span>
                <span>Comprehension: {detSubscores.comprehension}</span>
                <span>Conversation: {detSubscores.conversation}</span>
                <span>Production: {detSubscores.production}</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/progress/compare"
              data-testid="eval-compare-link"
              className="inline-flex h-8 items-center gap-1.5 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-3 text-xs font-semibold text-text-primary hover:bg-surface-hover"
            >
              <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('evalResultCompareAction')}</span>
            </Link>
            <Link
              to="/home"
              className="inline-flex h-8 items-center rounded-[var(--mz-radius-compact)] bg-primary px-3 text-xs font-semibold text-on-primary hover:bg-primary-pressed"
            >
              {t('objResultBackHomeAction')}
            </Link>
          </div>
        </div>
      </MzCard>

      {/* Master-Detail Review Split */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-[var(--mz-radius-card)] border border-border-subtle bg-canvas">
        <SplitPaneWorkspace
          viewKey="review:evaluation"
          initialRatio={0.48}
          leftLabel="Submitted Artifact & Inline Edits"
          rightLabel="Criteria, Rewrite & Vocab"
          leftPane={
            <div className="flex flex-col gap-4">
              {submittedEssay ? (
                <MzCard variant="default">
                  <h2 className="mb-3 text-sm font-bold text-text-primary">
                    {t('evalResultSubmittedTextTitle')}
                  </h2>
                  <LtrExamBoundary>
                    <div
                      data-testid="eval-annotated-essay"
                      className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary"
                    >
                      {textSlices.map((slice) => {
                        const edit = slice.edit;
                        if (!edit) {
                          return (
                            <Fragment key={`${slice.startOffset}-${slice.endOffset}`}>
                              {slice.text}
                            </Fragment>
                          );
                        }
                        const isActive = selectedEdit?.editId === edit.editId;
                        return (
                          <button
                            key={edit.editId}
                            type="button"
                            data-testid={`inline-edit-span-${edit.editId}`}
                            onClick={() => setSelectedEditId(edit.editId)}
                            className={[
                              'rounded px-1 underline decoration-2 underline-offset-2 transition-colors',
                              isActive
                                ? 'bg-primary/20 text-primary font-semibold'
                                : 'bg-amber-bg text-warning hover:bg-primary/15',
                            ].join(' ')}
                          >
                            {slice.text}
                          </button>
                        );
                      })}
                    </div>
                  </LtrExamBoundary>

                  {selectedEdit ? (
                    <div
                      data-testid="inline-edit-inspector"
                      className="mt-4 rounded-[var(--mz-radius-compact)] border border-primary/40 bg-surface-alt p-3 text-xs"
                    >
                      <p className="font-bold text-primary">
                        [{selectedEdit.criterionCode}] →{' '}
                        <LtrExamBoundary>
                          <span className="font-mono-exam">{selectedEdit.suggestedText}</span>
                        </LtrExamBoundary>
                      </p>
                      <p className="mt-1 text-text-secondary">{selectedEdit.rationale}</p>
                    </div>
                  ) : null}
                </MzCard>
              ) : null}

              {evaluation.transcriptSegments && evaluation.transcriptSegments.length > 0 ? (
                <MzCard variant="default" data-testid="eval-transcript-card">
                  <h2 className="mb-3 text-sm font-bold text-text-primary">
                    {t('evalResultTranscriptTitle')}
                  </h2>
                  <LtrExamBoundary>
                    <div className="flex flex-col gap-3">
                      {evaluation.transcriptSegments.map((seg) => (
                        <div
                          key={seg.segmentId}
                          className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3 text-xs"
                        >
                          <p className="font-semibold text-text-primary">{seg.text}</p>
                          {seg.annotations.map((ann, idx) => (
                            <p key={`${seg.segmentId}-ann-${idx}`} className="mt-1.5 text-primary">
                              <strong>{ann.type}:</strong> {ann.suggestion ?? ''} — {ann.rationale}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  </LtrExamBoundary>
                </MzCard>
              ) : null}

              {evaluation.actionableNextStep ? (
                <MzBanner tone="info" title={t('evalResultActionableNextTitle')}>
                  {evaluation.actionableNextStep}
                </MzBanner>
              ) : null}
            </div>
          }
          rightPane={
            <div className="flex flex-col gap-4">
              {/* Rubric Criteria */}
              <MzCard variant="default">
                <h2 className="mb-3 text-sm font-bold text-text-primary">
                  {t('evalResultCriteriaTitle')}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {evaluation.criteria.map((c) => (
                    <div
                      key={c.code}
                      data-testid={`criterion-card-${c.code}`}
                      className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-text-primary">{c.label}</span>
                        <span className="font-mono-exam font-bold text-primary">
                          {formatExamScoreWithUnit(c.band, examId)}
                        </span>
                      </div>
                      <p className="mt-1.5 leading-relaxed text-text-secondary">{c.feedbackNote}</p>
                    </div>
                  ))}
                </div>
              </MzCard>

              {/* Model Rewrite */}
              {evaluation.modelRewrite ? (
                <MzCard variant="alt" data-testid="eval-model-rewrite-card">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    <span>
                      {t('evalResultModelRewriteTitle', {
                        delta: evaluation.modelRewrite.targetBandDelta,
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {evaluation.modelRewrite.preservedIdeasNote}
                  </p>
                  <LtrExamBoundary>
                    <p className="mt-2.5 whitespace-pre-wrap rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas p-3 text-xs leading-relaxed text-text-primary">
                      {evaluation.modelRewrite.rewrittenText}
                    </p>
                  </LtrExamBoundary>
                </MzCard>
              ) : null}

              {/* 1-Click Vocab Upgrades to SM-2 */}
              {evaluation.vocabUpgrades.length > 0 ? (
                <MzCard variant="default" data-testid="eval-vocab-upgrades-card">
                  <h2 className="mb-3 text-sm font-bold text-text-primary">
                    {t('evalResultVocabUpgradesTitle')}
                  </h2>
                  <div className="flex flex-col gap-2.5">
                    {evaluation.vocabUpgrades.map((v) => {
                      const isAdded = Boolean(addedVocabIds[v.id]);
                      return (
                        <div
                          key={v.id}
                          className="flex flex-wrap items-start justify-between gap-2 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-text-primary">
                              <LtrExamBoundary>
                                {v.term} {v.ipa ? <span className="font-normal text-text-tertiary">{v.ipa}</span> : null}
                              </LtrExamBoundary>
                            </p>
                            <p className="mt-0.5 text-text-secondary">{v.definition}</p>
                            {deps.edition === 'irn' && v.glossFa ? (
                              <p className="mt-0.5 font-medium text-primary">{v.glossFa}</p>
                            ) : null}
                          </div>
                          <MzButton
                            variant={isAdded ? 'secondary' : 'primary'}
                            size="sm"
                            disabled={isAdded}
                            data-testid={`add-vocab-sm2-${v.id}`}
                            leadingIcon={
                              isAdded ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                              ) : (
                                <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
                              )
                            }
                            onClick={() => void handleAddVocabUpgrade(v)}
                          >
                            {isAdded
                              ? t('evalResultAddedToSm2Badge')
                              : t('evalResultAddToSm2Action')}
                          </MzButton>
                        </div>
                      );
                    })}
                  </div>
                </MzCard>
              ) : null}

              {/* Recommended Drill CTA */}
              {evaluation.recommendedDrill ? (
                <MzCard variant="default">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs">
                      <Flame className="h-4 w-4 text-warning" aria-hidden="true" />
                      <div>
                        <p className="font-bold text-text-primary">
                          {t('evalResultRecommendedDrillTitle')}: {evaluation.recommendedDrill.title}
                        </p>
                        <p className="text-text-secondary">
                          {evaluation.recommendedDrill.weakestCriterionCode} ·{' '}
                          {evaluation.recommendedDrill.durationMinutes} min
                        </p>
                      </div>
                    </div>
                    <Link
                      to="/practice/drills"
                      className="inline-flex h-8 items-center rounded-[var(--mz-radius-compact)] bg-primary px-3 text-xs font-semibold text-on-primary hover:bg-primary-pressed"
                    >
                      {t('drillsStartAction')}
                    </Link>
                  </div>
                </MzCard>
              ) : null}
            </div>
          }
        />
      </div>
    </div>
  );
}
