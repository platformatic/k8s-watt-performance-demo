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

// Load AOT manifest
const { loadAotManifest } = await import('@vertz/ui-server');
const serverDir = resolve(__dirname, 'dist', 'server');
const aotManifest = await loadAotManifest(serverDir);

// Load DB for AOT data resolver
const { db } = await import('./src/lib/db.ts');
await db.initialize();

// Direct Node adapter — no Web Request/Response bridging
const { createNodeHandler } = await import('@vertz/ui-server/node');
const handler = createNodeHandler({
  module: ssrModule,
  template,
  inlineCSS,
  aotManifest: aotManifest ?? undefined,
  aotDataResolver: async (pattern, params, unresolvedKeys, searchParams) => {
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
          const [sellers, sets, games] = await Promise.all([db.getSellers(), db.getSets(), db.getGames()]);
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
          const cards = await db.findMany('cards', seller.listings.map((l) => l.cardId));
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
      const order = (searchParams?.get('order') || 'asc');
      const page = parseInt(searchParams?.get('page') || '1');
      const searchKey = `search-${q}-${game}-${sort}-${order}-${page}`;
      if (unresolvedKeys.includes('search-games')) data.set('search-games', await db.getGames());
      if (unresolvedKeys.includes(searchKey)) data.set(searchKey, await db.searchCards({ q, game, sort, order, page, limit: 24 }));
    }

    return data;
  },
});

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
