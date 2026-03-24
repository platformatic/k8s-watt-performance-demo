import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const clientDir = resolve(__dirname, 'dist', 'client');

const ssrModule = await import('./dist/server/app.js');
const template = readFileSync(resolve(clientDir, '_shell.html'), 'utf-8');

const inlineCSS = {};
const vertzCssPath = resolve(clientDir, 'assets', 'vertz.css');
if (existsSync(vertzCssPath)) {
  inlineCSS['/assets/vertz.css'] = readFileSync(vertzCssPath, 'utf-8');
}

const { createSSRHandler } = await import('@vertz/ui-server');
const handler = createSSRHandler({ module: ssrModule, template, inlineCSS });

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

const server = createServer(async (req, res) => {
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

  try {
    const webRequest = new Request(url.href, {
      method: req.method,
      headers: req.headers,
    });

    const webResponse = await handler(webRequest);

    const headers = {};
    webResponse.headers.forEach((value, key) => {
      headers[key] = value;
    });
    res.writeHead(webResponse.status, headers);

    // Stream the body instead of buffering with .text()
    if (webResponse.body) {
      const nodeStream = Readable.fromWeb(webResponse.body);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    console.error('[SSR] Render failed:', err.message || err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
    }
    res.end('Internal Server Error');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Vertz Node production server running at http://localhost:${port}`);
});
