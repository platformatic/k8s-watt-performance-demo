import { createSSRHandler } from '@vertz/ui-server';
import * as ssrModule from '../vertz/dist/server/app.js';

const template = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vertz App</title>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>`;

const handler = createSSRHandler({ module: ssrModule, template, inlineCSS: {} });

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/healthz') {
      return new Response('OK');
    }
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/assets/')) {
      return new Response('Not Found', { status: 404 });
    }
    return handler(request);
  }
};
