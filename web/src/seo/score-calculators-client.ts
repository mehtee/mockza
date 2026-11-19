import {
  computeDetSubscores,
  estimateToeflLegacy120,
  listeningBandFor,
  readingBandFor,
  type ExamModuleType,
} from '@mockza/domain';

export function bindScoreCalculators(root: ParentNode = document): () => void {
  const container = root.querySelector<HTMLElement>('[data-testid="score-calculators-island"]');
  if (!container) return () => {};

  const isIrn = container.dataset['irn'] === 'true';

  const ieltsModeEl = container.querySelector<HTMLSelectElement>('[data-testid="calc-ielts-mode"]');
  const ieltsRawEl = container.querySelector<HTMLInputElement>('[data-testid="calc-ielts-raw"]');
  const ieltsRawLabelEl = container.querySelector<HTMLElement>('[data-testid="calc-ielts-raw-label"]');
  const ieltsResultEl = container.querySelector<HTMLElement>('[data-testid="calc-ielts-result"]');

  const toeflBandEl = container.querySelector<HTMLInputElement>('[data-testid="calc-toefl-band"]');
  const toeflBandLabelEl = container.querySelector<HTMLElement>('[data-testid="calc-toefl-label"]');
  const toeflResultEl = container.querySelector<HTMLElement>('[data-testid="calc-toefl-result"]');

  const detR = container.querySelector<HTMLInputElement>('[data-testid="calc-det-reading"]');
  const detL = container.querySelector<HTMLInputElement>('[data-testid="calc-det-listening"]');
  const detW = container.querySelector<HTMLInputElement>('[data-testid="calc-det-writing"]');
  const detS = container.querySelector<HTMLInputElement>('[data-testid="calc-det-speaking"]');
  const detResultEl = container.querySelector<HTMLElement>('[data-testid="calc-det-result"]');

  const updateIelts = () => {
    const mode = (ieltsModeEl?.value ?? 'reading_acad') as 'listening' | 'reading_acad' | 'reading_gt';
    const raw = Number(ieltsRawEl?.value ?? 30);
    const band =
      mode === 'listening'
        ? listeningBandFor(raw)
        : readingBandFor(raw, (mode === 'reading_gt' ? 'general_training' : 'academic') as ExamModuleType);
    if (ieltsRawLabelEl) {
      ieltsRawLabelEl.textContent = isIrn
        ? `تعداد پاسخ صحیح: ${raw}`
        : `Correct Answers: ${raw} / 40`;
    }
    if (ieltsResultEl) {
      ieltsResultEl.textContent = `Band ${band.toFixed(1)}`;
    }
  };

  const updateToefl = () => {
    const band = Number(toeflBandEl?.value ?? 5.0);
    const legacy = estimateToeflLegacy120(band);
    if (toeflBandLabelEl) {
      toeflBandLabelEl.textContent = isIrn
        ? `نمره ۲۰۲۶: ${band.toFixed(1)}`
        : `2026 Band: ${band.toFixed(1)} / 6.0`;
    }
    if (toeflResultEl) {
      toeflResultEl.textContent = `~${legacy} / 120`;
    }
  };

  const updateDet = () => {
    const r = Number(detR?.value ?? 125);
    const l = Number(detL?.value ?? 120);
    const w = Number(detW?.value ?? 115);
    const s = Number(detS?.value ?? 115);
    const sub = computeDetSubscores({ reading: r, listening: l, writing: w, speaking: s });

    const rOut = container.querySelector<HTMLElement>('[data-testid="calc-det-reading-val"]');
    const lOut = container.querySelector<HTMLElement>('[data-testid="calc-det-listening-val"]');
    const wOut = container.querySelector<HTMLElement>('[data-testid="calc-det-writing-val"]');
    const sOut = container.querySelector<HTMLElement>('[data-testid="calc-det-speaking-val"]');
    if (rOut) rOut.textContent = String(r);
    if (lOut) lOut.textContent = String(l);
    if (wOut) wOut.textContent = String(w);
    if (sOut) sOut.textContent = String(s);
    if (detResultEl) {
      detResultEl.innerHTML =
        `<div>Literacy: ${sub.literacy}</div>` +
        `<div>Comp: ${sub.comprehension}</div>` +
        `<div>Conv: ${sub.conversation}</div>` +
        `<div>Prod: ${sub.production}</div>`;
    }
  };

  ieltsModeEl?.addEventListener('change', updateIelts);
  ieltsRawEl?.addEventListener('input', updateIelts);
  toeflBandEl?.addEventListener('input', updateToefl);
  detR?.addEventListener('input', updateDet);
  detL?.addEventListener('input', updateDet);
  detW?.addEventListener('input', updateDet);
  detS?.addEventListener('input', updateDet);

  updateIelts();
  updateToefl();
  updateDet();

  return () => {
    ieltsModeEl?.removeEventListener('change', updateIelts);
    ieltsRawEl?.removeEventListener('input', updateIelts);
    toeflBandEl?.removeEventListener('input', updateToefl);
    detR?.removeEventListener('input', updateDet);
    detL?.removeEventListener('input', updateDet);
    detW?.removeEventListener('input', updateDet);
    detS?.removeEventListener('input', updateDet);
  };
}

if (typeof document !== 'undefined') {
  bindScoreCalculators(document);
}
