import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(
  process.env.MOCKZA_WEB_ROOT ?? path.join(__dirname, '..', 'app', 'build', 'web'),
);
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
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.wasm', '.svg']);
const NO_CACHE_FILES = new Set([
  '/index.html',
  '/flutter_bootstrap.js',
  '/flutter_service_worker.js',
  '/version.json',
  '/manifest.json',
]);

function resolveFilePath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0] ?? '/');
  const candidate = path.normalize(path.join(WEB_ROOT, cleanPath));
  if (!candidate.startsWith(WEB_ROOT)) {
    return null;
  }
  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return { filePath: candidate, reqPath: cleanPath };
  }
  const indexCandidate = path.join(WEB_ROOT, 'index.html');
  if (existsSync(indexCandidate)) {
    return { filePath: indexCandidate, reqPath: '/index.html' };
  }
  return null;
}

const server = http.createServer((req, res) => {
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
  const noCache =
    NO_CACHE_FILES.has(reqPath) && !(req.url ?? '').includes('?v=');

  const headers = {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': noCache
      ? 'no-cache, no-store, must-revalidate'
      : 'public, max-age=86400',
  };

  const acceptsGzip =
    COMPRESSIBLE.has(ext) &&
    typeof req.headers['accept-encoding'] === 'string' &&
    req.headers['accept-encoding'].includes('gzip');

  if (acceptsGzip) {
    headers['Content-Encoding'] = 'gzip';
    headers['Vary'] = 'Accept-Encoding';
  } else {
    headers['Content-Length'] = String(stat.size);
  }

  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  const stream = createReadStream(filePath);
  if (acceptsGzip) {
    stream.pipe(createGzip({ level: 6 })).pipe(res);
  } else {
    stream.pipe(res);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`mockza-web static server listening on http://${HOST}:${PORT} serving ${WEB_ROOT}`);
});
