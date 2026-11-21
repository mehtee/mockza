import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { EvaluationModelError } from '../errors.js';

export type SupportedModelAudioFormat = 'm4a' | 'mp3' | 'wav';

export interface PreparedAudioResult {
  base64Data: string;
  format: SupportedModelAudioFormat;
}

const DEFAULT_FFMPEG_TIMEOUT_MS = 15_000;
const MAX_DURATION_SECONDS = 240;

/** Streams S3 audio object into memory buffer with strict byte ceiling. */
export async function bufferAudioStream(
  stream: NodeJS.ReadableStream,
  maxBytes = 15 * 1024 * 1024,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) {
      throw new EvaluationModelError(
        'audio_missing',
        `Audio stream exceeds ${maxBytes} bytes limit.`,
        false,
      );
    }
    chunks.push(buf);
  }

  return Buffer.concat(chunks);
}

function inferInputExtension(sourceKey?: string): string {
  if (!sourceKey) return '.m4a';
  const ext = extname(sourceKey).toLowerCase();
  if (
    ext === '.webm' ||
    ext === '.ogg' ||
    ext === '.wav' ||
    ext === '.m4a' ||
    ext === '.mp4' ||
    ext === '.mp3'
  ) {
    return ext;
  }
  return '.m4a';
}

/** Validates container magic bytes to catch truncated, HTML, or corrupt uploads early. */
export function detectAudioContainer(
  buffer: Buffer,
): 'm4a' | 'wav' | 'webm' | 'ogg' | 'mp3' | null {
  if (buffer.length < 12) return null;

  // WAV: 'RIFF....WAVE'
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WAVE'
  ) {
    return 'wav';
  }
  // MP4 / M4A: ISO BMFF 'ftyp' at offset 4
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    return 'm4a';
  }
  // WebM / EBML: 1A 45 DF A3
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return 'webm';
  }
  // Ogg: 'OggS'
  if (buffer.subarray(0, 4).toString('ascii') === 'OggS') {
    return 'ogg';
  }
  // MP3: 'ID3' or frame sync FF FB / FF F3 / FF F2
  if (
    buffer.subarray(0, 3).toString('ascii') === 'ID3' ||
    (buffer[0] === 0xff && ((buffer[1] ?? 0) & 0xe0) === 0xe0)
  ) {
    return 'mp3';
  }
  return null;
}

interface SubprocessOutcome {
  ok: boolean;
  enoent: boolean;
  timedOut: boolean;
  stdout: string;
}

async function runBoundedProcess(
  command: string,
  args: string[],
  timeoutMs = DEFAULT_FFMPEG_TIMEOUT_MS,
): Promise<SubprocessOutcome> {
  return await new Promise<SubprocessOutcome>((resolve) => {
    const proc = spawn(command, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    const stdoutChunks: Buffer[] = [];
    let settled = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
    }, timeoutMs);

    proc.stdout?.on('data', (chunk: Buffer) => {
      if (stdoutChunks.reduce((acc, b) => acc + b.length, 0) < 4096) {
        stdoutChunks.push(chunk);
      }
    });

    proc.on('error', (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: false,
        enoent: err.code === 'ENOENT',
        timedOut: false,
        stdout: '',
      });
    });

    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: code === 0 && !timedOut,
        enoent: false,
        timedOut,
        stdout: Buffer.concat(stdoutChunks).toString('utf-8').trim(),
      });
    });
  });
}

export interface PrepareAudioOptions {
  timeoutMs?: number;
  maxDurationSeconds?: number;
}

/**
 * Validates container, bounds duration/transcode time, and normalizes audio to 16 kHz mono AAC .m4a.
 * Fails closed on corrupt/hanging/unsupported inputs instead of mislabeling unconverted bytes as .m4a.
 */
export async function prepareAudioForModel(
  buffer: Buffer,
  sourceKey?: string,
  timeoutOrOptions: number | PrepareAudioOptions = DEFAULT_FFMPEG_TIMEOUT_MS,
): Promise<PreparedAudioResult> {
  const timeoutMs =
    typeof timeoutOrOptions === 'number'
      ? timeoutOrOptions
      : (timeoutOrOptions.timeoutMs ?? DEFAULT_FFMPEG_TIMEOUT_MS);
  const maxDurationSeconds =
    typeof timeoutOrOptions === 'number'
      ? MAX_DURATION_SECONDS
      : (timeoutOrOptions.maxDurationSeconds ?? MAX_DURATION_SECONDS);
  const detectedContainer = detectAudioContainer(buffer);
  if (!detectedContainer) {
    throw new EvaluationModelError(
      'audio_missing',
      'Audio payload is corrupt or has an unsupported container header.',
      false,
    );
  }

  const dir = await mkdtemp(join(tmpdir(), 'mockza-audio-'));
  const inPath = join(dir, `input${inferInputExtension(sourceKey)}`);
  const outPath = join(dir, 'normalized.m4a');

  try {
    await writeFile(inPath, buffer);

    // Probe duration when ffprobe is installed to bound long/malformed streams early.
    const probe = await runBoundedProcess(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        inPath,
      ],
      Math.min(5000, timeoutMs),
    );
    if (probe.timedOut) {
      throw new EvaluationModelError('audio_missing', 'Audio probe timed out.', false);
    }
    if (probe.ok && probe.stdout.length > 0) {
      const durationSec = Number.parseFloat(probe.stdout);
      if (Number.isFinite(durationSec) && durationSec > maxDurationSeconds) {
        throw new EvaluationModelError(
          'audio_too_long',
          `Audio clip duration (${durationSec.toFixed(1)}s) exceeds ${maxDurationSeconds}s ceiling.`,
          false,
        );
      }
    }

    const trimmed = await runBoundedProcess(
      'ffmpeg',
      [
        '-y',
        '-t',
        String(maxDurationSeconds),
        '-i',
        inPath,
        '-vn',
        '-af',
        'silenceremove=start_periods=1:start_duration=0.25:start_threshold=-55dB',
        '-ar',
        '16000',
        '-ac',
        '1',
        '-c:a',
        'aac',
        '-b:a',
        '48k',
        '-movflags',
        '+faststart',
        outPath,
      ],
      timeoutMs,
    );

    if (trimmed.timedOut) {
      throw new EvaluationModelError('audio_missing', 'Audio transcoding timed out.', false);
    }

    if (trimmed.ok) {
      const out = await readFile(outPath);
      if (out.length >= 256) {
        return { base64Data: out.toString('base64'), format: 'm4a' };
      }
    }

    if (!trimmed.enoent) {
      // Retry plain bounded transcode in case recording was very quiet for silenceremove.
      const plain = await runBoundedProcess(
        'ffmpeg',
        [
          '-y',
          '-t',
          String(maxDurationSeconds),
          '-i',
          inPath,
          '-vn',
          '-ar',
          '16000',
          '-ac',
          '1',
          '-c:a',
          'aac',
          '-b:a',
          '48k',
          '-movflags',
          '+faststart',
          outPath,
        ],
        timeoutMs,
      );

      if (plain.timedOut) {
        throw new EvaluationModelError('audio_missing', 'Audio transcoding timed out.', false);
      }

      if (plain.ok) {
        const out = await readFile(outPath);
        if (out.length >= 256) {
          return { base64Data: out.toString('base64'), format: 'm4a' };
        }
      }

      throw new EvaluationModelError(
        'audio_missing',
        'Failed to decode or normalize recorded audio stream.',
        false,
      );
    }

    // If ffmpeg is absent in unit test runtime, accept ONLY model-native formats with truthful format tag.
    if (detectedContainer === 'm4a' || detectedContainer === 'mp3' || detectedContainer === 'wav') {
      return {
        base64Data: buffer.toString('base64'),
        format: detectedContainer,
      };
    }

    throw new EvaluationModelError(
      'audio_missing',
      `Transcoder unavailable for ${detectedContainer} container.`,
      true,
    );
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Backwards-compatible wrapper returning normalized m4a/native buffer. */
export async function trimAudioSilence(buffer: Buffer, sourceKey?: string): Promise<Buffer> {
  const prepared = await prepareAudioForModel(buffer, sourceKey);
  return Buffer.from(prepared.base64Data, 'base64');
}

/**
 * Encodes an already-normalized buffer while validating its container header rather than guessing m4a.
 */
export function encodeAudioForModel(
  buffer: Buffer,
  fallbackFormat: SupportedModelAudioFormat = 'm4a',
): PreparedAudioResult {
  const detected = detectAudioContainer(buffer);
  const format: SupportedModelAudioFormat =
    detected === 'wav' || detected === 'mp3' || detected === 'm4a' ? detected : fallbackFormat;
  return {
    base64Data: buffer.toString('base64'),
    format,
  };
}
