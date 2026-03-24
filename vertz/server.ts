import { createSSRHandler } from '@vertz/ui-server';
import { resolve } from 'path';

const clientDir = resolve(import.meta.dir, 'dist', 'client');
const ssrModule = await import('./dist/server/app.js');
const template = await Bun.file(resolve(clientDir, '_shell.html')).text();

const inlineCSS: Record<string, string> = {};
const vertzCssPath = resolve(clientDir, 'assets', 'vertz.css');
const vertzCssFile = Bun.file(vertzCssPath);
if (await vertzCssFile.exists()) {
  inlineCSS['/assets/vertz.css'] = await vertzCssFile.text();
}

const handler = createSSRHandler({ module: ssrModule, template, inlineCSS });
const port = parseInt(process.env.PORT || '3000');

const server = Bun.serve({
  port,
  hostname: '0.0.0.0',
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname.startsWith('/api/')) {
      return new Response('Not Found', { status: 404 });
    }

    if (pathname === '/healthz') {
      return new Response('OK', { status: 200 });
    }

    if (pathname.startsWith('/assets/') || pathname.startsWith('/__vertz_img/')) {
      const filePath = resolve(clientDir, `.${pathname}`);
      if (filePath.startsWith(clientDir)) {
        const file = Bun.file(filePath);
        if (await file.exists()) {
          return new Response(file, {
            headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
          });
        }
      }
    }

    return handler(request);
  },
});

console.log(`Vertz production server running at http://localhost:${server.port}`);
