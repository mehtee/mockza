import { ArrowLeft, ArrowRight, Compass, Sparkles, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MzButton, MzCard } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { PersonalizationStateDto, RoadmapStepDto } from '@/gateways/personalization.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';

export interface PlanImpactCardProps {
  readonly skill?: 'reading' | 'listening' | 'writing' | 'speaking';
  readonly scoreBand?: number | null;
  readonly onOpenNextStep?: (step: RoadmapStepDto) => void;
  readonly onOpenRoadmap?: () => void;
}

export function PlanImpactCard({
  skill,
  scoreBand,
  onOpenNextStep,
  onOpenRoadmap,
}: PlanImpactCardProps) {
  const deps = useDeps();
  const isRtl = deps.edition === 'irn';
  const t = createTranslator(deps.edition);
  const [state, setState] = useState<PersonalizationStateDto | null>(null);

  useEffect(() => {
    let active = true;
    if (!deps.personalization) return;
    void deps.personalization.getState().then((res) => {
      if (active && res.ok) setState(res.value);
    });
    return () => {
      active = false;
    };
  }, [deps.personalization, scoreBand]);

  if (!state) return null;

  const skillBand = skill ? state.liveBand.skills[skill] : null;
  const currentStep = state.roadmap.currentStep;
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <MzCard variant="alt" padding="sm" data-testid="post-test-plan-impact-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('planImpactTitle')}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-[var(--mz-radius-pill)] border border-border-subtle bg-canvas px-2.5 py-0.5 font-semibold text-text-primary">
              <TrendingUp className="h-3 w-3 text-primary" aria-hidden="true" />
              <span>
                {t('planImpactBandLabel')}:{' '}
                <LtrExamBoundary>
                  <strong className="font-mono-exam text-primary">
                    {skillBand?.score ?? state.liveBand.currentBand ?? scoreBand ?? '—'}
                  </strong>
                </LtrExamBoundary>
              </span>
            </span>
            {state.liveBand.bandShift > 0 ? (
              <span className="rounded-[var(--mz-radius-pill)] bg-mint-bg px-2.5 py-0.5 font-semibold text-success">
                +{state.liveBand.bandShift}
              </span>
            ) : null}
            {state.weaknesses.slice(0, 2).map((w) => (
              <span
                key={w.canonicalKey}
                className="rounded-[var(--mz-radius-pill)] border border-warning/40 bg-amber-bg px-2.5 py-0.5 text-[11px] font-semibold text-warning"
              >
                {isRtl ? w.displayLabelFa : w.displayLabelEn}
              </span>
            ))}
          </div>
          {currentStep ? (
            <p className="text-xs text-text-secondary">
              {isRtl ? currentStep.titleFa : currentStep.titleEn}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentStep && onOpenNextStep ? (
            <MzButton
              variant="primary"
              size="sm"
              data-testid="plan-impact-next-step-cta"
              onClick={() => onOpenNextStep(currentStep)}
            >
              <span>{t('planImpactNextStepCta')}</span>
              <ArrowIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </MzButton>
          ) : null}
          {onOpenRoadmap ? (
            <MzButton variant="secondary" size="sm" onClick={onOpenRoadmap}>
              <Compass className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span>{t('navRoadmap')}</span>
            </MzButton>
          ) : null}
        </div>
      </div>
    </MzCard>
  );
}
