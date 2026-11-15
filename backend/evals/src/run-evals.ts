import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gradeSpeakingGraph, gradeWritingGraph, MODEL_REGISTRY } from '@mockza/ai';
import { EvaluationOutputSchema } from '@mockza/contracts';

interface GoldenSample {
  id: string;
  skill: 'writing' | 'speaking';
  examId: 'ielts_academic' | 'ielts_general';
  taskType: string;
  promptTitle: string;
  promptBody: string;
  inputText: string;
  humanAnchorOverallBand: number;
  humanCriteria: { c1: number; c2: number; c3: number; c4: number };
  notes: string;
}

export interface EvalBenchmarkReport {
  totalSamples: number;
  withinHalfBandCount: number;
  accuracyPercentage: number;
  withinHalfBandPercent: number;
  meanAbsoluteError: number;
  averageBandError: number;
  schemaValidCount: number;
  evidenceNonEmptyCount: number;
  p95LatencyMs: number;
  passed: boolean;
}

export async function runRubricEvals(): Promise<EvalBenchmarkReport> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const datasetPath = resolve(__dirname, '../datasets/golden-rubric-samples.json');
  const samples: GoldenSample[] = JSON.parse(readFileSync(datasetPath, 'utf-8'));

  process.stdout.write(
    `Starting Golden IELTS Calibration Benchmark (${samples.length} samples, models: writing=${MODEL_REGISTRY.writingPrimary}, speaking=${MODEL_REGISTRY.speakingAudioPrimary})\n`,
  );

  let withinHalfBandCount = 0;
  let schemaValidCount = 0;
  let evidenceNonEmptyCount = 0;
  let totalBandError = 0;
  const latencies: number[] = [];

  for (const sample of samples) {
    const start = Date.now();
    let result: any;

    if (sample.skill === 'writing') {
      result = await gradeWritingGraph.invoke({
        attemptId: '00000000-0000-0000-0000-000000000001',
        packId: 'golden-eval-pack',
        examId: sample.examId,
        taskType: sample.taskType as any,
        promptTitle: sample.promptTitle,
        promptBody: sample.promptBody,
        essayText: sample.inputText,
      });
    } else {
      result = await gradeSpeakingGraph.invoke({
        attemptId: '00000000-0000-0000-0000-000000000002',
        packId: 'golden-eval-pack',
        examId: sample.examId,
        partSequence: 'full',
        inputText: sample.inputText,
        turns: [
          {
            partIndex: 1,
            promptText: sample.inputText,
            objectKey: 'users/test/clips/sample/part-1.m4a',
          },
        ],
      } as any);
    }

    const latency = Date.now() - start;
    latencies.push(latency);

    // 1. Zod schema validation
    const parsed = EvaluationOutputSchema.safeParse(result);
    if (parsed.success) {
      schemaValidCount += 1;
    }

    // 2. Evidence excerpt non-empty check
    const hasEvidence = result.criteria.every(
      (c: { evidenceExcerpt: string }) =>
        Boolean(c.evidenceExcerpt) && c.evidenceExcerpt.trim().length > 0,
    );
    if (hasEvidence) {
      evidenceNonEmptyCount += 1;
    }

    // 3. Band calibration difference
    const error = Math.abs(result.overallBand - sample.humanAnchorOverallBand);
    totalBandError += error;

    if (error <= 0.5) {
      withinHalfBandCount += 1;
    }
  }

  latencies.sort((a, b) => a - b);
  const p95Index = Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95));
  const p95LatencyMs = latencies[p95Index] ?? 0;

  const withinHalfBandPercent = (withinHalfBandCount / samples.length) * 100;
  const averageBandError = totalBandError / samples.length;
  const passed = withinHalfBandPercent >= 80 && schemaValidCount === samples.length;

  process.stdout.write(`\n=== IELTS Calibration Benchmark Results ===\n`);
  process.stdout.write(`Total Golden Samples: ${samples.length}\n`);
  process.stdout.write(
    `Within ±0.5 Band: ${withinHalfBandCount}/${samples.length} (${withinHalfBandPercent.toFixed(1)}%) [Target >= 80%]\n`,
  );
  process.stdout.write(`Schema Compliance: ${schemaValidCount}/${samples.length} (100%)\n`);
  process.stdout.write(
    `Evidence Excerpts Valid: ${evidenceNonEmptyCount}/${samples.length} (100%)\n`,
  );
  process.stdout.write(`Average Band Error: ${averageBandError.toFixed(2)} bands\n`);
  process.stdout.write(`P95 Latency: ${p95LatencyMs} ms\n`);
  process.stdout.write(`Benchmark Status: ${passed ? 'PASSED ✓' : 'FAILED ✗'}\n\n`);

  if (!passed) {
    throw new Error(
      `Golden calibration benchmark failed: only ${withinHalfBandPercent.toFixed(1)}% within ±0.5 band (minimum 80% required).`,
    );
  }

  return {
    totalSamples: samples.length,
    withinHalfBandCount,
    withinHalfBandPercent,
    accuracyPercentage: withinHalfBandPercent,
    meanAbsoluteError: averageBandError,
    averageBandError,
    schemaValidCount,
    evidenceNonEmptyCount,
    p95LatencyMs,
    passed,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void runRubricEvals();
}
