import DOMPurify from 'dompurify';
import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useState, type WheelEvent } from 'react';
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
  if (typeof window === 'undefined' || !rawSvg) return '';
  return DOMPurify.sanitize(rawSvg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: [
      'foreignObject',
      'iframe',
      'script',
      'style',
      'object',
      'embed',
      'animate',
      'set',
    ],
    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'href', 'xlink:href'],
  });
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

  const handleViewportWheel = (e: WheelEvent<HTMLDivElement>, maxScale: number, setter: (fn: (prev: number) => number) => void) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setter((prev) => Math.max(MIN_INLINE_SCALE, Math.min(maxScale, Number((prev + delta).toFixed(2)))));
  };

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
        className="flex flex-col gap-2 rounded-[var(--mz-radius-control)] border border-border-subtle bg-surface p-3 text-text-primary"
      >
        <div
          data-testid="chart-viewport"
          data-scale={scale}
          onWheel={(e) => handleViewportWheel(e, MAX_INLINE_SCALE, setScale)}
          className="h-60 w-full overflow-auto rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-2"
        >
          {renderGraphic(scale)}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <figcaption className="min-w-0 flex-1 truncate text-xs text-text-secondary">
            {caption && caption.trim().length > 0 ? caption : t('examKitChartCaptionFallback')}
          </figcaption>

          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid="chart-zoom-out"
              aria-label={t('examKitZoomOutAction')}
              disabled={scale <= MIN_INLINE_SCALE}
              onClick={() => setScale((s) => Math.max(MIN_INLINE_SCALE, Number((s - 0.5).toFixed(1))))}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-border-subtle bg-bg-raised text-text-primary hover:bg-surface-hover disabled:opacity-40"
            >
              <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <span className="min-w-[2.75rem] text-center font-mono-exam text-xs text-text-secondary">
              {scale.toFixed(1)}x
            </span>
            <button
              type="button"
              data-testid="chart-zoom-in"
              aria-label={t('examKitZoomInAction')}
              disabled={scale >= MAX_INLINE_SCALE}
              onClick={() => setScale((s) => Math.min(MAX_INLINE_SCALE, Number((s + 0.5).toFixed(1))))}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-border-subtle bg-bg-raised text-text-primary hover:bg-surface-hover disabled:opacity-40"
            >
              <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              data-testid="chart-zoom-reset"
              aria-label={t('examKitZoomResetAction')}
              disabled={scale === 1}
              onClick={() => setScale(1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-border-subtle bg-bg-raised text-text-primary hover:bg-surface-hover disabled:opacity-40"
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
              className="inline-flex h-7 items-center gap-1 rounded border border-border-subtle bg-bg-raised px-2.5 text-xs font-semibold text-primary hover:bg-surface-hover"
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
          onWheel={(e) => handleViewportWheel(e, MAX_LIGHTBOX_SCALE, setLightboxScale)}
          className="h-[420px] w-full overflow-auto rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-4"
        >
          {renderGraphic(lightboxScale)}
        </div>
      </MzModal>
    </LtrExamBoundary>
  );
}
