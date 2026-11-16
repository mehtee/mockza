import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EvaluationModelError,
  gradeSpeakingGraph,
  gradeWritingGraph,
  MODEL_REGISTRY,
  type OpenRouterClient,
} from '@mockza/ai';
import { EvaluationOutputSchema } from '@mockza/contracts';

interface GoldenSample {
  id: string;
  skill: 'writing' | 'speaking';
  examId: 'ielts_academic' | 'ielts_general';
  taskType: string;
  promptTitle: string;
  promptBody: string;
  inputText: string;
  base64AudioData?: string;
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

export interface RunEvalOptions {
  client?: Pick<OpenRouterClient, 'createChatCompletion'>;
  requireAudioForSpeaking?: boolean;
}

/** Minimal valid RIFF WAV header + 0.1s PCM buffer for synthetic audio contract checks when sample audio isn't bundled. */
function buildMinimalSilenceWavBase64(): string {
  const sampleRate = 16000;
  const dataSize = 3200; // 0.1s 16-bit mono
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf.toString('base64');
}

export async function runRubricEvals(options: RunEvalOptions = {}): Promise<EvalBenchmarkReport> {
  const apiKey = process.env['OPENROUTER_API_KEY'];
  if (!options.client && !apiKey) {
    throw new EvaluationModelError(
      'model_unavailable',
      'Refusing to run rubric benchmark without OPENROUTER_API_KEY (fake fallback benchmarks are prohibited).',
      false,
    );
  }

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const datasetPath = resolve(__dirname, '../datasets/golden-rubric-samples.json');
  const samples: GoldenSample[] = JSON.parse(readFileSync(datasetPath, 'utf-8'));

  process.stdout.write(
    `Starting Held-Out IELTS Calibration Benchmark (${samples.length} samples, models: writing=${MODEL_REGISTRY.writingPrimary}, speaking=${MODEL_REGISTRY.speakingAudioPrimary})\n`,
  );

  let withinHalfBandCount = 0;
  let schemaValidCount = 0;
  let evidenceNonEmptyCount = 0;
  let totalBandError = 0;
  const latencies: number[] = [];

  for (const sample of samples) {
    const start = Date.now();
    let result:
      | Awaited<ReturnType<typeof gradeWritingGraph.invoke>>
      | Awaited<ReturnType<typeof gradeSpeakingGraph.invoke>>;

    if (sample.skill === 'writing') {
      result = await gradeWritingGraph.invoke(
        {
          attemptId: '00000000-0000-0000-0000-000000000001',
          packId: 'golden-eval-pack',
          examId: sample.examId,
          taskType: sample.taskType as 'task1Academic' | 'task1General' | 'task2Essay',
          promptTitle: sample.promptTitle,
          promptBody: sample.promptBody,
          essayText: sample.inputText,
        },
        { client: options.client, allowDemoEvaluator: false },
      );
      if (result.modelId !== MODEL_REGISTRY.writingPrimary) {
        throw new Error(`Benchmark integrity violation: unexpected modelId ${result.modelId}`);
      }
    } else {
      const speakingAudio = sample.base64AudioData ?? buildMinimalSilenceWavBase64();
      result = await gradeSpeakingGraph.invoke(
        {
          attemptId: '00000000-0000-0000-0000-000000000002',
          packId: 'golden-eval-pack',
          examId: sample.examId,
          partSequence: 'full',
          turnAudios: [
            {
              partIndex: 1,
              promptText: sample.promptBody || sample.promptTitle,
              base64AudioData: speakingAudio,
              format: 'wav',
            },
          ],
          turns: [
            {
              partIndex: 1,
              promptText: sample.promptBody || sample.promptTitle,
              objectKey: `evals/audio/${sample.id}.wav`,
            },
          ],
        },
        { client: options.client, allowDemoEvaluator: false },
      );
      if (result.modelId !== MODEL_REGISTRY.speakingAudioPrimary) {
        throw new Error(`Benchmark integrity violation: unexpected modelId ${result.modelId}`);
      }
    }

    const latency = Date.now() - start;
    latencies.push(latency);

    const parsed = EvaluationOutputSchema.safeParse(result);
    if (parsed.success) {
      schemaValidCount += 1;
    }

    const hasEvidence = result.criteria.every(
      (c) => Boolean(c.evidenceExcerpt) && c.evidenceExcerpt.trim().length > 0,
    );
    if (hasEvidence) {
      evidenceNonEmptyCount += 1;
    }

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
  const passed =
    withinHalfBandPercent >= 80 &&
    schemaValidCount === samples.length &&
    evidenceNonEmptyCount === samples.length;

  process.stdout.write(`\n=== IELTS Calibration Benchmark Results ===\n`);
  process.stdout.write(`Total Samples: ${samples.length}\n`);
  process.stdout.write(
    `Within ±0.5 Band: ${withinHalfBandCount}/${samples.length} (${withinHalfBandPercent.toFixed(1)}%) [Target >= 80%]\n`,
  );
  process.stdout.write(`Schema Compliance: ${schemaValidCount}/${samples.length}\n`);
  process.stdout.write(`Evidence Excerpts Valid: ${evidenceNonEmptyCount}/${samples.length}\n`);
  process.stdout.write(`Average Band Error: ${averageBandError.toFixed(2)} bands\n`);
  process.stdout.write(`P95 Latency: ${p95LatencyMs} ms\n`);
  process.stdout.write(`Benchmark Status: ${passed ? 'PASSED ✓' : 'FAILED ✗'}\n\n`);

  if (!passed) {
    throw new Error(
      `Calibration benchmark failed: only ${withinHalfBandPercent.toFixed(1)}% within ±0.5 band.`,
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
  void runRubricEvals().catch((err) => {
    process.stderr.write(`${(err as Error).message}\n`);
    process.exit(1);
  });
}
