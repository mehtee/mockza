import { createHash } from 'node:crypto';
import {
  type BundleIntegrityQuestionInput,
  type BundleIntegritySectionInput,
  stableJsonStringify,
  validateExamBundleStructure,
} from './content-safety.js';

export type { BundleIntegrityQuestionInput, BundleIntegritySectionInput };

export function computeContentSha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Computes canonical SHA-256 and UTF-8 byteLength over normalized sections + questions. */
export function computeBundleContentDigest(payload: {
  sections: unknown[];
  questions: unknown[];
}): { sha256: string; byteLength: number } {
  const canonical = stableJsonStringify({
    sections: payload.sections,
    questions: payload.questions,
  });
  return {
    sha256: computeContentSha256(canonical),
    byteLength: Buffer.byteLength(canonical, 'utf8'),
  };
}

/**
 * Shared ADR-008 integrity validator used at admin upsert and publish gates (`RR-14`).
 */
export function validateExamBundleIntegrity(params: {
  packId: string;
  skill: string;
  humanQaReviewed: boolean;
  declaredSha256?: string | null;
  rawTextForSafetyCheck?: string;
  sections: BundleIntegritySectionInput[];
  questions: BundleIntegrityQuestionInput[];
}): { valid: boolean; errors: string[]; computedDigest: { sha256: string; byteLength: number } } {
  const { errors, normalizedPayload } = validateExamBundleStructure(params);
  const computedDigest = computeBundleContentDigest(normalizedPayload);

  if (params.declaredSha256 != null && params.declaredSha256 !== computedDigest.sha256) {
    errors.push(
      `SHA-256 mismatch for ${params.packId}: declared=${params.declaredSha256} computed=${computedDigest.sha256}.`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    computedDigest,
  };
}
