import { createSSRHandler, loadAotManifest } from '@vertz/ui-server';
import * as ssrModule from '../vertz/dist/server/app.js';
import { db } from '../vertz/src/lib/db';

// loadAotManifest reads aot-manifest.json + aot-routes.js
// The manifest now includes app shell entry + parameterized routes
// No manual LAYOUT_OPEN/LAYOUT_CLOSE hack needed
const aotManifest = await loadAotManifest('../vertz/dist/server');

async function aotDataResolver(pattern, params, unresolvedKeys) {
  const data = new Map();

  if (pattern === '/') {
    const [games, trending, releases] = await Promise.all([
      unresolvedKeys.includes('home-games') ? db.getGames() : null,
      unresolvedKeys.includes('home-trending') ? db.getTrendingCards(8) : null,
      unresolvedKeys.includes('home-releases') ? db.getNewReleaseSets(4) : null,
    ]);
    if (games !== null) data.set('home-games', games);
    if (trending !== null) data.set('home-trending', trending);
    if (releases !== null) data.set('home-releases', releases);
  } else if (pattern === '/games') {
    if (unresolvedKeys.includes('games')) data.set('games', await db.getGames());
  } else if (pattern === '/games/:slug') {
    const key = `game-${params.slug}`;
    if (unresolvedKeys.includes(key)) data.set(key, await db.getGameWithSets(params.slug));
  } else if (pattern === '/cards/:id') {
    const key = `card-${params.id}`;
    if (unresolvedKeys.includes(key)) {
      const card = await db.getCardWithListings(params.id);
      if (card) {
        const [sellers, sets, games] = await Promise.all([
          db.getSellers(),
          db.getSets(),
          db.getGames(),
        ]);
        const set = sets.find((s) => s.id === card.setId);
        const game = games.find((g) => g.id === card.gameId);
        data.set(key, { ...card, sellers, set, game });
      }
    }
  } else if (pattern === '/sellers') {
    if (unresolvedKeys.includes('sellers')) {
      const sellers = await db.getSellers();
      data.set('sellers', [...sellers].sort((a, b) => b.rating - a.rating));
    }
  }

  return data;
}

const template = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vertz App</title>
    <meta name="theme-color" content="#0a0a0b">
  </head>
  <body>
    <div id="app"></div>
    <script type="module" crossorigin src="/assets/entry-client.js"></script>
  </body>
</html>`;

const handler = createSSRHandler({
  module: ssrModule,
  template,
  aotManifest: aotManifest ?? undefined,
  aotDataResolver,
});

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/healthz') return new Response('OK');
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/assets/')) {
      return new Response('Not Found', { status: 404 });
    }
    return handler(request);
  },
};
