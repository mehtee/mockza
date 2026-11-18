import {
  formatMicroDrillCategoryLabel,
  getMicroDrillItemHeaderTitle,
  scoreObjectiveAnswers,
  type SkillKind,
  type SupportedExamId,
} from '@mockza/domain';
import { useNavigate } from '@tanstack/react-router';
import { BookmarkPlus, CheckCircle2, Flame, Play, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MzBanner, MzButton, MzCard } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { CachedDrillRecord, MicroDrillDto } from '@/gateways/storage.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import { generateUuid } from '@/spa/objective-sim-helpers';
import { formatMmSs } from '@/components/exam-kit';

export interface MicroDrillsScreenProps {
  readonly initialDrillId?: string | null;
}

interface ParsedDrillView {
  readonly drillId: string;
  readonly title: string;
  readonly drillType: string;
  readonly skill: SkillKind;
  readonly durationSeconds: number;
  readonly items: readonly MicroDrillDto['items'][number][];
}

function parseCachedDrill(record: CachedDrillRecord): ParsedDrillView | null {
  try {
    const parsed = JSON.parse(record.itemsJson) as MicroDrillDto['items'];
    if (!Array.isArray(parsed)) return null;
    return {
      drillId: record.drillId,
      title: record.title,
      drillType: record.drillType,
      skill: record.skill,
      durationSeconds: record.durationSeconds || 180,
      items: parsed,
    };
  } catch {
    return null;
  }
}

export function MicroDrillsScreen({ initialDrillId = null }: MicroDrillsScreenProps) {
  const deps = useDeps();
  const t = createTranslator(deps.edition);
  const navigate = useNavigate();

  const [drills, setDrills] = useState<readonly ParsedDrillView[]>([]);
  const [profileExamId, setProfileExamId] = useState<SupportedExamId>('ielts_academic');
  const [activeDrillId, setActiveDrillId] = useState<string | null>(initialDrillId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersById, setAnswersById] = useState<Record<string, string>>({});
  const [submittedItem, setSubmittedItem] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(180);
  const [isFinished, setIsFinished] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [startedAtMs, setStartedAtMs] = useState<number>(deps.clock.nowMs());

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      const [cachedRes, profileRes] = await Promise.all([
        deps.catalog.listCachedDrills(),
        deps.attemptStore.getUserProfile(),
      ]);
      if (!mounted) return;
      if (profileRes.ok && profileRes.value?.examId) {
        setProfileExamId(profileRes.value.examId);
      }
      let rows = cachedRes.ok ? cachedRes.value : [];
      if (rows.length === 0) {
        const synced = await deps.catalog.syncDrills();
        if (synced.ok) rows = synced.value;
      }
      const parsed = rows
        .map(parseCachedDrill)
        .filter((d): d is ParsedDrillView => d !== null);
      setDrills(parsed);
      if (initialDrillId) {
        const matched = parsed.find((d) => d.drillId === initialDrillId);
        if (matched) {
          setRemainingSeconds(matched.durationSeconds);
          setStartedAtMs(deps.clock.nowMs());
        }
      }
    }
    void hydrate();
    return () => {
      mounted = false;
    };
  }, [deps.attemptStore, deps.catalog, deps.clock, initialDrillId]);

  const activeDrill = useMemo(
    () => drills.find((d) => d.drillId === activeDrillId) ?? null,
    [activeDrillId, drills],
  );
  const activeItem = activeDrill?.items[currentIndex] ?? null;

  const startDrill = (drill: ParsedDrillView) => {
    setActiveDrillId(drill.drillId);
    setCurrentIndex(0);
    setAnswersById({});
    setSubmittedItem(false);
    setIsFinished(false);
    setSavedToast(null);
    setRemainingSeconds(drill.durationSeconds || 180);
    setStartedAtMs(deps.clock.nowMs());
  };

  const finishDrill = useCallback(async () => {
    if (!activeDrill || isFinished) return;
    setIsFinished(true);

    const scoreReport = scoreObjectiveAnswers({
      skill: activeDrill.skill === 'listening' ? 'listening' : 'reading',
      track: profileExamId,
      moduleType: profileExamId === 'ielts_general' ? 'general_training' : 'academic',
      answers: activeDrill.items.map((item) => ({
        questionId: item.id,
        acceptedAnswers: [item.answer],
        userAnswer: answersById[item.id] ?? '',
      })),
    });

    const nowMs = deps.clock.nowMs();
    const durationSec = Math.max(1, Math.round((nowMs - startedAtMs) / 1000));

    await deps.attemptStore.recordMicroDrillHistory({
      drillId: activeDrill.drillId,
      examId: profileExamId,
      drillType: activeDrill.drillType,
      skill: activeDrill.skill,
      correctCount: scoreReport.correctCount,
      totalCount: scoreReport.totalCount,
      durationSeconds: durationSec,
      completedAtMs: nowMs,
    });
    await deps.attemptStore.incrementDailyStudyLog({
      serialDay: deps.clock.todaySerialDay(),
      addSeconds: durationSec,
      addCompletedItems: 1,
    });
  }, [activeDrill, answersById, deps.attemptStore, deps.clock, isFinished, profileExamId, startedAtMs]);

  useEffect(() => {
    if (!activeDrill || isFinished) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          void finishDrill();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeDrill, finishDrill, isFinished]);

  const activeAnswer = activeItem ? (answersById[activeItem.id] ?? '') : '';
  const isItemCorrect = activeItem
    ? activeAnswer.trim().toLowerCase() === activeItem.answer.trim().toLowerCase()
    : false;

  const handleSaveMistakeToDeck = async () => {
    if (!activeItem || !activeDrill) return;
    const nowMs = deps.clock.nowMs();
    const headword = activeItem.answer.trim().slice(0, 64) || 'key concept';
    await deps.vocabStore.upsertMistakeCard({
      cardId: generateUuid(),
      examId: profileExamId,
      headword,
      ipa: null,
      definition: activeItem.explanation || activeItem.prompt,
      glossFa: null,
      topicTag: activeDrill.drillType,
      sourceKind: 'mistake_to_deck',
      tags: ['micro_drill', activeDrill.drillType],
      contextSentence: activeItem.prompt,
      paraphraseHints: [],
      usageNote: activeItem.explanation || null,
      sourceSkill: activeDrill.skill,
      sourceAttemptId: activeDrill.drillId,
      sourceRefLabel: activeDrill.title,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    });
    setSavedToast(t('drillsSavedMistakeToast', { word: headword }));
  };

  // Keyboard-fast 1-9 option pick + Enter submit/advance inside active drill
  useEffect(() => {
    if (!activeDrill || !activeItem || isFinished) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTextInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if (event.key === 'Enter' && !isTextInput) {
        event.preventDefault();
        if (!submittedItem) {
          if (activeAnswer.trim().length > 0) setSubmittedItem(true);
        } else if (currentIndex < activeDrill!.items.length - 1) {
          setCurrentIndex((i) => i + 1);
          setSubmittedItem(false);
        } else {
          void finishDrill();
        }
        return;
      }
      if (!isTextInput && !submittedItem && activeItem!.options.length > 0) {
        const digit = Number(event.key);
        if (Number.isInteger(digit) && digit >= 1 && digit <= activeItem!.options.length) {
          const picked = activeItem!.options[digit - 1];
          if (picked) {
            event.preventDefault();
            setAnswersById((prev) => ({ ...prev, [activeItem!.id]: picked }));
          }
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeAnswer, activeDrill, activeItem, currentIndex, finishDrill, isFinished, submittedItem]);

  if (!activeDrill) {
    return (
      <div data-testid="micro-drills-screen" className="mx-auto flex max-w-5xl flex-col gap-5 pb-12 text-start">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('drillsHubTitle')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('drillsHubSubtitle')}</p>
        </div>

        {drills.length === 0 ? (
          <MzCard variant="alt">
            <p className="py-6 text-center text-sm text-text-secondary">{t('drillsEmptyMessage')}</p>
          </MzCard>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {drills.map((drill) => (
              <MzCard
                key={drill.drillId}
                variant="default"
                data-testid={`drill-card-${drill.drillId}`}
                className="flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                    <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{formatMicroDrillCategoryLabel(drill.drillType)}</span>
                  </div>
                  <h2 className="mt-1.5 text-base font-bold text-text-primary">{drill.title}</h2>
                  <p className="mt-1 font-mono-exam text-xs text-text-secondary">
                    {Math.round(drill.durationSeconds / 60)}m · {drill.items.length} items
                  </p>
                </div>
                <MzButton
                  variant="primary"
                  size="sm"
                  data-testid={`start-drill-${drill.drillId}`}
                  leadingIcon={<Play className="h-3.5 w-3.5" aria-hidden="true" />}
                  onClick={() => startDrill(drill)}
                >
                  {t('drillsStartAction')}
                </MzButton>
              </MzCard>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (isFinished) {
    const correctTotal = activeDrill.items.filter(
      (it) => (answersById[it.id] ?? '').trim().toLowerCase() === it.answer.trim().toLowerCase(),
    ).length;

    return (
      <div data-testid="micro-drills-screen" className="mx-auto flex max-w-3xl flex-col gap-5 pb-12 text-start">
        <MzCard variant="hero" data-testid="drill-scorecard">
          <p className="text-xs font-semibold text-primary">
            {formatMicroDrillCategoryLabel(activeDrill.drillType)}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">{t('drillsScorecardTitle')}</h1>
          <p className="mt-2 font-mono-exam text-xl font-bold text-text-primary">
            {correctTotal} / {activeDrill.items.length}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <MzButton
              variant="primary"
              size="sm"
              data-testid="drill-back-hub-btn"
              onClick={() => {
                setActiveDrillId(null);
                void navigate({ to: '/practice/drills' });
              }}
            >
              {t('drillsBackToHubAction')}
            </MzButton>
          </div>
        </MzCard>
      </div>
    );
  }

  return (
    <div data-testid="micro-drills-screen" className="mx-auto flex max-w-3xl flex-col gap-4 pb-12 text-start">
      {savedToast ? <MzBanner tone="success">{savedToast}</MzBanner> : null}

      <MzCard variant="default" data-testid="drill-active-runner">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
          <div>
            <p className="text-xs font-semibold text-primary">
              {formatMicroDrillCategoryLabel(activeDrill.drillType)} ·{' '}
              {getMicroDrillItemHeaderTitle(activeDrill.drillType)}
            </p>
            <h1 className="text-base font-bold text-text-primary">{activeDrill.title}</h1>
          </div>
          <LtrExamBoundary>
            <span
              data-testid="drill-timer"
              className="font-mono-exam rounded-[var(--mz-radius-pill)] border border-border-subtle bg-canvas px-3 py-1 text-sm font-bold text-primary tabular-nums"
            >
              {formatMmSs(remainingSeconds)}
            </span>
          </LtrExamBoundary>
        </div>

        {activeItem ? (
          <div className="mt-4 flex flex-col gap-4">
            <p className="text-xs font-medium text-text-tertiary">
              Item {currentIndex + 1} / {activeDrill.items.length}
            </p>
            <LtrExamBoundary>
              <p className="text-base font-semibold text-text-primary">{activeItem.prompt}</p>
            </LtrExamBoundary>

            {activeItem.options.length > 0 ? (
              <div className="flex flex-col gap-2" role="radiogroup" aria-label={activeItem.prompt}>
                {activeItem.options.map((opt, idx) => {
                  const selected = activeAnswer === opt;
                  return (
                    <button
                      key={`${opt}-${idx}`}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={submittedItem}
                      data-testid={`drill-option-${idx}`}
                      onClick={() =>
                        setAnswersById((prev) => ({ ...prev, [activeItem.id]: opt }))
                      }
                      className={[
                        'flex items-center justify-between gap-2 rounded-[var(--mz-radius-control)] border px-3.5 py-2.5 text-start text-sm transition-colors',
                        selected
                          ? 'border-primary bg-surface-alt font-semibold text-primary'
                          : 'border-border-subtle bg-canvas text-text-primary hover:bg-surface-hover',
                      ].join(' ')}
                    >
                      <LtrExamBoundary>
                        <span>
                          <strong className="me-2 font-mono-exam text-xs text-text-tertiary">
                            {idx + 1}.
                          </strong>
                          {opt}
                        </span>
                      </LtrExamBoundary>
                    </button>
                  );
                })}
              </div>
            ) : (
              <LtrExamBoundary>
                <input
                  type="text"
                  data-testid="drill-text-input"
                  value={activeAnswer}
                  disabled={submittedItem}
                  onChange={(e) =>
                    setAnswersById((prev) => ({ ...prev, [activeItem.id]: e.target.value }))
                  }
                  placeholder="Type answer..."
                  className="h-10 w-full rounded-[var(--mz-radius-control)] border border-border-subtle bg-canvas px-3 text-sm text-text-primary focus:border-primary focus:outline-none"
                />
              </LtrExamBoundary>
            )}

            {submittedItem ? (
              <MzCard variant="alt" data-testid="drill-item-feedback">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    {isItemCorrect ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                    ) : (
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-error" aria-hidden="true" />
                    )}
                    <div className="text-xs">
                      <p className="font-bold text-text-primary">
                        {isItemCorrect ? 'Correct' : `Accepted: ${activeItem.answer}`}
                      </p>
                      {activeItem.explanation ? (
                        <p className="mt-1 text-text-secondary">{activeItem.explanation}</p>
                      ) : null}
                    </div>
                  </div>

                  {!isItemCorrect ? (
                    <MzButton
                      variant="secondary"
                      size="sm"
                      data-testid="drill-save-mistake-btn"
                      leadingIcon={<BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />}
                      onClick={() => void handleSaveMistakeToDeck()}
                    >
                      {t('drillsSaveMistakeAction')}
                    </MzButton>
                  ) : null}
                </div>
              </MzCard>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-2">
              {!submittedItem ? (
                <MzButton
                  variant="primary"
                  size="md"
                  data-testid="drill-check-btn"
                  disabled={activeAnswer.trim().length === 0}
                  onClick={() => setSubmittedItem(true)}
                >
                  {t('drillsCheckAnswerAction')}
                </MzButton>
              ) : (
                <MzButton
                  variant="primary"
                  size="md"
                  data-testid="drill-next-btn"
                  onClick={() => {
                    if (currentIndex < activeDrill.items.length - 1) {
                      setCurrentIndex((i) => i + 1);
                      setSubmittedItem(false);
                    } else {
                      void finishDrill();
                    }
                  }}
                >
                  {currentIndex < activeDrill.items.length - 1
                    ? t('drillsNextItemAction')
                    : t('drillsFinishAction')}
                </MzButton>
              )}
            </div>
          </div>
        ) : null}
      </MzCard>
    </div>
  );
}
