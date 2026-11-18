import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useState } from 'react';
import { MzButton, MzModal } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { getActiveEditionCode } from '@/edition/edition-config';
import { createTranslator } from '@/i18n';
import { useOptionalDeps } from '@/spa/deps';

export interface ExamSvgChartCardProps {
  readonly svgMarkup?: string | null;
  readonly svgUrl?: string | null;
  readonly altText: string;
  readonly caption?: string | null;
}

const MIN_INLINE_SCALE = 1;
const MAX_INLINE_SCALE = 3;
const MAX_LIGHTBOX_SCALE = 4;

export function sanitizeSvgMarkup(rawSvg: string): string {
  return rawSvg
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

export function ExamSvgChartCard({
  svgMarkup,
  svgUrl,
  altText,
  caption,
}: ExamSvgChartCardProps) {
  const deps = useOptionalDeps();
  const edition = deps?.edition ?? getActiveEditionCode();
  const t = createTranslator(edition);

  const [scale, setScale] = useState(1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxScale, setLightboxScale] = useState(1);

  const cleanedSvg = svgMarkup ? sanitizeSvgMarkup(svgMarkup) : null;

  const renderGraphic = (currentScale: number) => (
    <div
      className="flex h-full w-full items-center justify-center transition-transform duration-150"
      style={{ transform: `scale(${currentScale})`, transformOrigin: 'center center' }}
    >
      {cleanedSvg ? (
        <div
          aria-label={altText}
          className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
          // Safe SVG markup sanitized via sanitizeSvgMarkup().
          dangerouslySetInnerHTML={{ __html: cleanedSvg }}
        />
      ) : svgUrl ? (
        <img src={svgUrl} alt={altText} className="max-h-full max-w-full object-contain" />
      ) : null}
    </div>
  );

  return (
    <LtrExamBoundary>
      <figure
        data-testid="exam-svg-chart-card"
        className="flex flex-col gap-2 rounded-[var(--mz-radius-control)] border border-border-subtle bg-[#0E1322] p-3 text-slate-200"
      >
        <div
          data-testid="chart-viewport"
          data-scale={scale}
          className="h-60 w-full overflow-auto rounded-[var(--mz-radius-compact)] bg-[#0B101D] p-2"
        >
          {renderGraphic(scale)}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <figcaption className="min-w-0 flex-1 truncate text-xs text-slate-400">
            {caption && caption.trim().length > 0 ? caption : t('examKitChartCaptionFallback')}
          </figcaption>

          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid="chart-zoom-out"
              aria-label={t('examKitZoomOutAction')}
              disabled={scale <= MIN_INLINE_SCALE}
              onClick={() => setScale((s) => Math.max(MIN_INLINE_SCALE, Number((s - 0.5).toFixed(1))))}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            >
              <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <span className="min-w-[2.75rem] text-center font-mono-exam text-xs text-slate-300">
              {scale.toFixed(1)}x
            </span>
            <button
              type="button"
              data-testid="chart-zoom-in"
              aria-label={t('examKitZoomInAction')}
              disabled={scale >= MAX_INLINE_SCALE}
              onClick={() => setScale((s) => Math.min(MAX_INLINE_SCALE, Number((s + 0.5).toFixed(1))))}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            >
              <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              data-testid="chart-zoom-reset"
              aria-label={t('examKitZoomResetAction')}
              disabled={scale === 1}
              onClick={() => setScale(1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              data-testid="chart-expand-btn"
              onClick={() => {
                setLightboxScale(1);
                setLightboxOpen(true);
              }}
              className="inline-flex h-7 items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2.5 text-xs font-semibold text-primary hover:bg-slate-800"
            >
              <Maximize2 className="h-3 w-3" aria-hidden="true" />
              <span>{t('examKitExpandChartAction')}</span>
            </button>
          </div>
        </div>
      </figure>

      <MzModal
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        title={altText}
        description={caption ?? undefined}
        maxWidthClass="max-w-4xl"
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <MzButton
                variant="secondary"
                size="sm"
                data-testid="lightbox-zoom-out"
                disabled={lightboxScale <= 1}
                onClick={() => setLightboxScale((s) => Math.max(1, Number((s - 0.5).toFixed(1))))}
              >
                -
              </MzButton>
              <span className="font-mono-exam text-xs text-text-primary">
                {lightboxScale.toFixed(1)}x
              </span>
              <MzButton
                variant="secondary"
                size="sm"
                data-testid="lightbox-zoom-in"
                disabled={lightboxScale >= MAX_LIGHTBOX_SCALE}
                onClick={() =>
                  setLightboxScale((s) => Math.min(MAX_LIGHTBOX_SCALE, Number((s + 0.5).toFixed(1))))
                }
              >
                +
              </MzButton>
            </div>
            <MzButton variant="primary" size="sm" onClick={() => setLightboxOpen(false)}>
              {t('workspaceShortcutsCloseAction')}
            </MzButton>
          </div>
        }
      >
        <div
          data-testid="chart-lightbox-viewport"
          data-scale={lightboxScale}
          className="h-[420px] w-full overflow-auto rounded-[var(--mz-radius-compact)] bg-[#0B101D] p-4"
        >
          {renderGraphic(lightboxScale)}
        </div>
      </MzModal>
    </LtrExamBoundary>
  );
}
