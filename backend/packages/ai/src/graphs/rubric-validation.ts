import { SPEAKING_CRITERIA, WRITING_CRITERIA_TASK1, WRITING_CRITERIA_TASK2 } from '@mockza/domain';
import { EvaluationModelError } from '../errors.js';

export type RubricCriterionInput = {
  code?: unknown;
  label?: unknown;
  band?: unknown;
  evidenceExcerpt?: unknown;
  feedbackNote?: unknown;
};

export function validateAndExtractCriterionBands(params: {
  skill: 'writing' | 'speaking';
  taskType?: 'task1Academic' | 'task1General' | 'task2Essay';
  rawCriteria: unknown;
}): [number, number, number, number] {
  const criteria = Array.isArray(params.rawCriteria)
    ? (params.rawCriteria as RubricCriterionInput[])
    : null;
  if (!criteria || criteria.length !== 4) {
    throw new EvaluationModelError(
      'model_invalid_output',
      `${params.skill === 'writing' ? 'Writing' : 'Speaking'} model output must contain exactly 4 criterion scores.`,
      true,
    );
  }

  const expectedCodes: readonly string[] =
    params.skill === 'speaking'
      ? SPEAKING_CRITERIA
      : params.taskType === 'task2Essay'
        ? WRITING_CRITERIA_TASK2
        : WRITING_CRITERIA_TASK1;

  const seenCodes = new Set<string>();
  const bands: number[] = [];

  for (const criterion of criteria) {
    const code = typeof criterion?.code === 'string' ? criterion.code.trim() : '';
    if (!expectedCodes.includes(code) || seenCodes.has(code)) {
      throw new EvaluationModelError(
        'model_invalid_output',
        `${params.skill === 'writing' ? 'Writing' : 'Speaking'} model output contained invalid or duplicate criterion code "${code}" (expected ${expectedCodes.join(', ')}).`,
        true,
      );
    }
    seenCodes.add(code);

    const band = Number(criterion?.band);
    if (!Number.isFinite(band) || band < 0 || band > 9) {
      throw new EvaluationModelError(
        'model_invalid_output',
        `${params.skill === 'writing' ? 'Writing' : 'Speaking'} model output contained invalid criterion band values.`,
        true,
      );
    }

    const evidenceExcerpt =
      typeof criterion?.evidenceExcerpt === 'string' ? criterion.evidenceExcerpt.trim() : '';
    const feedbackNote =
      typeof criterion?.feedbackNote === 'string' ? criterion.feedbackNote.trim() : '';
    if (evidenceExcerpt.length === 0 || feedbackNote.length === 0) {
      throw new EvaluationModelError(
        'model_invalid_output',
        `${params.skill === 'writing' ? 'Writing' : 'Speaking'} model output omitted required evidenceExcerpt or feedbackNote for ${code}.`,
        true,
      );
    }

    bands.push(band);
  }

  if (seenCodes.size !== expectedCodes.length) {
    throw new EvaluationModelError(
      'model_invalid_output',
      `${params.skill === 'writing' ? 'Writing' : 'Speaking'} model output did not cover all required criteria (${expectedCodes.join(', ')}).`,
      true,
    );
  }

  return bands as [number, number, number, number];
}

export interface RawInlineEdit {
  editId?: unknown;
  startOffset?: unknown;
  endOffset?: unknown;
  originalText?: unknown;
  suggestedText?: unknown;
  criterionCode?: unknown;
  rationale?: unknown;
}

/**
 * Grounds inline edit character spans strictly against `essayText` (`RR-18`).
 * Keeps exact span matches, uniquely realigns unambiguous verbatim quotes if offsets drifted,
 * and drops hallucinated/out-of-bounds spans so UI highlighters never slice invalid ranges.
 */
export function sanitizeWritingInlineEdits(
  rawEdits: unknown,
  essayText: string,
  allowedCriterionCodes: readonly string[],
): unknown[] | undefined {
  if (!Array.isArray(rawEdits)) {
    return undefined;
  }

  const grounded: unknown[] = [];
  for (const item of rawEdits as RawInlineEdit[]) {
    if (!item || typeof item !== 'object') continue;
    const originalText = typeof item.originalText === 'string' ? item.originalText : '';
    const suggestedText = typeof item.suggestedText === 'string' ? item.suggestedText : '';
    const criterionCode = typeof item.criterionCode === 'string' ? item.criterionCode.trim() : '';
    if (originalText.length === 0 || !allowedCriterionCodes.includes(criterionCode)) {
      continue;
    }

    let start = typeof item.startOffset === 'number' ? Math.trunc(item.startOffset) : -1;
    let end = typeof item.endOffset === 'number' ? Math.trunc(item.endOffset) : -1;

    const exactMatch =
      start >= 0 &&
      end > start &&
      end <= essayText.length &&
      essayText.slice(start, end) === originalText;

    if (!exactMatch) {
      const firstIdx = essayText.indexOf(originalText);
      const lastIdx = essayText.lastIndexOf(originalText);
      if (firstIdx >= 0 && firstIdx === lastIdx) {
        start = firstIdx;
        end = firstIdx + originalText.length;
      } else {
        continue;
      }
    }

    grounded.push({
      ...item,
      startOffset: start,
      endOffset: end,
      originalText,
      suggestedText,
      criterionCode,
    });
  }
  return grounded;
}
