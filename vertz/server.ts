import { createSSRHandler, loadAotManifest } from '@vertz/ui-server';
import { resolve } from 'path';
import { db } from './src/lib/db';

const clientDir = resolve(import.meta.dir, 'dist', 'client');
const serverDir = resolve(import.meta.dir, 'dist', 'server');
const ssrModule = await import('./dist/server/app.js');
const template = await Bun.file(resolve(clientDir, '_shell.html')).text();

const inlineCSS: Record<string, string> = {};
const vertzCssPath = resolve(clientDir, 'assets', 'vertz.css');
const vertzCssFile = Bun.file(vertzCssPath);
if (await vertzCssFile.exists()) {
  inlineCSS['/assets/vertz.css'] = await vertzCssFile.text();
}

// Pre-initialize DB cache
await db.initialize();

const aotManifest = await loadAotManifest(serverDir);

const handler = createSSRHandler({
  module: ssrModule,
  template,
  inlineCSS,
  aotManifest: aotManifest ?? undefined,
  aotDataResolver: async (pattern, params, unresolvedKeys) => {
    const data = new Map<string, unknown>();

    for (const key of unresolvedKeys) {
      if (key === 'home-games') {
        data.set(key, await db.getGames());
      } else if (key === 'home-trending') {
        data.set(key, await db.getTrendingCards(8));
      } else if (key === 'home-releases') {
        data.set(key, await db.getNewReleaseSets(4));
      } else if (key === 'games') {
        data.set(key, await db.getGames());
      } else if (key === 'sellers') {
        const sellers = await db.getSellers();
        data.set(key, [...sellers].sort((a, b) => b.rating - a.rating));
      } else if (key.startsWith('game-') && params.slug) {
        data.set(key, await db.getGameWithSets(params.slug));
      } else if (key.startsWith('card-') && params.id) {
        const card = await db.getCardWithListings(params.id);
        if (card) {
          const sellers = await db.getSellers();
          const sets = await db.getSets();
          const games = await db.getGames();
          const set = sets.find((s) => s.id === card.setId);
          const game = games.find((g) => g.id === card.gameId);
          data.set(key, { ...card, sellers, set, game });
        }
      }
    }

    return data;
  },
});

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
if (aotManifest) {
  console.log(`AOT manifest loaded: ${Object.keys(aotManifest.routes).length} routes`);
}
