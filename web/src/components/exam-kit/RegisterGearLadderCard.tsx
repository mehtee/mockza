import { Volume2, BookmarkPlus, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { RegisterShifterResult } from '@/gateways/linguistic.gateway';

export interface RegisterGearLadderCardProps {
  readonly result: RegisterShifterResult;
  readonly selectedGear: 0 | 1 | 2;
  readonly isRtl: boolean;
  readonly onSelectGear: (gear: 0 | 1 | 2) => void;
  readonly onSavePhraseToDeck?: (phrase: string, rationale: string) => void;
  readonly savedPhrases?: readonly string[];
}

const GEAR_STYLES: ReadonlyArray<{
  gear: 0 | 1 | 2;
  labelEn: string;
  labelFa: string;
  badgeVar: string;
}> = [
  { gear: 0, labelEn: 'Gear 0 · Casual', labelFa: 'دنده ۰ · دوستانه', badgeVar: 'var(--mz-color-gear-casual)' },
  { gear: 1, labelEn: 'Gear 1 · Workplace', labelFa: 'دنده ۱ · محیط کار', badgeVar: 'var(--mz-color-gear-work)' },
  { gear: 2, labelEn: 'Gear 2 · Academic 8.5', labelFa: 'دنده ۲ · آکادمیک ۸.۵', badgeVar: 'var(--mz-color-gear-academic)' },
];

export function RegisterGearLadderCard({
  result,
  selectedGear,
  isRtl,
  onSelectGear,
  onSavePhraseToDeck,
  savedPhrases = [],
}: RegisterGearLadderCardProps) {
  const activeSentence =
    selectedGear === 0
      ? result.gears.casual
      : selectedGear === 1
        ? result.gears.workplace
        : result.gears.academic;

  const activeGearMeta = GEAR_STYLES[selectedGear]!;

  return (
    <section
      data-testid="register-gear-ladder"
      className="rounded-[var(--mz-radius-card)] border border-border-subtle bg-bg-surface p-5 shadow-sm"
    >
      {/* 3-Gear Slider / Segmented Control */}
      <div
        role="tablist"
        aria-label={isRtl ? 'اسلایدر تغییر لحن ۳ دنده' : '3-Gear Register Ladder'}
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {GEAR_STYLES.map((item) => {
          const isActive = selectedGear === item.gear;
          return (
            <button
              key={item.gear}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`gear-tab-${item.gear}`}
              onClick={() => onSelectGear(item.gear)}
              className={`flex items-center justify-between rounded-[var(--mz-radius-compact)] border px-3.5 py-2.5 text-start text-xs font-semibold transition-colors ${
                isActive
                  ? 'border-primary bg-surface-alt text-text-primary shadow-sm'
                  : 'border-border-subtle bg-bg-raised text-text-secondary hover:bg-surface-hover'
              }`}
            >
              <span>{isRtl ? item.labelFa : item.labelEn}</span>
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.badgeVar }}
              />
            </button>
          );
        })}
      </div>

      {/* Output Sentence inside Strict LTR Exam Boundary */}
      <div className="mt-4 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-[var(--mz-radius-pill)] px-2.5 py-0.5 text-[11px] font-semibold text-white"
            style={{ backgroundColor: activeGearMeta.badgeVar }}
          >
            {isRtl ? activeGearMeta.labelFa : activeGearMeta.labelEn}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-text-secondary">
            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
            {isRtl ? 'نسخه هدف برای تکرار شفاهی' : 'Target Register Output'}
          </span>
        </div>

        <LtrExamBoundary className="font-editorial text-xl leading-relaxed text-text-primary">
          <p data-testid="register-active-sentence">{activeSentence}</p>
        </LtrExamBoundary>
      </div>

      {/* Why did this shift improve score? + 1-tap SM-2 Capture */}
      {result.shiftHighlights.length > 0 ? (
        <div className="mt-4 space-y-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            {isRtl ? 'چرا این ارتقای لحن نمره شما را بالا می‌برد؟' : 'Why This Register Upgrade Raises Your Score'}
          </h3>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {result.shiftHighlights.map((item, idx) => {
              const isSaved = savedPhrases.includes(item.upgradedPhrase);
              const rationaleText =
                isRtl && item.whyFa ? item.whyFa : item.whyEn;
              return (
                <div
                  key={`${item.upgradedPhrase}-${idx}`}
                  className="flex flex-col justify-between rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3 text-xs"
                >
                  <div>
                    <LtrExamBoundary className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
                      <span className="rounded bg-surface-alt px-1.5 py-0.5 text-text-secondary line-through">
                        {item.casualPhrase}
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 font-semibold text-primary">
                        {item.upgradedPhrase}
                      </span>
                    </LtrExamBoundary>
                    <p className="mt-2 leading-relaxed text-text-secondary">{rationaleText}</p>
                  </div>

                  {onSavePhraseToDeck ? (
                    <button
                      type="button"
                      disabled={isSaved}
                      onClick={() => onSavePhraseToDeck(item.upgradedPhrase, rationaleText)}
                      className="mt-2.5 inline-flex items-center gap-1.5 self-start rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-surface px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-surface-hover disabled:opacity-60"
                    >
                      {isSaved ? (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>
                        {isSaved
                          ? isRtl
                            ? 'در دِک SM-2 ذخیره شد'
                            : 'Saved to SM-2 Deck'
                          : isRtl
                            ? 'ذخیره در دِک SM-2'
                            : 'Save to SM-2 Deck'}
                      </span>
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
