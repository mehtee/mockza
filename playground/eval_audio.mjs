import { readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function loadOpenRouterKey() {
  if (process.env.OPENROUTER_API_KEY) {
    return process.env.OPENROUTER_API_KEY;
  }
  const envText = readFileSync(resolve(repoRoot, '.env'), 'utf8');
  for (const line of envText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key === 'OPENROUTER_API_KEY' && val) {
      return val;
    }
  }
  throw new Error('OPENROUTER_API_KEY not found in env or ../.env');
}

const audioArg = process.argv[2] ?? 'sample.m4a';
const model = process.argv[3] ?? process.env.MODEL ?? 'meta/muse-ember';
const audioPath = resolve(__dirname, audioArg);
const audioFormat = extname(audioPath).replace(/^\./, '').toLowerCase() || 'm4a';
const audioBase64 = readFileSync(audioPath).toString('base64');
const apiKey = loadOpenRouterKey();

const prompt = [
  'You are an expert IELTS Speaking examiner and clinical phonetics coach. Listen carefully to the attached audio clip and evaluate ONLY what you directly hear (do not invent generic ESL mistakes that are not in the audio).',
  '',
  'Provide a complete, detailed breakdown with these exact sections:',
  '1. **Verbatim Transcript (with Pauses & Disfluencies)**:',
  '   - Transcribe every word, filler ("um", "em", "uh"), false start, self-correction, and mark every pause inline with approximate duration (e.g. `[pause ~0.6s]`).',
  '2. **Word-by-Word Pronunciation Comparison (What Was Said vs. Standard Correct)**:',
  '   - Go through EVERY word in the utterance in order.',
  '   - For each word, show: `Word` | `What you actually said (sound/stress/IPA approximation)` | `Correct standard form (IPA + primary stress)` | `Verdict (Accurate / Minor issue / Mispronounced)` + exact acoustic note.',
  '3. **Whole-Sentence & Prosodic Evaluation**:',
  '   - Analyze the sentence as a whole: intonation contour (rising vs. falling for a question), rhythm (stress-timed vs. syllable-timed), word linking/elision, pitch variation/vocal frequency feel, and overall intelligibility.',
  '4. **Fluency, Pauses, Fillers & Error Frequency**:',
  '   - Estimated speaking rate (words per minute), pause count & placement (natural phrase boundaries vs. mid-phrase breaks), filler/hesitation count & frequency, repetition/self-correction count, and overall error density.',
  '5. **Grammar, Word Choice & Pragmatic Naturalness**:',
  '   - Check strict grammatical correctness, adverb/word placement, register, and whether a native speaker would phrase it this way in real conversation.',
  '6. **Actionable Corrections & Target Model**:',
  '   - Provide the most natural rewritten versions (casual vs. polite) and 2–3 targeted pronunciation/rhythm drills based strictly on this clip.',
].join('\n');

const startedAt = Date.now();
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model,
    temperature: 0.2,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'input_audio',
            input_audio: {
              data: audioBase64,
              format: audioFormat,
            },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  }),
});

const elapsedMs = Date.now() - startedAt;
const rawText = await response.text();
if (!response.ok) {
  console.error(`HTTP ${response.status} (${elapsedMs}ms):\n${rawText}`);
  process.exit(1);
}

const data = JSON.parse(rawText);
const choice = data.choices?.[0]?.message?.content;
console.log(`=== ${model} (${audioFormat}, ${elapsedMs}ms) ===`);
console.log(typeof choice === 'string' ? choice : JSON.stringify(choice, null, 2));
console.log('\n=== Usage ===');
console.log(JSON.stringify(data.usage ?? {}, null, 2));
