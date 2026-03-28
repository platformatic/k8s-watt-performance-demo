import { Server } from '../svelte/build/server/index.js';
import { manifest } from '../svelte/build/server/manifest.js';

const server = new Server(manifest);

let initialized = false;

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/healthz') {
      return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    // Skip static assets
    if (url.pathname.startsWith('/_app/')) {
      return new Response('Not Found', { status: 404 });
    }

    if (!initialized) {
      await server.init({
        env: process.env,
      });
      initialized = true;
    }

    try {
      const response = await server.respond(request, {
        getClientAddress: () => '127.0.0.1',
      });
      return response;
    } catch (err) {
      console.error('SvelteKit SSR error:', err);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};
