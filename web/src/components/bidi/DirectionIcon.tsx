import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { EditionCode } from '@/edition/edition-config';
import { getActiveEditionCode } from '@/edition/edition-config';

export interface DirectionIconProps {
  readonly edition?: EditionCode;
  readonly className?: string;
}

export function ForwardArrowIcon({ edition, className = 'h-4 w-4' }: DirectionIconProps) {
  const isRtl = (edition ?? getActiveEditionCode()) === 'irn';
  const Icon = isRtl ? ArrowLeft : ArrowRight;
  return <Icon className={className} aria-hidden="true" />;
}

export function BackArrowIcon({ edition, className = 'h-4 w-4' }: DirectionIconProps) {
  const isRtl = (edition ?? getActiveEditionCode()) === 'irn';
  const Icon = isRtl ? ArrowRight : ArrowLeft;
  return <Icon className={className} aria-hidden="true" />;
}

export function ForwardChevronIcon({ edition, className = 'h-4 w-4' }: DirectionIconProps) {
  const isRtl = (edition ?? getActiveEditionCode()) === 'irn';
  const Icon = isRtl ? ChevronLeft : ChevronRight;
  return <Icon className={className} aria-hidden="true" />;
}

export function BackChevronIcon({ edition, className = 'h-4 w-4' }: DirectionIconProps) {
  const isRtl = (edition ?? getActiveEditionCode()) === 'irn';
  const Icon = isRtl ? ChevronRight : ChevronLeft;
  return <Icon className={className} aria-hidden="true" />;
}
