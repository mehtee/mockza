import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ingestDroppedContentGraph,
  MODEL_REGISTRY,
  OpenRouterAlphaClient,
  planDailyMissionGraph,
  shiftRegisterGraph,
  updateLinguisticGraphSignals,
  type OpenRouterClient,
} from '@mockza/ai';
import { DailyMissionPayloadSchema, RegisterShifterResultSchema } from '@mockza/contracts';

interface ClosedLoopDataset {
  registerShifter: Array<{
    id: string;
    edition: 'glb' | 'irn';
    examTrack: string;
    topicHint: string;
    sourceText: string;
  }>;
  dropAnything: Array<{
    id: string;
    edition: 'glb' | 'irn';
    inputKind: 'text_url' | 'text' | 'image' | 'audio';
    examTrack: string;
    sourceDomainOrLabel: string;
    titleHint: string;
    rawText: string;
    expectedPhrases: string[];
  }>;
  linguisticGraphAndMission: Array<{
    id: string;
    edition: 'glb' | 'irn';
    examTrack: string;
    focusTopic: string;
    textSample: string;
    bottleneckKey: string;
    dueWord: string;
  }>;
}

export interface ClosedLoopEvalReport {
  totalCases: number;
  registerShifterPassed: number;
  dropAnythingPassed: number;
  graphAndMissionPassed: number;
  bilingualSeparationValid: number;
  repeatWordLimitValid: number;
  passed: boolean;
}

function loadDataset(): ClosedLoopDataset {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const path = resolve(__dirname, '../datasets/closed-loop-golden-samples.json');
  return JSON.parse(readFileSync(path, 'utf-8')) as ClosedLoopDataset;
}

function hydrateEnvFromDotenvIfUnset(): void {
  if (process.env['OPENROUTER_API_KEY']) return;
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(__dirname, '../../../../.env'),
    resolve(__dirname, '../../../.env'),
  ];
  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;
    const lines = readFileSync(envPath, 'utf-8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
    if (process.env['OPENROUTER_API_KEY']) break;
  }
}

export async function runClosedLoopEvals(options: {
  client?: Pick<OpenRouterClient, 'createChatCompletion'>;
  alphaClient?: OpenRouterAlphaClient;
} = {}): Promise<ClosedLoopEvalReport> {
  const dataset = loadDataset();
  let registerShifterPassed = 0;
  let dropAnythingPassed = 0;
  let graphAndMissionPassed = 0;
  let bilingualSeparationValid = 0;
  let repeatWordLimitValid = 0;

  for (let i = 0; i < dataset.registerShifter.length; i += 1) {
    const rs = dataset.registerShifter[i]!;
    const out = await shiftRegisterGraph(
      {
        runId: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
        edition: rs.edition,
        examTrack: rs.examTrack,
        topicHint: rs.topicHint,
        sourceTextFallback: rs.sourceText,
      },
      { client: options.client },
    );
    const parsed = RegisterShifterResultSchema.safeParse(out);
    if (parsed.success && out.shiftHighlights.length > 0) {
      registerShifterPassed += 1;
    }
    const repeatWords = out.repeatAloudTarget.targetSentence.trim().split(/\s+/).filter(Boolean);
    if (repeatWords.length > 0 && repeatWords.length <= 35) {
      repeatWordLimitValid += 1;
    }
    const hasFaWhenIrn =
      rs.edition === 'irn'
        ? out.shiftHighlights.some((h) => Boolean(h.whyFa && h.whyFa.trim().length > 0))
        : out.shiftHighlights.every((h) => h.whyFa === null || h.whyFa === undefined);
    if (hasFaWhenIrn) bilingualSeparationValid += 1;
  }

  for (const dr of dataset.dropAnything) {
    const dropOut = await ingestDroppedContentGraph(
      {
        dropId: `eval-${dr.id}`,
        edition: dr.edition,
        inputKind: dr.inputKind,
        examTrack: dr.examTrack,
        sourceDomainOrLabel: dr.sourceDomainOrLabel,
        titleHint: dr.titleHint,
        rawText: dr.rawText,
        audioBase64: dr.inputKind === 'audio' ? Buffer.from('eval-audio').toString('base64') : undefined,
        audioFormat: dr.inputKind === 'audio' ? 'm4a' : undefined,
        imageDataUris:
          dr.inputKind === 'image' ? ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ'] : undefined,
      },
      { client: options.client, alphaClient: options.alphaClient },
    );
    const phrasesOk =
      dropOut.extractedPhrases.length >= 3 &&
      dropOut.extractedPhrases.length <= 5 &&
      dropOut.drillPayload.comprehensionOptions.length >= 2;
    if (phrasesOk) dropAnythingPassed += 1;
    const glossCheck =
      dr.edition === 'irn'
        ? dropOut.extractedPhrases.some((p) => Boolean(p.glossFa && p.glossFa.trim().length > 0))
        : dropOut.extractedPhrases.every((p) => p.glossFa === null || p.glossFa === undefined);
    if (glossCheck) bilingualSeparationValid += 1;
  }

  for (const gm of dataset.linguisticGraphAndMission) {
    const sig = await updateLinguisticGraphSignals(
      {
        edition: gm.edition,
        sourceKind: 'writing',
        textSample: gm.textSample,
        topicHint: gm.focusTopic,
      },
      { alphaClient: options.alphaClient },
    );
    const mission = await planDailyMissionGraph(
      {
        edition: gm.edition,
        examTrack: gm.examTrack,
        focusTopic: gm.focusTopic,
        bottlenecks: [{ canonicalKey: gm.bottleneckKey, displayLabelEn: gm.bottleneckKey }],
        dueCards: [{ cardId: `card-${gm.id}`, word: gm.dueWord, meaningEn: `Use "${gm.dueWord}" naturally` }],
      },
      { client: options.client },
    );
    const missionValid = DailyMissionPayloadSchema.safeParse(mission.payload).success;
    if (sig.signals.length > 0 && missionValid && mission.payload.forcedTargets.length === 2) {
      graphAndMissionPassed += 1;
    }
    const faOk =
      gm.edition === 'irn'
        ? Boolean(mission.payload.promptTextFa && mission.payload.promptTextFa.trim().length > 0)
        : mission.payload.promptTextFa === null || mission.payload.promptTextFa === undefined;
    if (faOk) bilingualSeparationValid += 1;
  }

  const totalCases =
    dataset.registerShifter.length + dataset.dropAnything.length + dataset.linguisticGraphAndMission.length;
  const passed =
    registerShifterPassed === dataset.registerShifter.length &&
    dropAnythingPassed === dataset.dropAnything.length &&
    graphAndMissionPassed === dataset.linguisticGraphAndMission.length &&
    bilingualSeparationValid === totalCases &&
    repeatWordLimitValid === dataset.registerShifter.length;

  return {
    totalCases,
    registerShifterPassed,
    dropAnythingPassed,
    graphAndMissionPassed,
    bilingualSeparationValid,
    repeatWordLimitValid,
    passed,
  };
}

/**
 * Live smoke test across all 4 closed-loop OpenRouter pipelines using `OPENROUTER_API_KEY`.
 */
export async function runLiveOpenRouterSmoke(): Promise<{
  modelsExercised: string[];
  alphaLatencyMs: number;
  registerShiftGearsOk: boolean;
  missionTargetsCount: number;
  dropPhraseCount: number;
  graphSignalsCount: number;
}> {
  hydrateEnvFromDotenvIfUnset();
  const apiKey = process.env['OPENROUTER_API_KEY'];
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is required for runLiveOpenRouterSmoke.');
  }

  const alphaClient = new OpenRouterAlphaClient({ apiKey });
  const t0 = Date.now();
  const signals = await updateLinguisticGraphSignals(
    {
      edition: 'irn',
      sourceKind: 'speaking',
      textSample:
        'Yesterday our football team played a very good game and AI analytics helped the coach a lot.',
      topicHint: 'Football & AI',
    },
    { alphaClient },
  );
  const alphaLatencyMs = Date.now() - t0;

  const shift = await shiftRegisterGraph({
    runId: randomUUID(),
    edition: 'irn',
    examTrack: 'ielts_academic',
    topicHint: 'AI tools',
    sourceTextFallback: 'Today I tried a coding AI tool and it was really good for my work.',
  });

  const mission = await planDailyMissionGraph({
    edition: 'irn',
    examTrack: 'ielts_academic',
    focusTopic: 'Football & Artificial Intelligence',
    bottlenecks: [
      {
        canonicalKey: 'grammar:conditional_avoidance',
        displayLabelEn: 'Avoids third/inverted conditionals',
      },
    ],
    dueCards: [
      {
        cardId: 'live-card-1',
        word: 'albeit',
        meaningEn: 'although; even though',
        meaningFa: 'هرچند',
      },
    ],
  });

  const drop = await ingestDroppedContentGraph(
    {
      dropId: 'live-smoke-drop-1',
      edition: 'irn',
      inputKind: 'text',
      examTrack: 'ielts_academic',
      sourceDomainOrLabel: 'arxiv.org',
      titleHint: 'Quantization Trade-offs',
      rawText:
        'Four-bit weight quantization achieves a practical trade-off between memory bandwidth and reasoning quality, albeit with slightly higher variance on rare edge cases.',
    },
    { alphaClient },
  );

  return {
    modelsExercised: [
      signals.modelUsed,
      MODEL_REGISTRY.speakingAudioPrimary,
      MODEL_REGISTRY.missionPlanner,
      MODEL_REGISTRY.system1Extractor,
    ],
    alphaLatencyMs,
    registerShiftGearsOk:
      shift.gears.casual.length > 0 && shift.gears.workplace.length > 0 && shift.gears.academic.length > 0,
    missionTargetsCount: mission.payload.forcedTargets.length,
    dropPhraseCount: drop.extractedPhrases.length,
    graphSignalsCount: signals.signals.length,
  };
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes('--live')) {
  void runLiveOpenRouterSmoke()
    .then((summary) => {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    })
    .catch((err) => {
      process.stderr.write(`${(err as Error).message}\n`);
      process.exit(1);
    });
}
