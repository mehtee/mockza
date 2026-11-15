import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';

export interface PreparedAudioResult {
  base64Data: string;
  format: 'm4a';
}

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
      throw new Error(`Audio stream exceeds ${maxBytes} bytes limit.`);
    }
    chunks.push(buf);
  }

  return Buffer.concat(chunks);
}

function inferInputExtension(sourceKey?: string): string {
  if (!sourceKey) return '.m4a';
  const ext = extname(sourceKey).toLowerCase();
  if (ext === '.webm' || ext === '.ogg' || ext === '.wav' || ext === '.m4a' || ext === '.mp4') {
    return ext;
  }
  return '.m4a';
}

async function runFfmpeg(args: string[]): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'ignore'] });
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
  });
}

/**
 * Transcodes and normalizes arbitrary browser/native audio (.webm, .ogg, .wav, .m4a)
 * via temporary files into 16 kHz mono AAC .m4a (avoiding pipe:0 moov atom failures).
 * Falls back to the original buffer if ffmpeg is unavailable in the runtime (e.g. unit tests).
 */
export async function trimAudioSilence(buffer: Buffer, sourceKey?: string): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'mockza-audio-'));
  const inPath = join(dir, `input${inferInputExtension(sourceKey)}`);
  const outPath = join(dir, 'normalized.m4a');

  try {
    await writeFile(inPath, buffer);

    const trimmedOk = await runFfmpeg([
      '-y',
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
    ]);

    if (trimmedOk) {
      const out = await readFile(outPath);
      if (out.length >= 256) {
        return out;
      }
    }

    // Retry plain transcode without silence removal in case recording is very quiet.
    const transcodeOk = await runFfmpeg([
      '-y',
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
    ]);

    if (transcodeOk) {
      const out = await readFile(outPath);
      if (out.length >= 256) {
        return out;
      }
    }

    return buffer;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Prepares normalized .m4a audio for direct OpenRouter multimodal input.
 */
export function encodeAudioForModel(buffer: Buffer): PreparedAudioResult {
  return {
    base64Data: buffer.toString('base64'),
    format: 'm4a',
  };
}
