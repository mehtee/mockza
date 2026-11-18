import type { EditionCode } from '../edition-config';
import { formatChromeNumber } from './numerals';

/**
 * Formats byte sizes for Settings & Cache UI (`B`, `KB`, `MB`, `GB`),
 * localizing digits in IRN edition without pulling currency helpers into GLB bundles.
 */
export function formatByteSize(bytes: number, edition: EditionCode): string {
  const safeBytes = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (safeBytes < 1024) {
    return `${formatChromeNumber(Math.round(safeBytes), edition)} B`;
  }
  const kb = safeBytes / 1024;
  if (kb < 1024) {
    return `${formatChromeNumber(kb.toFixed(1), edition)} KB`;
  }
  const mb = kb / 1024;
  if (mb < 1024) {
    return `${formatChromeNumber(mb.toFixed(1), edition)} MB`;
  }
  const gb = mb / 1024;
  return `${formatChromeNumber(gb.toFixed(2), edition)} GB`;
}
