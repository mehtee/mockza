import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIST = existsSync(path.join(__dirname, '..', 'web', 'dist-glb'))
  ? path.join(__dirname, '..', 'web', 'dist-glb')
  : path.join(__dirname, '..', 'app', 'build', 'web');
const WEB_ROOT = path.resolve(process.env.MOCKZA_WEB_ROOT ?? DEFAULT_DIST);
const HOST = process.env.MOCKZA_WEB_HOST ?? '127.0.0.1';
const PORT = Number(process.env.MOCKZA_WEB_PORT ?? '45280');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.wasm', '.svg', '.txt', '.md', '.xml']);
const NO_CACHE_PATHS = new Set([
  '/index.html',
  '/robots.txt',
  '/llms.txt',
  '/llms-full.txt',
  '/sitemap-index.xml',
  '/flutter_bootstrap.js',
  '/flutter_service_worker.js',
  '/version.json',
  '/manifest.json',
]);

function resolveFilePath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0] ?? '/');
  const trimmedRel = cleanPath.replace(/^\/+/, '');
  const candidate = path.resolve(WEB_ROOT, trimmedRel);
  if (candidate !== WEB_ROOT && !candidate.startsWith(`${WEB_ROOT}${path.sep}`)) {
    return null;
  }

  // Exact file match (including /llms.txt, /toefl-ibt.md, /og/home.svg, _astro assets)
  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return { filePath: candidate, reqPath: cleanPath };
  }

  // Directory index match (/ielts-academic -> /ielts-academic/index.html)
  const dirIndex = path.join(candidate, 'index.html');
  if (existsSync(dirIndex) && statSync(dirIndex).isFile()) {
    return { filePath: dirIndex, reqPath: `${cleanPath.replace(/\/$/, '')}/index.html` };
  }

  // Dynamic /app/* SPA fallback -> /app/index.html (or root index.html for Flutter)
  if (cleanPath === '/app' || cleanPath.startsWith('/app/')) {
    const spaFallback = path.join(WEB_ROOT, 'app', 'index.html');
    if (existsSync(spaFallback)) {
      return { filePath: spaFallback, reqPath: '/app/index.html' };
    }
  }

  const rootIndex = path.join(WEB_ROOT, 'index.html');
  if (!existsSync(path.join(WEB_ROOT, '_astro')) && existsSync(rootIndex)) {
    return { filePath: rootIndex, reqPath: '/index.html' };
  }

  return null;
}

const server = http.createServer((req, res) => {
  if ((req.url ?? '') === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end('ok\n');
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }

  const resolved = resolveFilePath(req.url ?? '/');
  if (!resolved) {
    res.writeHead(404).end('Not found');
    return;
  }

  const { filePath, reqPath } = resolved;
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
  const stat = statSync(filePath);
  const isImmutable = reqPath.startsWith('/_astro/') && !(req.url ?? '').includes('no-cache');
  const noCache = NO_CACHE_PATHS.has(reqPath) || ext === '.html';

  const headers = {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': isImmutable
      ? 'public, max-age=31536000, immutable'
      : noCache
        ? 'no-cache, no-store, must-revalidate'
        : 'public, max-age=86400',
  };

  const acceptEnc = typeof req.headers['accept-encoding'] === 'string' ? req.headers['accept-encoding'] : '';
  const brPath = `${filePath}.br`;
  const gzPath = `${filePath}.gz`;

  let streamPath = filePath;
  let dynamicGzip = false;

  if (COMPRESSIBLE.has(ext) && acceptEnc.includes('br') && existsSync(brPath)) {
    headers['Content-Encoding'] = 'br';
    headers['Vary'] = 'Accept-Encoding';
    headers['Content-Length'] = String(statSync(brPath).size);
    streamPath = brPath;
  } else if (COMPRESSIBLE.has(ext) && acceptEnc.includes('gzip') && existsSync(gzPath)) {
    headers['Content-Encoding'] = 'gzip';
    headers['Vary'] = 'Accept-Encoding';
    headers['Content-Length'] = String(statSync(gzPath).size);
    streamPath = gzPath;
  } else if (COMPRESSIBLE.has(ext) && acceptEnc.includes('gzip')) {
    headers['Content-Encoding'] = 'gzip';
    headers['Vary'] = 'Accept-Encoding';
    dynamicGzip = true;
  } else {
    headers['Content-Length'] = String(stat.size);
  }

  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  const stream = createReadStream(streamPath);
  if (dynamicGzip) {
    stream.pipe(createGzip({ level: 6 })).pipe(res);
  } else {
    stream.pipe(res);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`mockza-web static server listening on http://${HOST}:${PORT} serving ${WEB_ROOT}`);
});
