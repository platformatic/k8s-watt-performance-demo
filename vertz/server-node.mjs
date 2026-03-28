import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const clientDir = resolve(__dirname, 'dist', 'client');

const ssrModule = await import('./dist/server/app.js');
const template = readFileSync(resolve(clientDir, '_shell.html'), 'utf-8');

const inlineCSS = {};
const vertzCssPath = resolve(clientDir, 'assets', 'vertz.css');
if (existsSync(vertzCssPath)) {
  inlineCSS['/assets/vertz.css'] = readFileSync(vertzCssPath, 'utf-8');
}

// Direct Node adapter — no Web Request/Response bridging
const { createNodeHandler } = await import('@vertz/ui-server/node');
const handler = createNodeHandler({ module: ssrModule, template, inlineCSS });

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.br': 'application/octet-stream',
};

// Pre-cache static files in memory for hot assets
const staticCache = new Map();

function serveStatic(pathname, res) {
  const cached = staticCache.get(pathname);
  if (cached) {
    res.writeHead(200, cached.headers);
    res.end(cached.body);
    return true;
  }

  const filePath = resolve(clientDir, `.${pathname}`);
  if (!filePath.startsWith(clientDir)) return false;
  if (!existsSync(filePath)) return false;
  const stat = statSync(filePath);
  if (!stat.isFile()) return false;

  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const body = readFileSync(filePath);
  const headers = {
    'Content-Type': contentType,
    'Content-Length': body.length,
    'Cache-Control': 'public, max-age=31536000, immutable',
  };

  staticCache.set(pathname, { body, headers });

  res.writeHead(200, headers);
  res.end(body);
  return true;
}

const port = parseInt(process.env.PORT || '3000');

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  if (pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  if (pathname.startsWith('/assets/') || pathname.startsWith('/__vertz_img/')) {
    if (serveStatic(pathname, res)) return;
  }

  // Direct Node handler — writes to res directly, no Web API conversion
  handler(req, res);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Vertz Node production server running at http://localhost:${port}`);
});
