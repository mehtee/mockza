import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compressDistDir } from './compress_web_dist.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const SPA_INITIAL_JS_MAX_GZIP_BYTES = 95 * 1024;
const CALCULATOR_JS_MAX_GZIP_BYTES = 4 * 1024;

function walkFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkFiles(full));
    else if (entry.isFile()) results.push(full);
  }
  return results;
}

function collectRouteInitialJsGzipBytes(distDir, htmlRelPath) {
  const html = readFileSync(path.join(distDir, htmlRelPath), 'utf8');
  const visited = new Set();
  const queue = [];

  for (const match of html.matchAll(/<script[^>]+src="([^"]+)"/gi)) {
    const src = match[1];
    if (src && src.startsWith('/')) queue.push(new URL(src, 'http://localhost').pathname);
  }
  for (const match of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/gi)) {
    const href = match[1];
    if (href && href.startsWith('/')) queue.push(href);
  }
  for (const match of html.matchAll(/component-url="([^"]+)"/gi)) {
    const comp = match[1];
    if (comp && comp.startsWith('/')) queue.push(comp);
  }

  let totalGzipBytes = 0;
  let totalBrBytes = 0;
  const loadedFiles = [];

  while (queue.length > 0) {
    const webPath = queue.shift();
    if (!webPath || visited.has(webPath)) continue;
    visited.add(webPath);

    const diskPath = path.join(distDir, webPath.replace(/^\/+/, ''));
    if (!existsSync(diskPath)) continue;

    const raw = readFileSync(diskPath);
    const gzBytes = existsSync(`${diskPath}.gz`) ? statSync(`${diskPath}.gz`).size : raw.byteLength;
    const brBytes = existsSync(`${diskPath}.br`) ? statSync(`${diskPath}.br`).size : raw.byteLength;
    totalGzipBytes += gzBytes;
    totalBrBytes += brBytes;
    loadedFiles.push(webPath);

    const text = raw.toString('utf8');
    for (const imp of text.matchAll(/(?:import|export)\s*(?:[^'"]*?\sfrom\s*)?["'](\.[^"']+\.js)["']/g)) {
      const rel = imp[1];
      if (!rel) continue;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(webPath), rel));
      if (!visited.has(resolved)) {
        queue.push(resolved);
      }
    }
    for (const sideEffectImp of text.matchAll(/import\s*["'](\.[^"']+\.js)["']/g)) {
      const rel = sideEffectImp[1];
      if (!rel) continue;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(webPath), rel));
      if (!visited.has(resolved)) {
        queue.push(resolved);
      }
    }
  }

  return { totalGzipBytes, totalBrBytes, loadedFiles };
}

function assert(cond, msg) {
  if (!cond) {
    throw new Error(`Budget gate failed: ${msg}`);
  }
}

function checkEditionBuild(edition) {
  const distDir = path.join(ROOT_DIR, 'web', `dist-${edition}`);
  assert(existsSync(distDir), `Missing ${distDir} (run build:${edition} first)`);

  // Ensure pre-compressed .br and .gz files exist alongside all compressible assets >= 512B
  const compSummary = compressDistDir(distDir);
  assert(compSummary.filesProcessed >= 20, `${edition}: expected >=20 compressed files, got ${compSummary.filesProcessed}`);

  const zeroJsHtmlPaths = [
    'index.html',
    'ielts-academic/index.html',
    'ielts-general/index.html',
    'toefl-ibt/index.html',
    'pte-academic/index.html',
    'duolingo-english-test/index.html',
    'samples/index.html',
    'vocab/index.html',
  ];

  const expectedLang = edition === 'irn' ? 'fa' : 'en';
  const expectedDir = edition === 'irn' ? 'rtl' : 'ltr';

  for (const rel of zeroJsHtmlPaths) {
    const html = readFileSync(path.join(distDir, rel), 'utf8');
    assert(rel === 'index.html' || !/<script[^>]+src="\/_astro\//i.test(html), `${edition}/${rel}: public zero-JS route must not import /_astro/ scripts`);
    assert(html.includes(`lang="${expectedLang}"`) && html.includes(`dir="${expectedDir}"`), `${edition}/${rel}: invalid lang/dir`);
    assert(/<meta[^>]+name="viewport"/i.test(html), `${edition}/${rel}: missing viewport meta`);
    assert(/<meta[^>]+name="description"/i.test(html), `${edition}/${rel}: missing meta description`);
    assert(/<link[^>]+rel="canonical"/i.test(html), `${edition}/${rel}: missing canonical link`);
    assert(/<h1[\s>]/i.test(html), `${edition}/${rel}: missing H1 landmark`);
  }

  const homeStats = collectRouteInitialJsGzipBytes(distDir, 'index.html');
  assert(
    homeStats.totalGzipBytes <= 9 * 1024,
    `${edition}: public homepage exceeds 9 KiB gzip including theme boot`,
  );
  assert(
    !homeStats.loadedFiles.some((file) => /react|DesktopSimulatorApp|dexie/i.test(file)),
    `${edition}: homepage should load only its demo controller and theme boot`,
  );

  // Verify self-hosted fonts exist and Vazirmatn is excluded from GLB
  const files = walkFiles(distDir);
  const hasWoff2 = files.some((f) => f.endsWith('.woff2'));
  assert(hasWoff2, `${edition}: missing self-hosted .woff2 font assets`);
  if (edition === 'glb') {
    const glbVazirmatn = files.filter((f) => f.includes('vazirmatn') && f.endsWith('.woff2'));
    assert(
      glbVazirmatn.length === 0,
      `glb: found ${glbVazirmatn.length} Vazirmatn font assets that should only ship in IRN builds`,
    );
  } else {
    const irnVazirmatn = files.some((f) => f.includes('vazirmatn') && f.endsWith('.woff2'));
    assert(irnVazirmatn, 'irn: missing self-hosted Vazirmatn .woff2 font assets');
  }

  // Enforce strict initial JS budgets: <= 95 KB gzip on /app/home and <= 4 KB gzip on /calculators/*
  const spaStats = collectRouteInitialJsGzipBytes(distDir, 'app/home/index.html');
  assert(
    spaStats.totalGzipBytes <= SPA_INITIAL_JS_MAX_GZIP_BYTES,
    `${edition}: /app/home initial JS gzip ${(spaStats.totalGzipBytes / 1024).toFixed(1)}KB exceeds ${(SPA_INITIAL_JS_MAX_GZIP_BYTES / 1024).toFixed(0)}KB budget (${spaStats.loadedFiles.join(', ')})`,
  );

  for (const calcPath of ['calculators/index.html', 'calculators/toefl-6-to-120-converter/index.html']) {
    const calcStats = collectRouteInitialJsGzipBytes(distDir, calcPath);
    assert(
      calcStats.totalGzipBytes <= CALCULATOR_JS_MAX_GZIP_BYTES,
      `${edition}/${calcPath}: JS gzip ${(calcStats.totalGzipBytes / 1024).toFixed(2)}KB exceeds ${(CALCULATOR_JS_MAX_GZIP_BYTES / 1024).toFixed(0)}KB budget (${calcStats.loadedFiles.join(', ')})`,
    );
    assert(
      !calcStats.loadedFiles.some((f) => f.includes('react') || f.includes('DesktopSimulatorApp')),
      `${edition}/${calcPath}: calculator route unexpectedly pulls React runtime (${calcStats.loadedFiles.join(', ')})`,
    );
  }

  // Verify .br/.gz sidecars exist for main app JS bundle
  const largeJs = files.find((f) => f.endsWith('.js') && statSync(f).size > 50_000);
  assert(largeJs && existsSync(`${largeJs}.br`) && existsSync(`${largeJs}.gz`), `${edition}: missing .br/.gz sidecars for ${largeJs}`);

  const sampleAstroJs = path.basename(largeJs);
  return {
    distDir,
    compSummary,
    sampleAstroJs,
    spaInitialGzipKb: Number((spaStats.totalGzipBytes / 1024).toFixed(1)),
  };
}

function httpGetRaw(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const req = http.get(url, { headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          bytes: Buffer.concat(chunks).byteLength,
          elapsedMs: performance.now() - start,
        });
      });
    });
    req.on('error', reject);
  });
}

async function runConcurrencyBurstAndHeaderCheck(distDir, sampleAstroJs, port) {
  const child = spawn(process.execPath, [path.join(ROOT_DIR, 'scripts', 'serve_web_static.mjs')], {
    env: { ...process.env, MOCKZA_WEB_ROOT: distDir, MOCKZA_WEB_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    // Wait until /healthz responds 200
    const baseUrl = `http://127.0.0.1:${port}`;
    let healthy = false;
    for (let i = 0; i < 30; i += 1) {
      try {
        const res = await httpGetRaw(`${baseUrl}/healthz`);
        if (res.status === 200) {
          healthy = true;
          break;
        }
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(healthy, `Static server failed to respond on ${baseUrl}/healthz`);

    // Verify Brotli + Gzip content negotiation + Cache-Control immutable
    const homeBr = await httpGetRaw(`${baseUrl}/`, { 'Accept-Encoding': 'br, gzip' });
    assert(homeBr.status === 200, 'GET / did not return 200');
    assert(homeBr.headers['content-encoding'] === 'br', `Expected Content-Encoding: br on /, got ${homeBr.headers['content-encoding']}`);
    assert((homeBr.headers['cache-control'] ?? '').includes('no-cache'), 'Expected no-cache on HTML document');

    const jsGz = await httpGetRaw(`${baseUrl}/_astro/${sampleAstroJs}`, { 'Accept-Encoding': 'gzip' });
    assert(jsGz.status === 200, `GET /_astro/${sampleAstroJs} failed`);
    assert(jsGz.headers['content-encoding'] === 'gzip', `Expected Content-Encoding: gzip on JS, got ${jsGz.headers['content-encoding']}`);
    assert((jsGz.headers['cache-control'] ?? '').includes('immutable'), 'Expected immutable cache header on /_astro/*');

    // Concurrency burst test: 50 parallel workers x 20 requests = 1,000 static requests
    const burstRoutes = ['/', '/toefl-ibt/', '/calculators/', '/llms.txt', '/app/home/'];
    const durations = [];
    let errors = 0;
    const workers = Array.from({ length: 50 }, async (_, workerIdx) => {
      for (let step = 0; step < 20; step += 1) {
        const route = burstRoutes[(workerIdx + step) % burstRoutes.length];
        const r = await httpGetRaw(`${baseUrl}${route}`, { 'Accept-Encoding': 'br, gzip' });
        durations.push(r.elapsedMs);
        if (r.status !== 200) errors += 1;
      }
    });
    await Promise.all(workers);

    durations.sort((a, b) => a - b);
    const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;
    assert(errors === 0, `Concurrency burst encountered ${errors} non-200 responses`);
    assert(p95 < 100, `Concurrency burst p95 latency too high: ${p95.toFixed(1)}ms`);
    return { p95Ms: Number(p95.toFixed(2)), requests: durations.length, jsGzBytes: jsGz.bytes };
  } finally {
    child.kill('SIGTERM');
  }
}

async function main() {
  const glb = checkEditionBuild('glb');
  const irn = checkEditionBuild('irn');
  const glbPerf = await runConcurrencyBurstAndHeaderCheck(glb.distDir, glb.sampleAstroJs, 45980);
  const irnPerf = await runConcurrencyBurstAndHeaderCheck(irn.distDir, irn.sampleAstroJs, 45981);

  console.log(
    `GLB static budget OK: landing JS within budget, zero-JS pillars, br/gz compressed (${glb.compSummary.filesProcessed} files), main chunk gzip=${(glbPerf.jsGzBytes / 1024).toFixed(1)}KB, 1000-req burst p95=${glbPerf.p95Ms}ms`,
  );
  console.log(
    `IRN static budget OK: landing JS within budget, zero-JS pillars, br/gz compressed (${irn.compSummary.filesProcessed} files), main chunk gzip=${(irnPerf.jsGzBytes / 1024).toFixed(1)}KB, 1000-req burst p95=${irnPerf.p95Ms}ms`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
