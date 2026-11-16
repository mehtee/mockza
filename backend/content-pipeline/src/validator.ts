import { CompletePackSchema } from './schemas.js';
import { checkCopyrightSafety, computeSha256 } from './validate-pack.js';

export interface ValidationReport {
  valid: boolean;
  packId: string;
  skill: string;
  version: string;
  sha256: string;
  byteLength: number;
  warnings: string[];
}

/** Validates an IELTS content pack against clean-room requirements and evidence precision (ADR-008 / TD-31). */
export function validateContentPack(rawJson: unknown): ValidationReport {
  // 1. Zod schema validation
  const pack = CompletePackSchema.parse(rawJson);

  const jsonStr = JSON.stringify(rawJson);

  // 2. Shared clean-room copyright/trademark blocklist check
  const safety = checkCopyrightSafety(jsonStr);
  if (!safety.safe) {
    throw new Error(
      `Copyright blocklist check failed: pack contains forbidden reference matching "${safety.violations.join(', ')}". Packs must be 100% original authored or public domain adapted.`,
    );
  }

  const warnings: string[] = [];

  // 3. Precision verification of Reading evidence spans
  if (pack.readingContent) {
    let questionCounter = 0;
    for (const passage of pack.readingContent.passages) {
      questionCounter += passage.questions.length;
      for (const question of passage.questions) {
        if (question.evidenceSpan) {
          const { paragraphIndex, startOffset, endOffset, exactQuote } = question.evidenceSpan;
          const paragraph = passage.paragraphs[paragraphIndex];
          if (!paragraph) {
            throw new Error(
              `Evidence span error in question "${question.questionId}": paragraph index ${paragraphIndex} does not exist in passage ${passage.passageIndex}.`,
            );
          }
          const actualSlice = paragraph.slice(startOffset, endOffset);
          if (actualSlice !== exactQuote) {
            throw new Error(
              `Evidence span mismatch in question "${question.questionId}": span [${startOffset}..${endOffset}] expected "${exactQuote}", but paragraph has "${actualSlice}".`,
            );
          }
        } else if (
          (question.questionType === 'TFNG' || question.questionType === 'YNNG') &&
          question.correctAnswer.toUpperCase() === 'NOT GIVEN'
        ) {
          if (
            !question.notGivenOmissionReason ||
            question.notGivenOmissionReason.trim().length === 0
          ) {
            warnings.push(
              `Question "${question.questionId}" has NOT GIVEN answer without explicit notGivenOmissionReason rationale.`,
            );
          }
        }
      }
    }

    if (questionCounter !== 40) {
      throw new Error(`Reading pack must have exactly 40 questions, found ${questionCounter}.`);
    }
  }

  // 4. Compute SHA-256 and byteLength
  const buffer = Buffer.from(jsonStr, 'utf-8');
  const sha256 = computeSha256(buffer);
  const byteLength = buffer.byteLength;

  return {
    valid: true,
    packId: pack.packId,
    skill: pack.skill,
    version: pack.version,
    sha256,
    byteLength,
    warnings,
  };
}
