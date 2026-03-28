import { createSSRHandler } from '@vertz/ui-server';
import * as ssrModule from '../vertz/dist/server/app.js';
import {
  __ssr_CartPage,
  __ssr_SellersPage,
  __ssr_HomePage,
  __ssr_GamesPage,
} from '../vertz/dist/server/aot-routes.js';
import { db } from '../vertz/src/lib/db';
import manifestJson from '../vertz/dist/server/aot-manifest.json';

// App layout wrapper — the App component is classified as runtime-fallback
// so AOT renders only the page content. We wrap with the layout here,
// using inline styles (matching Hono's approach for benchmark parity).
const LAYOUT_OPEN = `<div style="min-height:100vh;display:flex;flex-direction:column"><header style="background:white;padding:16px 0;border-bottom:1px solid #e5e7eb"><div style="max-width:1280px;margin:0 auto;padding:0 16px;display:flex;justify-content:space-between;align-items:center"><a href="/" style="font-size:24px;font-weight:bold;color:#2563eb;text-decoration:none">CardMarket</a><nav style="display:flex;gap:24px"><a href="/games" style="color:#4b5563;text-decoration:none">Games</a><a href="/search" style="color:#4b5563;text-decoration:none">Search</a><a href="/sellers" style="color:#4b5563;text-decoration:none">Sellers</a><a href="/cart" style="color:#4b5563;text-decoration:none">Cart</a></nav></div></header><main style="max-width:1280px;width:100%;margin:0 auto;padding:16px 16px 32px;flex:1">`;
const LAYOUT_CLOSE = `</main><footer style="background:white;padding:24px 16px;font-size:14px;border-top:1px solid #e5e7eb;text-align:center;color:#6b7280">CardMarket - Trading Card Marketplace Benchmark</footer></div>`;

// Wrap each AOT render function to include the layout
function withLayout(renderFn) {
  return function(data, ctx) {
    return LAYOUT_OPEN + renderFn(data, ctx) + LAYOUT_CLOSE;
  };
}

const aotManifest = {
  routes: {
    '/': {
      render: withLayout(__ssr_HomePage),
      holes: [],
      queryKeys: ['home-games', 'home-trending', 'home-releases'],
      css: manifestJson.routes['/'].css,
    },
    '/games': {
      render: withLayout(__ssr_GamesPage),
      holes: [],
      queryKeys: ['games'],
      css: manifestJson.routes['/games'].css,
    },
    '/sellers': {
      render: withLayout(__ssr_SellersPage),
      holes: [],
      queryKeys: ['sellers'],
      css: manifestJson.routes['/sellers'].css,
    },
    '/cart': {
      render: withLayout(__ssr_CartPage),
      holes: [],
      queryKeys: [],
      css: manifestJson.routes['/cart'].css,
    },
  },
};

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
        const sellers = await db.getSellers();
        const sets = await db.getSets();
        const games = await db.getGames();
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
  aotManifest,
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
