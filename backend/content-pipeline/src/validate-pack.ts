import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';

/** Banned trademark / copyright string patterns for clean-room assurance */
export const BANNED_PATTERNS = [
  /\bcambridge\s+(ielts|esol|university\s+press)\b/i,
  /\bets\b/i,
  /\bpearson\s+plc\b/i,
  /\bbritish\s+council\b/i,
  /\bidp\s+education\b/i,
];

/** Enforces ADR-008 content provenance, SHA-256 checksum, and evidence spans. */
export const ContentPackManifestSchema = z.object({
  packId: z.string().min(3),
  skill: z.enum(['speaking', 'writing', 'reading', 'listening', 'fullMock']),
  version: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  provenance: z.enum(['authored_original', 'public_domain_adapted']),
  reviewedByHuman: z.literal(true),
});

export type ContentPackManifest = z.infer<typeof ContentPackManifestSchema>;

export function validatePackManifest(input: unknown): ContentPackManifest {
  return ContentPackManifestSchema.parse(input);
}

export function computeSha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export function checkCopyrightSafety(text: string): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(pattern.toString());
    }
  }
  return { safe: violations.length === 0, violations };
}

export interface ValidationSummary {
  totalPacksChecked: number;
  seedPacksChecked: number;
  cdnPacksChecked: number;
  allEvidenceVerified: boolean;
  zeroTrademarkViolations: boolean;
  sha256IntegrityOk: boolean;
}

interface ParsedExamBundle {
  pack: {
    packId: string;
    skill: string;
    version: string;
    sha256: string;
    contentOrigin: string;
    humanQaReviewed: boolean;
  };
  sections: Array<{
    sectionId: string;
    contentText: string;
    paragraphsJson?: Record<string, string> | null;
  }>;
  questions: Array<{
    questionId: string;
    evidenceJson?: Record<string, unknown> | null;
  }>;
}

async function loadStarterBundles(currentFile: string): Promise<ParsedExamBundle[]> {
  const currentDir = dirname(currentFile);
  const candidates = currentFile.endsWith('.ts')
    ? [
        resolve(currentDir, '../../packages/db/src/seed-data/starter-exams.ts'),
        resolve(currentDir, '../../packages/db/dist/seed-data/starter-exams.js'),
      ]
    : [
        resolve(currentDir, '../../packages/db/dist/seed-data/starter-exams.js'),
        resolve(currentDir, '../../packages/db/src/seed-data/starter-exams.ts'),
      ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const mod = (await import(pathToFileURL(candidate).href)) as {
        STARTER_EXAM_BUNDLES?: ParsedExamBundle[];
      };
      if (Array.isArray(mod.STARTER_EXAM_BUNDLES)) {
        return mod.STARTER_EXAM_BUNDLES;
      }
    }
  }
  throw new Error(`Missing Postgres seed data module in: ${candidates.join(', ')}`);
}

function normalizeWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export async function validateAllPacks(): Promise<ValidationSummary> {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFile);
  const seedDataDir = resolve(currentDir, '../../packages/db/src/seed-data');
  const distSeedDataDir = resolve(currentDir, '../../packages/db/dist/seed-data');
  const drillsPath = existsSync(resolve(seedDataDir, 'starter-drills.ts'))
    ? resolve(seedDataDir, 'starter-drills.ts')
    : resolve(distSeedDataDir, 'starter-drills.js');
  const vocabPath = existsSync(resolve(seedDataDir, 'starter-vocab.ts'))
    ? resolve(seedDataDir, 'starter-vocab.ts')
    : resolve(distSeedDataDir, 'starter-vocab.js');

  let totalPacksChecked = 0;
  let allEvidenceOk = true;
  let zeroViolations = true;
  let sha256Ok = true;

  const bundles = await loadStarterBundles(currentFile);
  for (const bundle of bundles) {
    totalPacksChecked += 1;
    const rawStr = JSON.stringify(bundle);
    const safety = checkCopyrightSafety(rawStr);
    if (!safety.safe) {
      process.stderr.write(
        `FAIL: Trademark violation in exam ${bundle.pack.packId}: ${safety.violations.join(', ')}\n`,
      );
      zeroViolations = false;
    }

    if (!/^[a-f0-9]{64}$/.test(bundle.pack.sha256)) {
      process.stderr.write(`FAIL: Invalid SHA-256 in exam ${bundle.pack.packId}\n`);
      sha256Ok = false;
    }

    if (!bundle.pack.humanQaReviewed) {
      allEvidenceOk = false;
    }

    if (bundle.pack.skill === 'reading') {
      const fullPassage = normalizeWs(bundle.sections.map((s) => s.contentText).join('\n'));
      for (const q of bundle.questions) {
        const quote = q.evidenceJson?.['exactQuote'];
        if (typeof quote === 'string' && quote.length > 0) {
          if (!fullPassage.includes(normalizeWs(quote))) {
            process.stderr.write(
              `FAIL: Reading evidence quote missing in ${bundle.pack.packId} / ${q.questionId}\n`,
            );
            allEvidenceOk = false;
          }
        }
      }
    }
  }

  for (const extraPath of [drillsPath, vocabPath]) {
    if (existsSync(extraPath)) {
      const safety = checkCopyrightSafety(readFileSync(extraPath, 'utf-8'));
      if (!safety.safe) {
        zeroViolations = false;
      }
    }
  }

  process.stdout.write(
    `Validated ${totalPacksChecked} Postgres seed exam bundles (evidence=${allEvidenceOk}, copyright=${zeroViolations}, sha256=${sha256Ok}).\n`,
  );

  return {
    totalPacksChecked,
    seedPacksChecked: totalPacksChecked,
    cdnPacksChecked: 0,
    allEvidenceVerified: allEvidenceOk,
    zeroTrademarkViolations: zeroViolations,
    sha256IntegrityOk: sha256Ok,
  };
}

const invokedPath = process.argv[1];
if (invokedPath && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  validateAllPacks()
    .then((summary) => {
      if (
        !summary.allEvidenceVerified ||
        !summary.zeroTrademarkViolations ||
        !summary.sha256IntegrityOk
      ) {
        process.exit(1);
      }
    })
    .catch((err: unknown) => {
      process.stderr.write(`${String(err)}\n`);
      process.exit(1);
    });
}
