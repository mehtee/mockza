import { describe, expect, it } from 'vitest';
import {
  checkCopyrightSafety,
  computeSha256,
  validateAllPacks,
  validatePackManifest,
} from '../validate-pack.js';

describe('@mockza/content-pipeline ADR-008 manifest validation', () => {
  it('accepts human-reviewed original IELTS pack manifests with SHA-256', () => {
    const manifest = validatePackManifest({
      packId: 'ielts-acad-pack-001',
      skill: 'reading',
      version: '1.0.0',
      sha256: 'a'.repeat(64),
      provenance: 'authored_original',
      reviewedByHuman: true,
    });
    expect(manifest.packId).toBe('ielts-acad-pack-001');
  });

  it('rejects manifests without human review or with invalid SHA-256', () => {
    expect(() =>
      validatePackManifest({
        packId: 'ielts-test',
        skill: 'reading',
        version: '1.0.0',
        sha256: 'invalid',
        provenance: 'authored_original',
        reviewedByHuman: false,
      }),
    ).toThrow();
  });

  it('detects trademark and copyright violations in text', () => {
    const clean = checkCopyrightSafety('This is an original essay about environmental science.');
    expect(clean.safe).toBe(true);

    const cambridge = checkCopyrightSafety('Sourced directly from Cambridge IELTS 16 tests.');
    expect(cambridge.safe).toBe(false);

    const britishCouncil = checkCopyrightSafety('Distributed by British Council partners.');
    expect(britishCouncil.safe).toBe(false);
  });

  it('computes valid 64-character SHA-256 hex digests', () => {
    const hash = computeSha256('hello mockza');
    expect(hash).toHaveLength(64);
    expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true);
  });

  it('validates entire Postgres starter exam seed inventory', async () => {
    const summary = await validateAllPacks();
    expect(summary.totalPacksChecked).toBeGreaterThanOrEqual(24);
    expect(summary.allEvidenceVerified).toBe(true);
    expect(summary.zeroTrademarkViolations).toBe(true);
    expect(summary.sha256IntegrityOk).toBe(true);
  });
});
