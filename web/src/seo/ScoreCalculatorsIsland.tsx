import {
  computeDetSubscores,
  estimateToeflLegacy120,
  listeningBandFor,
  readingBandFor,
  type ExamModuleType,
} from '@mockza/domain';
import { useState } from 'react';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const fmt = (val: string | number, isIrn: boolean): string =>
  isIrn ? String(val).replace(/\d/g, (d) => FA_DIGITS[Number(d)] ?? d) : String(val);

export interface ScoreCalculatorsIslandProps {
  readonly isIrn?: boolean;
}

export function ScoreCalculatorsIsland({ isIrn = false }: ScoreCalculatorsIslandProps) {
  const [ieltsRaw, setIeltsRaw] = useState(30);
  const [ieltsMode, setIeltsMode] = useState<'listening' | 'reading_acad' | 'reading_gt'>(
    'reading_acad',
  );
  const [toeflBand, setToeflBand] = useState(5.0);
  const [detReading, setDetReading] = useState(125);
  const [detListening, setDetListening] = useState(120);
  const [detWriting, setDetWriting] = useState(115);
  const [detSpeaking, setDetSpeaking] = useState(115);

  const ieltsBand =
    ieltsMode === 'listening'
      ? listeningBandFor(ieltsRaw)
      : readingBandFor(
          ieltsRaw,
          (ieltsMode === 'reading_gt' ? 'general_training' : 'academic') as ExamModuleType,
        );

  const toefl120 = estimateToeflLegacy120(toeflBand);
  const detSub = computeDetSubscores({
    reading: detReading,
    listening: detListening,
    writing: detWriting,
    speaking: detSpeaking,
  });

  return (
    <div data-testid="score-calculators-island" className="grid gap-6 md:grid-cols-3 text-start">
      {/* IELTS Raw-to-Band */}
      <section className="rounded-[var(--mz-radius-card)] border border-border-subtle bg-surface p-5">
        <h2 className="text-base font-bold text-text-primary">
          {isIrn ? 'محاسبه نمره خام آیلتس (۰ تا ۴۰)' : 'IELTS Raw-to-Band Converter'}
        </h2>
        <div className="mt-3 flex flex-col gap-2 text-xs">
          <label htmlFor="calc-ielts-mode" className="text-text-secondary">
            {isIrn ? 'بخش آزمون' : 'Module Curve'}
          </label>
          <select
            id="calc-ielts-mode"
            data-testid="calc-ielts-mode"
            value={ieltsMode}
            onChange={(e) =>
              setIeltsMode(e.target.value as 'listening' | 'reading_acad' | 'reading_gt')
            }
            className="h-9 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-2 text-text-primary"
          >
            <option value="reading_acad">
              {isIrn ? 'ریدینگ آکادمیک (Academic Reading)' : 'Academic Reading'}
            </option>
            <option value="reading_gt">
              {isIrn ? 'ریدینگ جنرال (General Training Reading)' : 'General Training Reading'}
            </option>
            <option value="listening">{isIrn ? 'لیسنینگ (Listening)' : 'Listening'}</option>
          </select>

          <label htmlFor="calc-ielts-raw" className="mt-2 text-text-secondary">
            {isIrn ? `تعداد پاسخ صحیح: ${fmt(ieltsRaw, true)}` : `Correct Answers: ${ieltsRaw} / 40`}
          </label>
          <input
            id="calc-ielts-raw"
            data-testid="calc-ielts-raw"
            type="range"
            min={0}
            max={40}
            value={ieltsRaw}
            onChange={(e) => setIeltsRaw(Number(e.target.value))}
            className="w-full accent-primary"
          />

          <p
            data-testid="calc-ielts-result"
            className="mt-2 font-mono-exam text-2xl font-bold text-primary"
          >
            {isIrn ? `باند ${fmt(ieltsBand.toFixed(1), true)}` : `Band ${ieltsBand.toFixed(1)}`}
          </p>
        </div>
      </section>

      {/* TOEFL 1.0–6.0 -> 0–120 */}
      <section className="rounded-[var(--mz-radius-card)] border border-border-subtle bg-surface p-5">
        <h2 className="text-base font-bold text-text-primary">
          {isIrn ? 'تبدیل تافل ۲۰۲۶ (۶ به ۱۲۰)' : 'TOEFL iBT 2026 (1–6 to 0–120)'}
        </h2>
        <div className="mt-3 flex flex-col gap-2 text-xs">
          <label htmlFor="calc-toefl-band" className="text-text-secondary">
            {isIrn
              ? `نمره ۲۰۲۶: ${fmt(toeflBand.toFixed(1), true)}`
              : `2026 Band: ${toeflBand.toFixed(1)} / 6.0`}
          </label>
          <input
            id="calc-toefl-band"
            data-testid="calc-toefl-band"
            type="range"
            min={1}
            max={6}
            step={0.5}
            value={toeflBand}
            onChange={(e) => setToeflBand(Number(e.target.value))}
            className="w-full accent-primary"
          />

          <p
            data-testid="calc-toefl-result"
            className="mt-2 font-mono-exam text-2xl font-bold text-primary"
          >
            {isIrn ? `~${fmt(toefl120, true)} / ۱۲۰` : `~${toefl120} / 120`}
          </p>
        </div>
      </section>

      {/* DET Subscores */}
      <section className="rounded-[var(--mz-radius-card)] border border-border-subtle bg-surface p-5">
        <h2 className="text-base font-bold text-text-primary">
          {isIrn ? 'شبیه‌ساز زیرمقیاس‌های DET' : 'DET 4-Subscore Simulator'}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <label className="flex flex-col gap-1">
            <span>
              {isIrn ? 'ریدینگ' : 'Reading'} ({fmt(detReading, isIrn)})
            </span>
            <input
              type="range"
              min={10}
              max={160}
              step={5}
              value={detReading}
              onChange={(e) => setDetReading(Number(e.target.value))}
              className="accent-primary"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>
              {isIrn ? 'لیسنینگ' : 'Listening'} ({fmt(detListening, isIrn)})
            </span>
            <input
              type="range"
              min={10}
              max={160}
              step={5}
              value={detListening}
              onChange={(e) => setDetListening(Number(e.target.value))}
              className="accent-primary"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>
              {isIrn ? 'رایتینگ' : 'Writing'} ({fmt(detWriting, isIrn)})
            </span>
            <input
              type="range"
              min={10}
              max={160}
              step={5}
              value={detWriting}
              onChange={(e) => setDetWriting(Number(e.target.value))}
              className="accent-primary"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>
              {isIrn ? 'اسپیکینگ' : 'Speaking'} ({fmt(detSpeaking, isIrn)})
            </span>
            <input
              type="range"
              min={10}
              max={160}
              step={5}
              value={detSpeaking}
              onChange={(e) => setDetSpeaking(Number(e.target.value))}
              className="accent-primary"
            />
          </label>
        </div>

        <dl
          data-testid="calc-det-result"
          className={`mt-3 grid grid-cols-2 gap-1.5 ${isIrn ? '' : 'font-mono-exam '}text-xs font-semibold text-primary`}
        >
          <div>{isIrn ? `سواد: ${fmt(detSub.literacy ?? '—', true)}` : `Literacy: ${detSub.literacy ?? '—'}`}</div>
          <div>{isIrn ? `درک: ${fmt(detSub.comprehension ?? '—', true)}` : `Comp: ${detSub.comprehension ?? '—'}`}</div>
          <div>{isIrn ? `مکالمه: ${fmt(detSub.conversation ?? '—', true)}` : `Conv: ${detSub.conversation ?? '—'}`}</div>
          <div>{isIrn ? `تولید: ${fmt(detSub.production ?? '—', true)}` : `Prod: ${detSub.production ?? '—'}`}</div>
        </dl>
      </section>
    </div>
  );
}
