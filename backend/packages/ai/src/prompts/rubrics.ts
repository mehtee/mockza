import { getExamRubricSpec, normalizeSupportedExamId, type SupportedExamId } from '@mockza/domain';

export const PROMPT_MANIFEST = {
  writingRubricVersion: 'writing-rubric@2026-11',
  speakingRubricVersion: 'speaking-rubric@2026-11',
  explainQuestionVersion: 'explain-question@2026-11',
  irnOverlayVersion: 'irn-fa-overlay@2026-11',
} as const;

export const WRITING_RUBRIC_PROMPT = `
You are an IELTS Academic & General Training Writing examiner.
Score strictly using official 0.5-band descriptors:
- Task Achievement / Task Response (TA/TR)
- Coherence and Cohesion (CC)
- Lexical Resource (LR)
- Grammatical Range and Accuracy (GRA)
Every claim MUST cite an exact verbatim excerpt from the learner response.
Return structured JSON matching the EvaluationOutput contract.
`.trim();

export const SPEAKING_RUBRIC_PROMPT = `
You are an IELTS Speaking examiner evaluating direct learner audio.
First verify speech intelligibility and produce an exact transcript, then score:
- Fluency and Coherence (FC)
- Lexical Resource (LR)
- Grammatical Range and Accuracy (GRA)
- Pronunciation (PR)
Cite verbatim spoken phrases for every band justification.
`.trim();

export function buildWritingRubricPrompt(examIdRaw: string, taskType?: string): string {
  const examId: SupportedExamId = normalizeSupportedExamId(examIdRaw);
  if (examId === 'ielts_academic' || examId === 'ielts_general') {
    return WRITING_RUBRIC_PROMPT;
  }
  const spec = getExamRubricSpec(examId, 'writing', taskType);
  const criteriaBullets = spec.criteria
    .map((c) => `- ${c.label} (${c.code}): ${c.description}`)
    .join('\n');
  return [
    `You are an expert examiner for ${spec.promptLabel}.`,
    `Score strictly on the official ${spec.scale.min}–${spec.scale.max} scale in ${spec.scale.step}-point increments (store each criterion numeric score in the JSON "band" field):`,
    criteriaBullets,
    spec.scoringRules,
    'Every claim MUST cite an exact verbatim excerpt from the learner response.',
    'Return structured JSON matching the EvaluationOutput contract.',
  ].join('\n');
}

export function buildSpeakingRubricAppendix(examIdRaw: string): string {
  const examId: SupportedExamId = normalizeSupportedExamId(examIdRaw);
  if (examId === 'ielts_academic' || examId === 'ielts_general') {
    return '';
  }
  const spec = getExamRubricSpec(examId, 'speaking');
  const criteriaBullets = spec.criteria
    .map((c) => `- ${c.code} (${c.label}): ${c.description}`)
    .join('\n');
  return [
    '',
    `# EXAM OVERRIDE: ${spec.promptLabel}`,
    `Override IELTS band scales cleanly with the official ${spec.scale.label} scale (${spec.scale.min} to ${spec.scale.max}, step ${spec.scale.step}).`,
    `In JSON criteria items, output these EXACT 4 codes and numeric scores in the "band" field within [${spec.scale.min}, ${spec.scale.max}]:`,
    criteriaBullets,
    `Rules: ${spec.scoringRules}`,
  ].join('\n');
}

export const IRN_PERSIAN_COACHING_APPENDIX = `
# EDITION LOCALE OVERLAY (IRN / SANJIA — PERSIAN COACHING)
1. Numeric scores, criterion bands, "evidenceExcerpt", "originalText", "suggestedText", "modelRewrite.rewrittenText", and upgraded vocabulary "term" MUST strictly use the exact English rubric scales and verbatim English learner/academic text so calibration matches the Global edition identically.
2. Write ALL coaching explanation prose ("feedbackNote", "rationale", "preservedIdeasNote", "bandRationale", "actionableNextStep", "explanation", "whyWrongOptions[].reason") in clear, encouraging Persian (fa-IR) while keeping English technical rubric terms where helpful.
3. For each entry in "vocabUpgrades", ALSO include a concise Persian academic translation/meaning in "glossFa".
`.trim();

export function buildEditionOverlayAppendix(edition?: 'glb' | 'irn'): string {
  return edition === 'irn' ? `\n${IRN_PERSIAN_COACHING_APPENDIX}` : '';
}
