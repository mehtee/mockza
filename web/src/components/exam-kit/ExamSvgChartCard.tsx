import DOMPurify from 'dompurify';
import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useState, type WheelEvent } from 'react';
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

/**
 * Prevents chart titles from colliding with top-anchored SVG legends by
 * inspecting `<text>` and legend `<g>` coordinates and shifting the legend
 * downward (or expanding the viewBox slightly) when vertical bounds overlap.
 * Works generically for any dynamically authored SVG chart.
 */
function preventSvgHeaderLegendOverlap(svgMarkup: string): string {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined' || !svgMarkup) {
    return svgMarkup;
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgMarkup, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg || doc.querySelector('parsererror')) return svgMarkup;

    const texts = Array.from(svg.querySelectorAll('text'));
    if (texts.length < 2) return svgMarkup;

    // Locate top header title (y <= 54, font-size >= 15 or bold) and optional subtitle (y <= 74)
    let titleBottomY = 0;
    let subtitleBottomY = 0;
    for (const el of texts) {
      const y = Number.parseFloat(el.getAttribute('y') ?? '');
      if (!Number.isFinite(y) || y > 74) continue;
      const fs = Number.parseFloat(el.getAttribute('font-size') ?? '14');
      const fw = (el.getAttribute('font-weight') ?? '').toLowerCase();
      if (y <= 54 && (fs >= 15 || fw === 'bold' || fw === '700' || fw === '600')) {
        titleBottomY = Math.max(titleBottomY, y + 6);
      } else if (y > 46 && y <= 74 && fs <= 14) {
        subtitleBottomY = Math.max(subtitleBottomY, y + 6);
      }
    }
    if (titleBottomY <= 0) return svgMarkup;

    // Look for legend rects/lines/circles placed in the top header band (y <= titleBottomY + 12)
    const legendSwatches = Array.from(svg.querySelectorAll('rect, line, circle')).filter((el) => {
      const tag = el.tagName.toLowerCase();
      const yAttr = tag === 'circle' ? 'cy' : tag === 'line' ? 'y1' : 'y';
      const y = Number.parseFloat(el.getAttribute(yAttr) ?? '');
      if (!Number.isFinite(y) || y <= 4 || y > titleBottomY + 12) return false;
      if (tag === 'rect') {
        const w = Number.parseFloat(el.getAttribute('width') ?? '0');
        const h = Number.parseFloat(el.getAttribute('height') ?? '0');
        // Exclude full-bleed background rects
        return w > 0 && w <= 36 && h > 0 && h <= 20;
      }
      return true;
    });

    if (legendSwatches.length === 0) return svgMarkup;

    const minSwatchY = Math.min(
      ...legendSwatches.map((el) => {
        const tag = el.tagName.toLowerCase();
        const attr = tag === 'circle' ? 'cy' : tag === 'line' ? 'y1' : 'y';
        return Number.parseFloat(el.getAttribute(attr) ?? '30');
      }),
    );
    const targetLegendTopY = Math.max(titleBottomY + 10, subtitleBottomY + 4);
    const shiftY = Math.max(18, Math.round(targetLegendTopY - minSwatchY));

    // Collect parent <g> or individual legend elements that overlap the header
    const legendGroup = legendSwatches[0]?.closest('g');
    if (legendGroup && legendGroup !== svg) {
      const existing = legendGroup.getAttribute('transform') ?? '';
      legendGroup.setAttribute('transform', `${existing} translate(0, ${shiftY})`.trim());
      return new XMLSerializer().serializeToString(svg);
    }

    // Fallback: shift top-band swatches & adjacent legend text labels down cleanly below header/subtitle
    for (const swatch of legendSwatches) {
      const tag = swatch.tagName.toLowerCase();
      if (tag === 'rect') {
        const y = Number.parseFloat(swatch.getAttribute('y') ?? '0');
        swatch.setAttribute('y', String(y + shiftY));
      } else if (tag === 'circle') {
        const cy = Number.parseFloat(swatch.getAttribute('cy') ?? '0');
        swatch.setAttribute('cy', String(cy + shiftY));
      } else if (tag === 'line') {
        const y1 = Number.parseFloat(swatch.getAttribute('y1') ?? '0');
        const y2 = Number.parseFloat(swatch.getAttribute('y2') ?? '0');
        swatch.setAttribute('y1', String(y1 + shiftY));
        swatch.setAttribute('y2', String(y2 + shiftY));
      }
    }
    for (const el of texts) {
      const y = Number.parseFloat(el.getAttribute('y') ?? '');
      const fs = Number.parseFloat(el.getAttribute('font-size') ?? '12');
      const fw = (el.getAttribute('font-weight') ?? '').toLowerCase();
      const isTitle = fs >= 15 || fw === 'bold' || fw === '700' || fw === '600';
      if (!isTitle && Number.isFinite(y) && y > 16 && y <= titleBottomY + 12 && fs <= 13) {
        el.setAttribute('y', String(y + shiftY));
      }
    }
    return new XMLSerializer().serializeToString(svg);
  } catch {
    return svgMarkup;
  }
}

export function sanitizeSvgMarkup(rawSvg: string): string {
  if (typeof window === 'undefined' || !rawSvg) return '';
  const purified = DOMPurify.sanitize(rawSvg, {
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
  return preventSvgHeaderLegendOverlap(purified);
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
  const [fetchedSvgMarkup, setFetchedSvgMarkup] = useState<string | null>(null);

  useEffect(() => {
    if (svgMarkup || !svgUrl || typeof window === 'undefined') {
      setFetchedSvgMarkup(null);
      return;
    }
    const lowerUrl = svgUrl.toLowerCase();
    if (!lowerUrl.includes('.svg') && !lowerUrl.startsWith('/v1/media/')) {
      setFetchedSvgMarkup(null);
      return;
    }
    let cancelled = false;
    void fetch(svgUrl)
      .then((res) => (res.ok ? res.text() : null))
      .then((text) => {
        if (!cancelled && text && text.includes('<svg')) {
          setFetchedSvgMarkup(text);
        }
      })
      .catch(() => {
        // Fall back gracefully to <img> if fetch fails.
      });
    return () => {
      cancelled = true;
    };
  }, [svgMarkup, svgUrl]);

  const effectiveRawSvg = svgMarkup || fetchedSvgMarkup;
  const cleanedSvg = effectiveRawSvg ? sanitizeSvgMarkup(effectiveRawSvg) : null;

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

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              data-testid="chart-zoom-out"
              aria-label={t('examKitZoomOutAction')}
              disabled={scale <= MIN_INLINE_SCALE}
              onClick={() => setScale((s) => Math.max(MIN_INLINE_SCALE, Number((s - 0.5).toFixed(1))))}
              className="inline-flex h-10 w-10 items-center justify-center rounded border border-border-subtle bg-bg-raised text-text-primary hover:bg-surface-hover disabled:opacity-40"
            >
              <ZoomOut className="h-4 w-4" aria-hidden="true" />
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
              className="inline-flex h-10 w-10 items-center justify-center rounded border border-border-subtle bg-bg-raised text-text-primary hover:bg-surface-hover disabled:opacity-40"
            >
              <ZoomIn className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              data-testid="chart-zoom-reset"
              aria-label={t('examKitZoomResetAction')}
              disabled={scale === 1}
              onClick={() => setScale(1)}
              className="inline-flex h-10 w-10 items-center justify-center rounded border border-border-subtle bg-bg-raised text-text-primary hover:bg-surface-hover disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              data-testid="chart-expand-btn"
              onClick={() => {
                setLightboxScale(1);
                setLightboxOpen(true);
              }}
              className="inline-flex min-h-10 items-center gap-1.5 rounded border border-border-subtle bg-bg-raised px-3 text-xs font-semibold text-primary hover:bg-surface-hover"
            >
              <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
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
