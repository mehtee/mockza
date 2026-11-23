import type { EditionCode } from '@/edition/edition-config';

export interface BrandMarkProps {
  readonly edition: EditionCode;
  readonly size?: number;
  readonly className?: string;
}

/**
 * Crisp geometric vector emblem shared across Sanjia (IRN) and Mockza (GLB).
 * Uses currentColor so it adapts seamlessly across light/dark surfaces and tiles cleanly at 16–40px.
 */
export function BrandMark({ edition, size = 28, className = '' }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={['shrink-0 text-primary', className].filter(Boolean).join(' ')}
    >
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="8.5"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="1.25"
      />
      {edition === 'irn' ? (
        <>
          {/* Stylized calligraphic scale-crown echoing Persian letter «س» */}
          <path
            d="M8.5 11.25v3a3.25 3.25 0 0 0 3.25 3.25h8.5a3.25 3.25 0 0 0 3.25-3.25v-3"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M16 9.5v8"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          {/* Precision assessment nib base */}
          <path
            d="M12.25 20.5h7.5L16 26.25l-3.75-5.75Z"
            fill="currentColor"
          />
          <circle cx="16" cy="22.15" r="0.95" fill="var(--mz-surface, #ffffff)" />
        </>
      ) : (
        <>
          {/* Geometric editorial M + precision nib dot */}
          <path
            d="M8.75 21.75V10.75l7.25 6.5 7.25-6.5v11"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="23.25" r="1.6" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
