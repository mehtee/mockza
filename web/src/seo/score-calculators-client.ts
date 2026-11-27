import {
  computeDetSubscores,
  estimateToeflLegacy120,
  listeningBandFor,
  readingBandFor,
  type ExamModuleType,
} from '@mockza/domain';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const fmtNum = (val: string | number, isIrn: boolean): string =>
  isIrn ? String(val).replace(/\d/g, (d) => FA_DIGITS[Number(d)] ?? d) : String(val);

function convertPteToIelts(pte: number): { ielts: string; cefr: string } {
  if (pte >= 89) return { ielts: '9.0', cefr: 'C2' };
  if (pte >= 85) return { ielts: '8.5', cefr: 'C2' };
  if (pte >= 76) return { ielts: '8.0', cefr: 'C1–C2' };
  if (pte >= 66) return { ielts: '7.5', cefr: 'C1' };
  if (pte >= 59) return { ielts: '7.0', cefr: 'C1' };
  if (pte >= 52) return { ielts: '6.5', cefr: 'B2' };
  if (pte >= 43) return { ielts: '6.0', cefr: 'B2' };
  if (pte >= 36) return { ielts: '5.5', cefr: 'B2' };
  if (pte >= 30) return { ielts: '5.0', cefr: 'B1' };
  if (pte >= 24) return { ielts: '4.5', cefr: 'B1' };
  return { ielts: '4.0', cefr: 'A2' };
}

export function bindScoreCalculators(root: ParentNode = document): () => void {
  const container = root.querySelector<HTMLElement>('[data-testid="score-calculators-island"]');
  const pteInput = root.querySelector<HTMLInputElement>('[data-testid="calc-pte-score"]');
  const pteLabel = root.querySelector<HTMLElement>('[data-testid="calc-pte-label"]');
  const pteResult = root.querySelector<HTMLElement>('[data-testid="calc-pte-result"]');
  const isIrn =
    container?.dataset['irn'] === 'true' || pteResult?.closest('[data-irn]')?.getAttribute('data-irn') === 'true';

  const updatePte = () => {
    if (!pteInput) return;
    const score = Number(pteInput.value ?? 65);
    const { ielts, cefr } = convertPteToIelts(score);
    if (pteLabel) {
      pteLabel.textContent = isIrn
        ? `نمره PTE: ${fmtNum(score, true)}`
        : `PTE Academic: ${score} / 90`;
    }
    if (pteResult) {
      pteResult.textContent = isIrn
        ? `آیلتس ${fmtNum(ielts, true)} · سطح ${cefr}`
        : `IELTS ${ielts} · CEFR ${cefr}`;
    }
  };
  pteInput?.addEventListener('input', updatePte);
  updatePte();

  if (!container) {
    return () => {
      pteInput?.removeEventListener('input', updatePte);
    };
  }

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
        ? `تعداد پاسخ صحیح: ${fmtNum(raw, true)}`
        : `Correct Answers: ${raw} / 40`;
    }
    if (ieltsResultEl) {
      ieltsResultEl.textContent = isIrn
        ? `باند ${fmtNum(band.toFixed(1), true)}`
        : `Band ${band.toFixed(1)}`;
    }
  };

  const updateToefl = () => {
    const band = Number(toeflBandEl?.value ?? 5.0);
    const legacy = estimateToeflLegacy120(band);
    if (toeflBandLabelEl) {
      toeflBandLabelEl.textContent = isIrn
        ? `نمره ۲۰۲۶: ${fmtNum(band.toFixed(1), true)}`
        : `2026 Band: ${band.toFixed(1)} / 6.0`;
    }
    if (toeflResultEl) {
      toeflResultEl.textContent = isIrn
        ? `~${fmtNum(legacy, true)} / ۱۲۰`
        : `~${legacy} / 120`;
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
    if (rOut) rOut.textContent = fmtNum(r, isIrn);
    if (lOut) lOut.textContent = fmtNum(l, isIrn);
    if (wOut) wOut.textContent = fmtNum(w, isIrn);
    if (sOut) sOut.textContent = fmtNum(s, isIrn);
    if (detResultEl) {
      detResultEl.innerHTML = isIrn
        ? `<div>سواد: ${fmtNum(sub.literacy ?? '—', true)}</div>` +
          `<div>درک: ${fmtNum(sub.comprehension ?? '—', true)}</div>` +
          `<div>مکالمه: ${fmtNum(sub.conversation ?? '—', true)}</div>` +
          `<div>تولید: ${fmtNum(sub.production ?? '—', true)}</div>`
        : `<div>Literacy: ${sub.literacy ?? '—'}</div>` +
          `<div>Comp: ${sub.comprehension ?? '—'}</div>` +
          `<div>Conv: ${sub.conversation ?? '—'}</div>` +
          `<div>Prod: ${sub.production ?? '—'}</div>`;
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
    pteInput?.removeEventListener('input', updatePte);
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
