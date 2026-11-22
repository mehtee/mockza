import type { EvidencePolarity } from '../advanced/linguistic-graph-math.js';
import type { CoreExamSkill } from './live-band-engine.js';

export interface QuestionTypeStatInput {
  readonly questionType: string;
  readonly correct: number;
  readonly total: number;
}

export interface ExtractedWeaknessSignal {
  readonly canonicalKey: string;
  readonly skillScope: CoreExamSkill | 'vocabulary';
  readonly displayLabelEn: string;
  readonly displayLabelFa: string;
  readonly coachNoteEn: string;
  readonly coachNoteFa: string;
  readonly observedPolarity: EvidencePolarity;
}

interface WeaknessTemplate {
  readonly canonicalKey: string;
  readonly skillScope: CoreExamSkill | 'vocabulary';
  readonly displayLabelEn: string;
  readonly displayLabelFa: string;
  readonly coachNoteEn: string;
  readonly coachNoteFa: string;
}

const WEAKNESS_CATALOG: Record<string, WeaknessTemplate> = {
  'reading:tfng_trap': {
    canonicalKey: 'reading:tfng_trap',
    skillScope: 'reading',
    displayLabelEn: 'True / False / Not Given Traps',
    displayLabelFa: 'تله‌های True / False / Not Given در ریدینگ',
    coachNoteEn: 'Distinguish contradictions (False) from unstated details (Not Given).',
    coachNoteFa: 'تفاوت میان اطلاعات متضاد (False) و ذکرنشده (Not Given) را دقیق‌تر بررسی کنید.',
  },
  'reading:matching_headings': {
    canonicalKey: 'reading:matching_headings',
    skillScope: 'reading',
    displayLabelEn: 'Paragraph Headings & Main Idea',
    displayLabelFa: 'انتخاب عنوان پاراگراف و ایده اصلی',
    coachNoteEn: 'Identify topic sentences and overall paragraph function rather than single keywords.',
    coachNoteFa: 'به جای تکیه بر تک‌واژه، جمله موضوعی و پیام کلی پاراگراف را بیابید.',
  },
  'reading:summary_completion': {
    canonicalKey: 'reading:summary_completion',
    skillScope: 'reading',
    displayLabelEn: 'Summary & Gap-Fill Precision',
    displayLabelFa: 'دقت در تکمیل خلاصه و جای‌خالی ریدینگ',
    coachNoteEn: 'Check grammar fit, word limit, and exact synonym clues around each blank.',
    coachNoteFa: 'تناسب گرامری، سقف تعداد کلمه و مترادف‌های اطراف جای‌خالی را بررسی کنید.',
  },
  'reading:paraphrase_matching': {
    canonicalKey: 'reading:paraphrase_matching',
    skillScope: 'reading',
    displayLabelEn: 'Academic Paraphrase Recognition',
    displayLabelFa: 'تشخیص بازنویسی و مترادف‌های آکادمیک',
    coachNoteEn: 'Practice spotting paraphrased verbs and abstract noun equivalents quickly.',
    coachNoteFa: 'تشخیص سریع مترادف‌ها و بازنویسی مفاهیم در متن را تمرین کنید.',
  },
  'listening:distractor_traps': {
    canonicalKey: 'listening:distractor_traps',
    skillScope: 'listening',
    displayLabelEn: 'Listening Self-Correction & Distractors',
    displayLabelFa: 'تله‌های اصلاح نظر و انحرافی در لیسنینگ',
    coachNoteEn: 'Wait for speaker corrections ("actually", "Wait—let’s change...") before locking an answer.',
    coachNoteFa: 'پیش از نهایی‌کردن پاسخ، منتظر اصلاح جمله توسط گوینده (مثل actually) بمانید.',
  },
  'listening:detail_capture': {
    canonicalKey: 'listening:detail_capture',
    skillScope: 'listening',
    displayLabelEn: 'Specific Numbers, Names & Note Completion',
    displayLabelFa: 'ثبت دقیق اعداد، نام‌ها و تکمیل یادداشت لیسنینگ',
    coachNoteEn: 'Predict part-of-speech before the recording starts and track signpost words.',
    coachNoteFa: 'پیش از پخش صدا، نوع کلمه مورد نیاز جای‌خالی را حدس بزنید.',
  },
  'listening:multiple_choice_attitude': {
    canonicalKey: 'listening:multiple_choice_attitude',
    skillScope: 'listening',
    displayLabelEn: 'Speaker Attitude & Inference',
    displayLabelFa: 'درک لحن و نتیجه‌گیری غیرمستقیم گوینده',
    coachNoteEn: 'Listen for hedging, agreement/disagreement markers, and implied stance.',
    coachNoteFa: 'به نشانه‌های موافقت، تردید و دیدگاه نهایی گوینده دقت کنید.',
  },
  'vocab:academic_collocation': {
    canonicalKey: 'vocab:academic_collocation',
    skillScope: 'vocabulary',
    displayLabelEn: 'Academic Collocations & Word Form',
    displayLabelFa: 'هم‌آواهای آکادمیک و فرم درست واژه',
    coachNoteEn: 'Pair verbs and nouns naturally (e.g., mitigate risk, foster innovation).',
    coachNoteFa: 'واژگان را در قالب ترکیب‌های طبیعی (Collocation) حفظ و استفاده کنید.',
  },
};

function mapQuestionTypeToWeaknessKey(
  skill: CoreExamSkill,
  questionType: string,
): string {
  const qt = questionType.trim().toLowerCase();
  if (skill === 'reading') {
    if (qt.includes('tfng') || qt.includes('ynng') || qt.includes('true_false') || qt.includes('inference')) {
      return 'reading:tfng_trap';
    }
    if (qt.includes('heading') || qt.includes('matching')) {
      return 'reading:matching_headings';
    }
    if (qt.includes('summary') || qt.includes('fill') || qt.includes('short') || qt.includes('complete') || qt.includes('explicit_detail')) {
      return 'reading:summary_completion';
    }
    return 'reading:paraphrase_matching';
  }
  if (skill === 'listening') {
    if (qt.includes('mcq') || qt.includes('multiple') || qt.includes('choose') || qt.includes('inference')) {
      return 'listening:multiple_choice_attitude';
    }
    if (qt.includes('form') || qt.includes('note') || qt.includes('gap') || qt.includes('dictation') || qt.includes('explicit_detail')) {
      return 'listening:detail_capture';
    }
    return 'listening:distractor_traps';
  }
  return 'vocab:academic_collocation';
}

function mapDrillTypeToWeaknessKey(drillType: string, skill: CoreExamSkill): string {
  const dt = drillType.trim().toLowerCase();
  if (dt.includes('tfng')) return 'reading:tfng_trap';
  if (dt.includes('collocation') || dt.includes('lexical')) return 'vocab:academic_collocation';
  if (dt.includes('distractor')) return 'listening:distractor_traps';
  if (dt.includes('paraphrase') || dt.includes('complete_words')) return 'reading:paraphrase_matching';
  if (dt.includes('reorder')) return 'reading:matching_headings';
  return skill === 'listening' ? 'listening:detail_capture' : 'reading:paraphrase_matching';
}

export function extractObjectiveWeaknesses(params: {
  readonly skill: CoreExamSkill;
  readonly questionTypeStats?: readonly QuestionTypeStatInput[];
  readonly drillType?: string | null;
  readonly correctCount?: number;
  readonly totalCount?: number;
}): ExtractedWeaknessSignal[] {
  const aggregated = new Map<string, { correct: number; total: number }>();

  if (params.questionTypeStats && params.questionTypeStats.length > 0) {
    for (const stat of params.questionTypeStats) {
      if (stat.total <= 0) continue;
      const key = mapQuestionTypeToWeaknessKey(params.skill, stat.questionType);
      const prev = aggregated.get(key) ?? { correct: 0, total: 0 };
      aggregated.set(key, {
        correct: prev.correct + Math.max(0, stat.correct),
        total: prev.total + Math.max(0, stat.total),
      });
    }
  } else if (params.drillType && (params.totalCount ?? 0) > 0) {
    const key = mapDrillTypeToWeaknessKey(params.drillType, params.skill);
    aggregated.set(key, {
      correct: Math.max(0, params.correctCount ?? 0),
      total: Math.max(1, params.totalCount ?? 1),
    });
  }

  const signals: ExtractedWeaknessSignal[] = [];
  for (const [key, counts] of aggregated.entries()) {
    if (counts.total <= 0) continue;
    const ratio = counts.correct / counts.total;
    if (ratio < 0.65 || ratio >= 0.85) {
      const tpl = WEAKNESS_CATALOG[key] ?? WEAKNESS_CATALOG['reading:paraphrase_matching']!;
      signals.push({
        canonicalKey: tpl.canonicalKey,
        skillScope: tpl.skillScope,
        displayLabelEn: tpl.displayLabelEn,
        displayLabelFa: tpl.displayLabelFa,
        coachNoteEn: tpl.coachNoteEn,
        coachNoteFa: tpl.coachNoteFa,
        observedPolarity: ratio >= 0.85 ? 'target_used' : 'gap_observed',
      });
    }
  }

  return signals;
}

export function normalizeDiagnosticWeaknessFocus(params: {
  readonly skill: 'reading' | 'listening';
  readonly weaknessFocus: string | null | undefined;
  readonly isStrongTier: boolean;
}): ExtractedWeaknessSignal | null {
  const focus = (params.weaknessFocus ?? '').trim().toLowerCase();
  if (!focus && !params.isStrongTier) return null;

  let key: string;
  if (params.skill === 'reading') {
    if (focus.includes('tfng') || focus.includes('contradict')) {
      key = 'reading:tfng_trap';
    } else if (focus.includes('heading') || focus.includes('main idea') || focus.includes('gist')) {
      key = 'reading:matching_headings';
    } else if (focus.includes('summary') || focus.includes('detail')) {
      key = 'reading:summary_completion';
    } else {
      key = 'reading:paraphrase_matching';
    }
  } else {
    if (focus.includes('distractor') || focus.includes('correction')) {
      key = 'listening:distractor_traps';
    } else if (focus.includes('attitude') || focus.includes('infer')) {
      key = 'listening:multiple_choice_attitude';
    } else {
      key = 'listening:detail_capture';
    }
  }

  const tpl = WEAKNESS_CATALOG[key]!;
  return {
    canonicalKey: tpl.canonicalKey,
    skillScope: tpl.skillScope,
    displayLabelEn: tpl.displayLabelEn,
    displayLabelFa: tpl.displayLabelFa,
    coachNoteEn: tpl.coachNoteEn,
    coachNoteFa: tpl.coachNoteFa,
    observedPolarity: params.isStrongTier && !focus ? 'target_used' : 'gap_observed',
  };
}
