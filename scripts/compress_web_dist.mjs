import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const COMPRESSIBLE_EXTS = new Set([
  '.html',
  '.js',
  '.mjs',
  '.css',
  '.json',
  '.svg',
  '.txt',
  '.md',
  '.xml',
  '.wasm',
]);
const MIN_BYTES = 512;

function walkFiles(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

export function compressDistDir(targetDir) {
  const absDir = path.resolve(targetDir);
  if (!existsSync(absDir)) {
    return { dir: absDir, filesProcessed: 0, totalRawBytes: 0, totalBrBytes: 0, totalGzBytes: 0 };
  }

  let filesProcessed = 0;
  let totalRawBytes = 0;
  let totalBrBytes = 0;
  let totalGzBytes = 0;

  for (const file of walkFiles(absDir)) {
    const ext = path.extname(file).toLowerCase();
    if (!COMPRESSIBLE_EXTS.has(ext)) continue;

    const raw = readFileSync(file);
    if (raw.byteLength < MIN_BYTES) continue;

    const br = zlib.brotliCompressSync(raw, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
    });
    const gz = zlib.gzipSync(raw, { level: 9 });

    writeFileSync(`${file}.br`, br);
    writeFileSync(`${file}.gz`, gz);

    filesProcessed += 1;
    totalRawBytes += raw.byteLength;
    totalBrBytes += br.byteLength;
    totalGzBytes += gz.byteLength;
  }

  return { dir: absDir, filesProcessed, totalRawBytes, totalBrBytes, totalGzBytes };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const targets =
    args.length > 0
      ? args.map((p) => path.resolve(process.cwd(), p))
      : [path.join(ROOT_DIR, 'web', 'dist-glb'), path.join(ROOT_DIR, 'web', 'dist-irn')].filter((d) =>
          existsSync(d) && statSync(d).isDirectory(),
        );

  if (targets.length === 0) {
    console.error('No dist directories found to pre-compress.');
    process.exit(1);
  }

  for (const target of targets) {
    const summary = compressDistDir(target);
    const brRatio = summary.totalRawBytes > 0 ? ((summary.totalBrBytes / summary.totalRawBytes) * 100).toFixed(1) : '0.0';
    const gzRatio = summary.totalRawBytes > 0 ? ((summary.totalGzBytes / summary.totalRawBytes) * 100).toFixed(1) : '0.0';
    console.log(
      `Compressed ${summary.filesProcessed} assets in ${summary.dir}: raw=${summary.totalRawBytes}B, br=${summary.totalBrBytes}B (${brRatio}%), gz=${summary.totalGzBytes}B (${gzRatio}%)`,
    );
  }
}
