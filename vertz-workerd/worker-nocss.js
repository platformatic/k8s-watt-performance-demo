import { createSSRHandler } from '@vertz/ui-server';
import * as ssrModule from '../vertz/dist/server/app.js';
import {
  __ssr_App,
  __ssr_CartPage,
  __ssr_SellersPage,
  __ssr_HomePage,
  __ssr_GamesPage,
  __ssr_GameDetailPage,
  __ssr_CardDetailPage,
} from '../vertz/dist/server/aot-routes.js';
import manifestJson from '../vertz/dist/server/aot-manifest.json';
import { db } from '../vertz/src/lib/db';

const aotManifest = {
  routes: {
    '/': {
      render: __ssr_HomePage,
      holes: [],
      queryKeys: ['home-games', 'home-trending', 'home-releases'],
      css: manifestJson.routes['/'].css,
    },
    '/games': {
      render: __ssr_GamesPage,
      holes: [],
      queryKeys: ['games'],
      css: manifestJson.routes['/games'].css,
    },
    '/games/:slug': {
      render: __ssr_GameDetailPage,
      holes: [],
      queryKeys: ['game-${slug}'],
      paramBindings: ['slug'],
      css: manifestJson.routes['/games/:slug'].css,
    },
    '/cards/:id': {
      render: __ssr_CardDetailPage,
      holes: [],
      queryKeys: ['card-${id}'],
      paramBindings: ['id'],
      css: manifestJson.routes['/cards/:id'].css,
    },
    '/sellers': {
      render: __ssr_SellersPage,
      holes: [],
      queryKeys: ['sellers'],
      css: manifestJson.routes['/sellers'].css,
    },
    '/cart': {
      render: __ssr_CartPage,
      holes: [],
      queryKeys: [],
      css: manifestJson.routes['/cart'].css,
    },
  },
  app: {
    render: __ssr_App,
    holes: ['RouterView'],
    queryKeys: [],
    css: manifestJson.app.css,
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

const innerHandler = createSSRHandler({
  module: ssrModule,
  template,
  aotManifest,
  aotDataResolver,
});

// Strip <style> tags from response to isolate pure render performance
const styleRegex = /<style[^>]*>[\s\S]*?<\/style>/g;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/healthz') return new Response('OK');
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/assets/')) {
      return new Response('Not Found', { status: 404 });
    }
    const response = await innerHandler(request);
    const html = await response.text();
    const stripped = html.replace(styleRegex, '');
    return new Response(stripped, {
      status: response.status,
      headers: response.headers,
    });
  },
};
