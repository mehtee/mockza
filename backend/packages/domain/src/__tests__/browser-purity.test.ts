import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  computeBundleContentDigest,
  computeContentSha256,
  validateExamBundleIntegrity,
} from '../node.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

interface EsbuildBuildResult {
  errors: unknown[];
  outputFiles: Array<{ text: string }>;
}

interface EsbuildLike {
  build(options: {
    entryPoints: string[];
    bundle: boolean;
    platform: 'browser' | 'node' | 'neutral';
    format: 'esm' | 'cjs' | 'iife';
    write: boolean;
  }): Promise<EsbuildBuildResult>;
}

async function loadEsbuild(): Promise<EsbuildLike> {
  const vitestPkg = require.resolve('vitest/package.json');
  const fromVitest = createRequire(vitestPkg);
  const vitePkg = fromVitest.resolve('vite/package.json');
  const fromVite = createRequire(vitePkg);
  const esbuildPath = fromVite.resolve('esbuild');
  return (await import(esbuildPath)) as EsbuildLike;
}

describe('@mockza/domain browser purity & node isolation', () => {
  it('bundles src/index.ts for platform=browser with zero errors, node: imports, or Buffer references', async () => {
    const esbuild = await loadEsbuild();
    const res = await esbuild.build({
      entryPoints: [resolve(__dirname, '../index.ts')],
      bundle: true,
      platform: 'browser',
      format: 'esm',
      write: false,
    });

    expect(res.errors).toHaveLength(0);
    expect(res.outputFiles).toHaveLength(1);
    const bundled = res.outputFiles[0]?.text ?? '';
    expect(bundled.length).toBeGreaterThan(0);
    expect(bundled).not.toMatch(/\bnode:/);
    expect(bundled).not.toMatch(/\bBuffer\b/);
  });

  it('exposes Node-only SHA-256 and bundle integrity helpers via src/node.ts', () => {
    const sha = computeContentSha256('hello');
    expect(sha).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');

    const digest = computeBundleContentDigest({
      sections: [{ id: 's1', text: 'αβγ' }],
      questions: [{ id: 'q1' }],
    });
    expect(digest.sha256).toHaveLength(64);
    expect(digest.byteLength).toBeGreaterThan(0);

    const check = validateExamBundleIntegrity({
      packId: 'pack-1',
      skill: 'reading',
      humanQaReviewed: true,
      sections: [
        {
          sectionId: 's1',
          sectionIndex: 1,
          sectionType: 'passage',
          title: 'Passage 1',
          instructions: 'Read carefully.',
          contentText: 'Solar panels convert sunlight into electricity.',
          durationSeconds: 1200,
          wordCount: 6,
        },
      ],
      questions: [
        {
          questionId: 'q1',
          sectionId: 's1',
          questionNumber: 1,
          questionType: 'tfng',
          prompt: 'Solar panels produce electricity.',
          acceptedAnswers: ['TRUE'],
          evidence: { exactQuote: 'convert sunlight into electricity' },
        },
      ],
    });
    expect(check.valid).toBe(true);
    expect(check.errors).toEqual([]);
    expect(check.computedDigest.sha256).toHaveLength(64);
  });
});
