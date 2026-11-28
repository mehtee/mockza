import type { DiagnosticSkill } from '@mockza/domain';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  Headphones,
  Mic,
  PenTool,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  localizeDiagnosticAction,
  localizeDiagnosticLevel,
  localizeDiagnosticObservation,
} from '@/components/bidi/diagnostic-labels';
import { formatSkillLabel } from '@/components/bidi/topic-labels';
import { MzBanner, MzButton, MzCard } from '@/components/ui';
import { formatChromeNumber } from '@/edition/bidi/numerals';
import type { DiagnosticSessionDto } from '@/gateways/diagnostic.gateway';
import type { PersonalizationStateDto } from '@/gateways/personalization.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import { resolveWebRoadmapStepPath } from '@/spa/roadmap-route-resolver';
import { parseDiagnosticStateJson } from './diagnostic-state';

export interface DiagnosticResultScreenProps {
  readonly diagId?: string;
}

const SKILL_META: readonly {
  readonly skill: DiagnosticSkill;
  readonly Icon: typeof BookOpen;
}[] = [
  { skill: 'reading', Icon: BookOpen },
  { skill: 'listening', Icon: Headphones },
  { skill: 'writing', Icon: PenTool },
  { skill: 'speaking', Icon: Mic },
] as const;

export function DiagnosticResultScreen({ diagId: routeDiagId }: DiagnosticResultScreenProps = {}) {
  const deps = useDeps();
  const t = useMemo(() => createTranslator(deps.edition), [deps.edition]);
  const navigate = useNavigate();

  const [session, setSession] = useState<DiagnosticSessionDto | null>(null);
  const [personalization, setPersonalization] = useState<PersonalizationStateDto | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pollPausedByQuota, setPollPausedByQuota] = useState(false);
  const hasSessionRef = useRef(false);
  hasSessionRef.current = Boolean(session);

  const loadResults = useCallback(async () => {
    setErrorMsg(null);
    let targetDiagId = routeDiagId;

    if (!targetDiagId) {
      const latestRes = await deps.attemptStore.getLatestDiagnosticSession();
      const parsed = parseDiagnosticStateJson(latestRes.ok ? latestRes.value : null);
      if (parsed?.remoteSession) {
        setSession(parsed.remoteSession);
        targetDiagId = parsed.diagId;
      } else if (parsed?.diagId) {
        targetDiagId = parsed.diagId;
      }
    }

    if (!targetDiagId) return;

    const remoteRes = await deps.diagnostic.getSession(targetDiagId);
    if (remoteRes.ok) {
      setPollPausedByQuota(false);
      setSession(remoteRes.value);
      const pRes = await deps.personalization?.getState();
      if (pRes && pRes.ok) {
        setPersonalization(pRes.value);
      }
    } else if (remoteRes.error.kind === 'quota_exceeded') {
      setPollPausedByQuota(true);
      setErrorMsg(t('rateLimitFriendlyError'));
    } else if (!hasSessionRef.current) {
      setErrorMsg(remoteRes.error.message);
    }
  }, [deps.attemptStore, deps.diagnostic, deps.personalization, routeDiagId, t]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  const anyPending =
    session &&
    Object.values(session.skills).some((outcome) => outcome.status === 'pending');

  useEffect(() => {
    if (!anyPending || pollPausedByQuota) return;
    const timer = window.setInterval(() => {
      void loadResults();
    }, 3500);
    return () => window.clearInterval(timer);
  }, [anyPending, loadResults, pollPausedByQuota]);

  if (!session) {
    return (
      <div data-testid="diagnostic-result-screen" className="mx-auto w-full max-w-6xl p-6 text-start">
        {errorMsg ? (
          <MzBanner tone="danger">{errorMsg}</MzBanner>
        ) : (
          <MzCard variant="default">
            <p className="text-sm text-text-secondary">{t('diagNoReportFound')}</p>
            <Link
              to="/diagnostic/intro"
              className="mt-3 inline-flex text-xs font-semibold text-primary hover:underline"
            >
              {t('diagIntroTitle')}
            </Link>
          </MzCard>
        )}
      </div>
    );
  }

  const localizedAction = localizeDiagnosticAction(
    session.recommendedFirstAction,
    deps.edition,
  );

  return (
    <div data-testid="diagnostic-result-screen" className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10 text-start">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('diagResultTitle')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('diagResultSubtitle')}</p>
        </div>

        <MzButton
          variant="secondary"
          size="sm"
          leadingIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
          onClick={() => {
            setPollPausedByQuota(false);
            void loadResults();
          }}
        >
          {t('refreshAction')}
        </MzButton>
      </header>

      {errorMsg ? <MzBanner tone="danger">{errorMsg}</MzBanner> : null}

      {/* Recommended Next Action Hero */}
      <MzCard variant="hero">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h2 className="text-base font-bold text-text-primary">
                {localizedAction.title}
              </h2>
              <p className="mt-1 text-xs text-text-secondary">
                {localizedAction.description}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {personalization?.roadmap.currentStep ? (
              <Link
                to={resolveWebRoadmapStepPath(personalization.roadmap.currentStep) as never}
                data-testid="diag-start-step1-cta"
                className="inline-flex h-9 items-center gap-1.5 justify-center rounded-[var(--mz-radius-compact)] bg-primary px-4 text-xs font-semibold text-on-primary hover:bg-primary-pressed"
              >
                <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('roadmapOpenStepCta')}</span>
              </Link>
            ) : null}
            <Link
              to="/roadmap"
              data-testid="diag-open-roadmap-cta"
              className="inline-flex h-9 items-center gap-1.5 justify-center rounded-[var(--mz-radius-compact)] border border-border-strong bg-canvas px-4 text-xs font-semibold text-primary hover:bg-surface-hover"
            >
              <Compass className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('roadmapEmptyCta')}</span>
            </Link>
            <Link
              to="/practice/drills"
              data-testid="diag-recommended-cta"
              className="inline-flex h-9 items-center justify-center rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-4 text-xs font-semibold text-text-secondary hover:bg-surface-hover"
            >
              {t('diagStartRecommendedAction')}
            </Link>
            <Link
              to="/home"
              data-testid="diag-go-home-link"
              className="inline-flex h-9 items-center justify-center rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-3 text-xs font-semibold text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            >
              {t('diagGoHomeAction')}
            </Link>
          </div>
        </div>

        {/* Provisional Live Band + Top Weaknesses + 4-Milestone Roadmap Reveal */}
        {personalization ? (
          <div className="mt-4 space-y-3 border-t border-border-subtle pt-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {personalization.liveBand.currentBand !== null ? (
                <span className="rounded-[var(--mz-radius-pill)] bg-primary/15 px-3 py-1 font-mono font-bold text-primary">
                  {t('planImpactBandLabel')}:{' '}
                  {formatChromeNumber(personalization.liveBand.currentBand, deps.edition)} ·{' '}
                  {t('confidenceSeeded')}
                </span>
              ) : null}
              {personalization.weaknesses.slice(0, 2).map((w) => (
                <span
                  key={w.canonicalKey}
                  className="rounded-[var(--mz-radius-pill)] border border-warning/40 bg-amber-bg px-2.5 py-0.5 font-semibold text-warning"
                >
                  {deps.edition === 'irn' ? w.displayLabelFa : w.displayLabelEn}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {personalization.roadmap.milestones.map((ms) => (
                <div
                  key={ms.index}
                  className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-2.5 py-2 text-xs"
                >
                  <p className="font-mono text-[10px] font-bold text-primary">
                    {deps.edition === 'irn'
                      ? `گام ${formatChromeNumber(ms.index, deps.edition)}`
                      : `M${ms.index}`}
                  </p>
                  <p className="mt-0.5 font-semibold text-text-primary">
                    {deps.edition === 'irn' ? ms.titleFa : ms.titleEn}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </MzCard>

      {/* 4-Skill Baseline Grid with Single-Skill Retake */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SKILL_META.map(({ skill, Icon }) => {
          const outcome = session.skills[skill];
          const label = formatSkillLabel(skill, deps.edition);
          const statusLabel =
            outcome.status === 'pending'
              ? t('diagPendingStatusLabel')
              : outcome.status === 'skipped'
                ? t('diagSkippedStatusLabel')
                : outcome.status === 'insufficient_evidence'
                  ? t('diagInsufficientStatusLabel')
                  : t('diagProvisionalStatusLabel');

          return (
            <MzCard
              key={skill}
              variant="default"
              data-testid={`diag-skill-card-${skill}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  <div>
                    <h3 className="text-base font-bold text-text-primary">{label}</h3>
                    <span
                      className={[
                        'inline-flex items-center gap-1 text-[11px] font-semibold',
                        outcome.status === 'provisional'
                          ? 'text-success'
                          : outcome.status === 'pending'
                            ? 'text-focus'
                            : 'text-text-secondary',
                      ].join(' ')}
                    >
                      {outcome.status === 'provisional' ? (
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <Clock className="h-3 w-3" aria-hidden="true" />
                      )}
                      {statusLabel}
                    </span>
                  </div>
                </div>

                <MzButton
                  variant="ghost"
                  size="sm"
                  data-testid={`diag-retake-${skill}-btn`}
                  onClick={() =>
                    void navigate({
                      to: '/diagnostic/session/$diagId',
                      params: { diagId: session.diagId },
                      search: { retakeSkill: skill },
                    })
                  }
                >
                  {outcome.status === 'insufficient_evidence' || outcome.status === 'skipped'
                    ? deps.edition === 'irn'
                      ? `ارزیابی ${label}`
                      : `Assess ${label}`
                    : t('diagRetakeSkillAction')}
                </MzButton>
              </div>

              {outcome.suggestedPracticeLevel ? (
                <p className="mt-3 rounded-[var(--mz-radius-compact)] border border-primary/35 bg-surface-alt px-3 py-2 text-xs font-semibold text-text-primary">
                  {localizeDiagnosticLevel(outcome.suggestedPracticeLevel, deps.edition)}
                </p>
              ) : null}

              {outcome.observations.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-1 text-xs text-text-secondary">
                  {outcome.observations.map((obs) => (
                    <li key={obs}>• {localizeDiagnosticObservation(obs, deps.edition)}</li>
                  ))}
                </ul>
              ) : null}
            </MzCard>
          );
        })}
      </div>
    </div>
  );
}
