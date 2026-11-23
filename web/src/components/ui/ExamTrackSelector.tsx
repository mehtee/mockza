import { SUPPORTED_EXAM_IDS, type SupportedExamId } from '@mockza/domain';
import { CheckCircle2, Circle } from 'lucide-react';
import { formatTrackSubtitle } from '@/components/bidi/topic-labels';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { EditionCode } from '@/edition/edition-config';
import { createTranslator, type TranslationKey } from '@/i18n';

export type CefrTier = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/**
 * Maps numeric target/current exam scores to official CEFR tiers:
 * - IELTS (0–9): 4.0–5.0 B1, 5.5–6.5 B2, 7.0–8.0 C1, 8.5–9.0 C2
 * - TOEFL iBT 2026 (1–6): 3.0–3.5 B1, 4.0–4.5 B2, 5.0–5.5 C1, 6.0 C2
 * - PTE Academic (10–90): 43–58 B1, 59–75 B2, 76–84 C1, 85–90 C2
 * - Duolingo DET (10–160): 60–95 B1, 100–125 B2, 130–150 C1, 155–160 C2
 */
export function resolveOfficialCefrTier(score: number, examId: SupportedExamId): CefrTier {
  switch (examId) {
    case 'ielts_academic':
    case 'ielts_general':
      if (score >= 8.5) return 'C2';
      if (score >= 7.0) return 'C1';
      if (score >= 5.5) return 'B2';
      if (score >= 4.0) return 'B1';
      if (score >= 3.0) return 'A2';
      return 'A1';
    case 'toefl_ibt':
      if (score >= 6.0) return 'C2';
      if (score >= 5.0) return 'C1';
      if (score >= 4.0) return 'B2';
      if (score >= 3.0) return 'B1';
      if (score >= 2.0) return 'A2';
      return 'A1';
    case 'pte_academic':
      if (score >= 85) return 'C2';
      if (score >= 76) return 'C1';
      if (score >= 59) return 'B2';
      if (score >= 43) return 'B1';
      if (score >= 30) return 'A2';
      return 'A1';
    case 'det':
      if (score >= 155) return 'C2';
      if (score >= 130) return 'C1';
      if (score >= 100) return 'B2';
      if (score >= 60) return 'B1';
      if (score >= 35) return 'A2';
      return 'A1';
  }
}

export const TRACK_TITLE_KEYS: Record<SupportedExamId, TranslationKey> = {
  ielts_academic: 'trackIeltsAcademic',
  ielts_general: 'trackIeltsGeneral',
  toefl_ibt: 'trackToeflIbt',
  pte_academic: 'trackPteAcademic',
  det: 'trackDet',
};

const TRACK_BADGE_CODES: Record<SupportedExamId, string> = {
  ielts_academic: 'IELTS AC',
  ielts_general: 'IELTS GT',
  toefl_ibt: 'TOEFL',
  pte_academic: 'PTE',
  det: 'DET',
};

export interface ExamTrackSelectorProps {
  readonly value: SupportedExamId;
  readonly onChange: (nextTrack: SupportedExamId) => void;
  readonly edition: EditionCode;
  readonly ariaLabel: string;
  readonly testIdPrefix: string;
  readonly columns?: 1 | 2;
}

export function ExamTrackSelector({
  value,
  onChange,
  edition,
  ariaLabel,
  testIdPrefix,
  columns = 1,
}: ExamTrackSelectorProps) {
  const t = createTranslator(edition);

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={
        columns === 2
          ? 'grid grid-cols-1 gap-2.5 sm:grid-cols-2'
          : 'flex flex-col gap-2.5'
      }
    >
      {SUPPORTED_EXAM_IDS.map((trackId) => {
        const selected = value === trackId;
        return (
          <button
            key={trackId}
            type="button"
            role="radio"
            aria-checked={selected}
            data-testid={`${testIdPrefix}-${trackId}`}
            onClick={() => onChange(trackId)}
            className={[
              'group flex min-h-[68px] w-full items-center justify-between gap-3 rounded-[var(--mz-radius-card)] border px-4 py-3 text-start transition-all duration-150',
              selected
                ? 'border-2 border-primary bg-surface-alt shadow-sm'
                : 'border-border-subtle bg-surface hover:border-border-strong hover:bg-surface-hover',
            ].join(' ')}
          >
            <div className="flex min-w-0 items-center gap-3">
              <LtrExamBoundary className="shrink-0">
                <span
                  className={[
                    'inline-flex min-w-[68px] items-center justify-center rounded-[var(--mz-radius-compact)] px-2 py-1 font-mono-exam text-[11px] font-bold tracking-tight transition-colors',
                    selected
                      ? 'bg-primary text-on-primary'
                      : 'border border-border-subtle bg-bg-raised text-text-secondary group-hover:text-text-primary',
                  ].join(' ')}
                >
                  {TRACK_BADGE_CODES[trackId]}
                </span>
              </LtrExamBoundary>

              <div className="min-w-0">
                <p className="text-sm font-bold leading-snug text-text-primary sm:text-base">
                  {t(TRACK_TITLE_KEYS[trackId])}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
                  {formatTrackSubtitle(trackId, edition)}
                </p>
              </div>
            </div>

            {selected ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            ) : (
              <Circle
                className="h-5 w-5 shrink-0 text-text-tertiary transition-colors group-hover:text-text-secondary"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
