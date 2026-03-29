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

// Load AOT manifest — includes app shell, parameterized routes, per-route CSS
const aotManifest = await loadAotManifest(serverDir);

const handler = createSSRHandler({
  module: ssrModule,
  template,
  inlineCSS,
  aotManifest: aotManifest ?? undefined,
  aotDataResolver: async (pattern, params, unresolvedKeys, searchParams) => {
    const data = new Map<string, unknown>();

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
    } else if (pattern === '/sellers/:slug') {
      const page = parseInt(searchParams?.get('page') || '1');
      const sellerKey = `seller-${params.slug}-${page}`;
      if (unresolvedKeys.includes(sellerKey)) {
        const seller = await db.getSellerWithListings(params.slug, page, 20);
        if (seller) {
          const cards = await db.findMany<{ id: string; name: string; number: string }>('cards', seller.listings.map((l) => l.cardId));
          data.set(sellerKey, { ...seller, cards });
        }
      }
    } else if (pattern === '/sets/:slug') {
      const page = parseInt(searchParams?.get('page') || '1');
      const setKey = `set-${params.slug}-${page}`;
      if (unresolvedKeys.includes(setKey)) {
        data.set(setKey, await db.getSetWithCards(params.slug, page, 24));
      }
    } else if (pattern === '/search') {
      const q = searchParams?.get('q') || undefined;
      const game = searchParams?.get('game') || undefined;
      const sort = searchParams?.get('sort') || undefined;
      const order = (searchParams?.get('order') || 'asc') as 'asc' | 'desc';
      const page = parseInt(searchParams?.get('page') || '1');
      // Exact key match — AOT keys encode defaults: ${sp:q|undefined} → "undefined" when missing
      const searchKey = `search-${q}-${game}-${sort}-${order}-${page}`;

      if (unresolvedKeys.includes('search-games')) {
        data.set('search-games', await db.getGames());
      }
      if (unresolvedKeys.includes(searchKey)) {
        data.set(searchKey, await db.searchCards({ q, game, sort: sort as 'price' | 'name' | 'date' | undefined, order, page, limit: 24 }));
      }
    } else if (pattern === '/cart') {
      // Cart page has no query keys — static AOT render
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
  console.log(`AOT manifest loaded: ${Object.keys(aotManifest.routes).length} routes, app shell: ${!!aotManifest.app}`);
}
