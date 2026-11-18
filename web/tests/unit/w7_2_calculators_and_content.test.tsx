import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ScoreCalculatorsIsland } from '@/seo/ScoreCalculatorsIsland';
import {
  GLB_PUBLIC_VOCAB_ENTRIES,
  GLB_SAMPLE_ESSAYS,
} from '@/seo/public-catalog-glb';
import {
  IRN_PUBLIC_VOCAB_ENTRIES,
  IRN_SAMPLE_ESSAYS,
} from '@/seo/public-catalog-irn';

describe('W7.2 Public Calculators, Sample Bank & Vocab Reference', () => {
  afterEach(() => {
    cleanup();
  });

  it('recomputes IELTS Academic/GT Reading & Listening, TOEFL /120, and DET subscores live from @mockza/domain', () => {
    render(<ScoreCalculatorsIsland />);

    expect(screen.getByTestId('calc-ielts-result').textContent).toBe('Band 7.0');
    fireEvent.change(screen.getByTestId('calc-ielts-mode'), { target: { value: 'reading_gt' } });
    expect(screen.getByTestId('calc-ielts-result').textContent).toBe('Band 6.0');

    expect(screen.getByTestId('calc-toefl-result').textContent).toContain('100');
    fireEvent.change(screen.getByTestId('calc-toefl-band'), { target: { value: '6' } });
    expect(screen.getByTestId('calc-toefl-result').textContent).toContain('120');

    expect(screen.getByTestId('calc-det-result').textContent).toContain('Literacy: 120');
  });

  it('provides clean-room annotated essays and vocab references in both GLB and IRN', () => {
    expect(GLB_SAMPLE_ESSAYS.length).toBeGreaterThanOrEqual(2);
    expect(IRN_SAMPLE_ESSAYS.length).toBeGreaterThanOrEqual(2);
    expect(GLB_PUBLIC_VOCAB_ENTRIES.length).toBeGreaterThanOrEqual(4);
    expect(IRN_PUBLIC_VOCAB_ENTRIES.every((w) => Boolean(w.glossFa))).toBe(true);
    expect(JSON.stringify(GLB_SAMPLE_ESSAYS).toLowerCase()).not.toContain('sanjia');
  });
});
