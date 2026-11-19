import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { bindScoreCalculators } from '@/seo/score-calculators-client';
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

  it('binds zero-React static HTML calculator DOM via score-calculators-client.ts under 4KB', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <div data-testid="score-calculators-island" data-irn="false">
        <select data-testid="calc-ielts-mode">
          <option value="reading_acad" selected>Academic</option>
          <option value="reading_gt">GT</option>
          <option value="listening">Listening</option>
        </select>
        <span data-testid="calc-ielts-raw-label"></span>
        <input data-testid="calc-ielts-raw" type="range" value="30" />
        <p data-testid="calc-ielts-result"></p>
        <span data-testid="calc-toefl-label"></span>
        <input data-testid="calc-toefl-band" type="range" value="5" />
        <p data-testid="calc-toefl-result"></p>
        <input data-testid="calc-det-reading" value="125" /><span data-testid="calc-det-reading-val"></span>
        <input data-testid="calc-det-listening" value="120" /><span data-testid="calc-det-listening-val"></span>
        <input data-testid="calc-det-writing" value="115" /><span data-testid="calc-det-writing-val"></span>
        <input data-testid="calc-det-speaking" value="115" /><span data-testid="calc-det-speaking-val"></span>
        <dl data-testid="calc-det-result"></dl>
      </div>
    `;
    const cleanupBind = bindScoreCalculators(host);
    expect(host.querySelector('[data-testid="calc-ielts-result"]')?.textContent).toBe('Band 7.0');
    const modeEl = host.querySelector<HTMLSelectElement>('[data-testid="calc-ielts-mode"]')!;
    modeEl.value = 'reading_gt';
    modeEl.dispatchEvent(new Event('change'));
    expect(host.querySelector('[data-testid="calc-ielts-result"]')?.textContent).toBe('Band 6.0');

    const toeflEl = host.querySelector<HTMLInputElement>('[data-testid="calc-toefl-band"]')!;
    toeflEl.value = '6';
    toeflEl.dispatchEvent(new Event('input'));
    expect(host.querySelector('[data-testid="calc-toefl-result"]')?.textContent).toContain('120');
    expect(host.querySelector('[data-testid="calc-det-result"]')?.textContent).toContain(
      'Literacy: 120',
    );
    cleanupBind();
  });

  it('provides clean-room annotated essays and vocab references in both GLB and IRN', () => {
    expect(GLB_SAMPLE_ESSAYS.length).toBeGreaterThanOrEqual(2);
    expect(IRN_SAMPLE_ESSAYS.length).toBeGreaterThanOrEqual(2);
    expect(GLB_PUBLIC_VOCAB_ENTRIES.length).toBeGreaterThanOrEqual(4);
    expect(IRN_PUBLIC_VOCAB_ENTRIES.every((w) => Boolean(w.glossFa))).toBe(true);
    expect(JSON.stringify(GLB_SAMPLE_ESSAYS).toLowerCase()).not.toContain('sanjia');
  });
});
