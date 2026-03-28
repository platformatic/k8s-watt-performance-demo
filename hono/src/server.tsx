import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import type { FC } from 'hono/jsx';
import { db } from './db';

const app = new Hono();

// ── Layout ──

const Layout: FC<{ title: string }> = ({ title, children }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title} - Card Marketplace</title>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; color: #111827; }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
        nav { background: white; border-bottom: 1px solid #e5e7eb; padding: 16px 0; margin-bottom: 32px; }
        nav a { text-decoration: none; color: #4b5563; margin-right: 24px; font-weight: 500; }
        nav a:hover { color: #2563eb; }
      `}</style>
    </head>
    <body>
      <nav>
        <div class="container" style="display:flex;align-items:center;gap:24px">
          <a href="/" style="font-weight:bold;font-size:20px;color:#111827">CardMarket</a>
          <a href="/games">Games</a>
          <a href="/search">Search</a>
          <a href="/sellers">Sellers</a>
        </div>
      </nav>
      <main class="container" style="padding-bottom:64px">
        {children}
      </main>
    </body>
  </html>
);

// ── Home Page ──

app.get('/', async (c) => {
  const [games, trending, releases] = await Promise.all([
    db.getGames(),
    db.getTrendingCards(8),
    db.getNewReleaseSets(4),
  ]);

  return c.html(
    <Layout title="Home">
      <section style="text-align:center;padding:48px 0;background:linear-gradient(to right,#2563eb,#7c3aed);border-radius:12px;color:white;margin-bottom:48px">
        <h1 style="font-size:36px;font-weight:bold;margin-bottom:16px">Trading Card Marketplace</h1>
        <p style="font-size:20px;opacity:0.9;margin-bottom:24px">Buy and sell cards from your favorite games</p>
        <a href="/search" style="display:inline-block;background:white;color:#2563eb;padding:12px 24px;border-radius:8px;font-weight:600;text-decoration:none">Start Shopping</a>
      </section>

      <section style="margin-bottom:48px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
          <h2 style="font-size:24px;font-weight:bold">Browse by Game</h2>
          <a href="/games" style="color:#2563eb;text-decoration:none">View All</a>
        </div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:16px">
          {games.map((game: any) => (
            <a href={`/games/${game.slug}`} style="text-decoration:none;color:inherit;background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:16px">
              <div style="aspect-ratio:1;background:#f3f4f6;border-radius:4px;margin-bottom:12px;display:flex;align-items:center;justify-content:center">
                <span style="font-size:30px">{game.name.charAt(0)}</span>
              </div>
              <h3 style="font-weight:600;text-align:center">{game.name}</h3>
              <p style="font-size:14px;color:#6b7280;text-align:center">{game.cardCount.toLocaleString()} cards</p>
            </a>
          ))}
        </div>
      </section>

      <section style="margin-bottom:48px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
          <h2 style="font-size:24px;font-weight:bold">Trending Cards</h2>
          <a href="/search?sort=trending" style="color:#2563eb;text-decoration:none">View All</a>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
          {trending.map((card: any) => (
            <a href={`/cards/${card.id}`} style="text-decoration:none;color:inherit;background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:16px">
              <div style="aspect-ratio:3/4;background:#f3f4f6;border-radius:4px;margin-bottom:12px;display:flex;align-items:center;justify-content:center">
                <span style="color:#9ca3af;font-size:14px">{card.number}</span>
              </div>
              <h3 style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{card.name}</h3>
              <p style="font-size:12px;color:#6b7280">{card.rarity}</p>
            </a>
          ))}
        </div>
      </section>

      <section>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
          <h2 style="font-size:24px;font-weight:bold">New Releases</h2>
          <a href="/games" style="color:#2563eb;text-decoration:none">View All Sets</a>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
          {releases.map((set: any) => (
            <a href={`/sets/${set.slug}`} style="text-decoration:none;color:inherit;background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:16px">
              <div style="aspect-ratio:16/9;background:#f3f4f6;border-radius:4px;margin-bottom:12px;display:flex;align-items:center;justify-content:center">
                <span style="color:#9ca3af">{set.name.substring(0, 2)}</span>
              </div>
              <h3 style="font-weight:600">{set.name}</h3>
              <p style="font-size:14px;color:#6b7280">{set.totalCards} cards | {set.releaseDate}</p>
            </a>
          ))}
        </div>
      </section>
    </Layout>
  );
});

// ── Games ──

app.get('/games', async (c) => {
  const games = await db.getGames();
  return c.html(
    <Layout title="Games">
      <h1 style="font-size:30px;font-weight:bold;margin-bottom:32px">All Games</h1>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px">
        {games.map((game: any) => (
          <a href={`/games/${game.slug}`} style="text-decoration:none;color:inherit;background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:24px">
            <div style="aspect-ratio:16/9;background:#f3f4f6;border-radius:4px;margin-bottom:16px;display:flex;align-items:center;justify-content:center">
              <span style="font-size:48px;font-weight:bold;color:#d1d5db">{game.name.charAt(0)}</span>
            </div>
            <h2 style="font-size:20px;font-weight:bold;margin-bottom:8px">{game.name}</h2>
            <p style="color:#4b5563;margin-bottom:16px">{game.description}</p>
            <p style="font-size:14px;color:#2563eb">{game.cardCount.toLocaleString()} cards available</p>
          </a>
        ))}
      </div>
    </Layout>
  );
});

// ── Game Detail ──

app.get('/games/:slug', async (c) => {
  const slug = c.req.param('slug');
  const game = await db.getGameWithSets(slug);
  if (!game) return c.html(<Layout title="Not Found"><p>Game not found</p></Layout>, 404);

  return c.html(
    <Layout title={game.name}>
      <div style="margin-bottom:32px">
        <a href="/games" style="color:#2563eb;text-decoration:none;margin-bottom:16px;display:inline-block">&larr; Back to Games</a>
        <h1 style="font-size:30px;font-weight:bold">{game.name}</h1>
        <p style="color:#4b5563;margin-top:8px">{game.description}</p>
        <p style="font-size:14px;color:#6b7280;margin-top:4px">{game.cardCount.toLocaleString()} total cards | {game.sets.length} sets</p>
      </div>

      <h2 style="font-size:24px;font-weight:bold;margin-bottom:24px">Available Sets</h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px">
        {game.sets.map((set: any) => (
          <a href={`/sets/${set.slug}`} style="text-decoration:none;color:inherit;background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:24px">
            <div style="aspect-ratio:16/9;background:#f3f4f6;border-radius:4px;margin-bottom:16px;display:flex;align-items:center;justify-content:center">
              <span style="color:#9ca3af">{set.name.substring(0, 2)}</span>
            </div>
            <h3 style="font-size:18px;font-weight:bold">{set.name}</h3>
            <p style="font-size:14px;color:#6b7280">{set.totalCards} cards | Released {set.releaseDate}</p>
          </a>
        ))}
      </div>
    </Layout>
  );
});

// ── Set Detail ──

app.get('/sets/:slug', async (c) => {
  const slug = c.req.param('slug');
  const page = parseInt(c.req.query('page') || '1');
  const set = await db.getSetWithCards(slug, page, 24);
  if (!set) return c.html(<Layout title="Not Found"><p>Set not found</p></Layout>, 404);

  return c.html(
    <Layout title={set.name}>
      <div style="margin-bottom:32px">
        <a href={`/games/${set.game.slug}`} style="color:#2563eb;text-decoration:none;margin-bottom:16px;display:inline-block">&larr; Back to {set.game.name}</a>
        <h1 style="font-size:30px;font-weight:bold">{set.name}</h1>
        <p style="color:#4b5563;margin-top:8px">{set.game.name} | {set.totalCards} cards | Released {set.releaseDate}</p>
      </div>

      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:16px">
        {set.cards.map((card: any) => (
          <a href={`/cards/${card.id}`} style="text-decoration:none;color:inherit;background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:12px">
            <div style="aspect-ratio:3/4;background:#f3f4f6;border-radius:4px;margin-bottom:8px;display:flex;align-items:center;justify-content:center">
              <span style="color:#9ca3af;font-size:12px">{card.number}</span>
            </div>
            <h3 style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{card.name}</h3>
            <p style="font-size:12px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{card.rarity}</p>
          </a>
        ))}
      </div>

      {set.totalPages > 1 && (
        <div style="display:flex;justify-content:center;gap:8px;margin-top:32px">
          {page > 1 && <a href={`/sets/${slug}?page=${page - 1}`} style="padding:8px 16px;background:white;border:1px solid #e5e7eb;border-radius:4px;text-decoration:none;color:inherit">Previous</a>}
          <span style="padding:8px 16px">Page {page} of {set.totalPages}</span>
          {page < set.totalPages && <a href={`/sets/${slug}?page=${page + 1}`} style="padding:8px 16px;background:white;border:1px solid #e5e7eb;border-radius:4px;text-decoration:none;color:inherit">Next</a>}
        </div>
      )}
    </Layout>
  );
});

// ── Card Detail ──

app.get('/cards/:id', async (c) => {
  const id = c.req.param('id');
  const card = await db.getCardWithListings(id);
  if (!card) return c.html(<Layout title="Not Found"><p>Card not found</p></Layout>, 404);

  const [sellers, sets, games] = await Promise.all([
    db.getSellers(),
    db.getSets(),
    db.getGames(),
  ]);
  const set = sets.find((s: any) => s.id === card.setId);
  const game = games.find((g: any) => g.id === card.gameId);
  const sellerMap = new Map(sellers.map((s: any) => [s.id, s]));

  return c.html(
    <Layout title={card.name}>
      <div style="margin-bottom:24px">
        <a href="/search" style="color:#2563eb;text-decoration:none">&larr; Back to Search</a>
      </div>

      <div style="display:grid;grid-template-columns:1fr 2fr;gap:32px">
        <div>
          <div style="background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:16px">
            <div style="aspect-ratio:3/4;background:#f3f4f6;border-radius:4px;display:flex;align-items:center;justify-content:center">
              <span style="color:#9ca3af">{card.number}</span>
            </div>
          </div>
        </div>

        <div>
          <div style="background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:24px;margin-bottom:24px">
            <h1 style="font-size:30px;font-weight:bold;margin-bottom:8px">{card.name}</h1>
            <p style="color:#4b5563;margin-bottom:16px">{game?.name} | {set?.name || card.setId} | {card.number}</p>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
              <div>
                <span style="font-size:14px;color:#6b7280">Rarity</span>
                <p style="font-weight:600">{card.rarity}</p>
              </div>
              <div>
                <span style="font-size:14px;color:#6b7280">Type</span>
                <p style="font-weight:600">{card.type}</p>
              </div>
            </div>

            {card.lowestPrice !== undefined && (
              <div style="border-top:1px solid #e5e7eb;padding-top:16px">
                <span style="font-size:14px;color:#6b7280">Starting from</span>
                <p style="font-size:24px;font-weight:bold;color:#16a34a">${card.lowestPrice.toFixed(2)}</p>
                <p style="font-size:14px;color:#6b7280">{card.listingCount} listings available</p>
              </div>
            )}
          </div>

          <div style="background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
            <div style="padding:16px;border-bottom:1px solid #e5e7eb">
              <h2 style="font-size:20px;font-weight:bold">Available Listings</h2>
            </div>
            <table style="width:100%;border-collapse:collapse">
              <thead style="background:#f9fafb">
                <tr>
                  <th style="padding:12px 16px;text-align:left;font-size:14px;font-weight:600">Seller</th>
                  <th style="padding:12px 16px;text-align:left;font-size:14px;font-weight:600">Condition</th>
                  <th style="padding:12px 16px;text-align:left;font-size:14px;font-weight:600">Language</th>
                  <th style="padding:12px 16px;text-align:right;font-size:14px;font-weight:600">Price</th>
                  <th style="padding:12px 16px;text-align:right;font-size:14px;font-weight:600">Qty</th>
                </tr>
              </thead>
              <tbody>
                {card.listings.slice(0, 20).map((listing: any) => {
                  const seller = sellerMap.get(listing.sellerId) as any;
                  return (
                    <tr style="border-top:1px solid #e5e7eb">
                      <td style="padding:12px 16px">
                        <a href={`/sellers/${seller?.slug}`} style="color:#2563eb;text-decoration:none">{seller?.name || 'Unknown'}</a>
                        {seller && <span style="font-size:12px;color:#6b7280;margin-left:8px">({seller.rating.toFixed(1)})</span>}
                      </td>
                      <td style="padding:12px 16px;font-size:14px">{listing.condition}</td>
                      <td style="padding:12px 16px;font-size:14px">{listing.language}</td>
                      <td style="padding:12px 16px;text-align:right;font-weight:600">${listing.price.toFixed(2)}</td>
                      <td style="padding:12px 16px;text-align:right;font-size:14px">{listing.quantity}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
});

// ── Search ──

app.get('/search', async (c) => {
  const q = c.req.query('q') || undefined;
  const game = c.req.query('game') || undefined;
  const sort = c.req.query('sort') || undefined;
  const order = c.req.query('order') || 'asc';
  const page = parseInt(c.req.query('page') || '1');

  const [results, games] = await Promise.all([
    db.searchCards({ q, game, sort, order, page, limit: 24 }),
    db.getGames(),
  ]);

  return c.html(
    <Layout title="Search">
      <h1 style="font-size:30px;font-weight:bold;margin-bottom:32px">Search Cards</h1>

      <div style="display:grid;grid-template-columns:1fr 3fr;gap:32px">
        <div>
          <div style="background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:16px;position:sticky;top:16px">
            <form action="/search" method="GET">
              <div style="margin-bottom:16px">
                <label style="display:block;font-size:14px;font-weight:600;margin-bottom:8px">Search</label>
                <input type="text" name="q" value={q || ''} placeholder="Card name..." style="width:100%;border:1px solid #e5e7eb;border-radius:4px;padding:8px 12px;box-sizing:border-box" />
              </div>
              <div style="margin-bottom:16px">
                <label style="display:block;font-size:14px;font-weight:600;margin-bottom:8px">Game</label>
                <select name="game" style="width:100%;border:1px solid #e5e7eb;border-radius:4px;padding:8px 12px;box-sizing:border-box">
                  <option value="">All Games</option>
                  {games.map((g: any) => (
                    <option value={g.slug} selected={g.slug === game}>{g.name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" style="width:100%;background:#2563eb;color:white;border-radius:4px;padding:8px;border:none;cursor:pointer;font-weight:600">Apply Filters</button>
            </form>
          </div>
        </div>

        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <p style="color:#4b5563">
              {results.total.toLocaleString()} results{q ? ` for "${q}"` : ''}
            </p>
          </div>

          {results.items.length === 0 ? (
            <div style="background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:32px;text-align:center">
              <p style="color:#6b7280">No cards found. Try adjusting your filters.</p>
            </div>
          ) : (
            <>
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
                {results.items.map((card: any) => (
                  <a href={`/cards/${card.id}`} style="text-decoration:none;color:inherit;background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:12px">
                    <div style="aspect-ratio:3/4;background:#f3f4f6;border-radius:4px;margin-bottom:8px;display:flex;align-items:center;justify-content:center">
                      <span style="color:#9ca3af;font-size:12px">{card.number}</span>
                    </div>
                    <h3 style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{card.name}</h3>
                    <p style="font-size:12px;color:#6b7280">{card.rarity}</p>
                    <p style="font-size:12px;color:#9ca3af">{card.type}</p>
                  </a>
                ))}
              </div>

              {results.totalPages > 1 && (
                <div style="display:flex;justify-content:center;gap:8px;margin-top:32px">
                  {page > 1 && <a href={`/search?${new URLSearchParams({ ...(q ? { q } : {}), ...(game ? { game } : {}), page: String(page - 1) }).toString()}`} style="padding:8px 16px;background:white;border:1px solid #e5e7eb;border-radius:4px;text-decoration:none;color:inherit">Previous</a>}
                  <span style="padding:8px 16px">Page {page} of {results.totalPages}</span>
                  {page < results.totalPages && <a href={`/search?${new URLSearchParams({ ...(q ? { q } : {}), ...(game ? { game } : {}), page: String(page + 1) }).toString()}`} style="padding:8px 16px;background:white;border:1px solid #e5e7eb;border-radius:4px;text-decoration:none;color:inherit">Next</a>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
});

// ── Sellers ──

app.get('/sellers', async (c) => {
  const sellers = await db.getSellers();
  const sorted = [...sellers].sort((a: any, b: any) => b.rating - a.rating);

  return c.html(
    <Layout title="Sellers">
      <h1 style="font-size:30px;font-weight:bold;margin-bottom:32px">Marketplace Sellers</h1>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px">
        {sorted.map((seller: any) => (
          <a href={`/sellers/${seller.slug}`} style="text-decoration:none;color:inherit;background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:24px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
              <div>
                <h2 style="font-size:20px;font-weight:bold">{seller.name}</h2>
                <p style="font-size:14px;color:#6b7280">{seller.location}</p>
              </div>
              <div style="text-align:right">
                <div style="display:flex;align-items:center;gap:4px">
                  <span style="color:#eab308">★</span>
                  <span style="font-weight:bold">{seller.rating.toFixed(1)}</span>
                </div>
              </div>
            </div>
            <p style="font-size:14px;color:#4b5563">{seller.salesCount.toLocaleString()} sales completed</p>
          </a>
        ))}
      </div>
    </Layout>
  );
});

// ── Seller Detail ──

app.get('/sellers/:slug', async (c) => {
  const slug = c.req.param('slug');
  const page = parseInt(c.req.query('page') || '1');
  const data = await db.getSellerWithListings(slug, page, 20);
  if (!data) return c.html(<Layout title="Not Found"><p>Seller not found</p></Layout>, 404);

  const cards = await db.findMany<any>('cards', data.listings.map((l: any) => l.cardId));
  const cardMap = new Map(cards.map((c: any) => [c.id, c]));

  return c.html(
    <Layout title={data.name}>
      <div style="margin-bottom:32px">
        <a href="/sellers" style="color:#2563eb;text-decoration:none;margin-bottom:16px;display:inline-block">&larr; Back to Sellers</a>
        <div style="background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:24px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <h1 style="font-size:30px;font-weight:bold">{data.name}</h1>
              <p style="color:#4b5563;margin-top:4px">{data.location}</p>
            </div>
            <div style="text-align:right">
              <div style="display:flex;align-items:center;gap:4px;font-size:20px">
                <span style="color:#eab308">★</span>
                <span style="font-weight:bold">{data.rating.toFixed(1)}</span>
              </div>
              <p style="font-size:14px;color:#6b7280">{data.salesCount.toLocaleString()} sales</p>
            </div>
          </div>
        </div>
      </div>

      <h2 style="font-size:24px;font-weight:bold;margin-bottom:24px">Current Listings</h2>

      <div style="background:white;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden">
        <table style="width:100%;border-collapse:collapse">
          <thead style="background:#f9fafb">
            <tr>
              <th style="padding:12px 16px;text-align:left;font-size:14px;font-weight:600">Card</th>
              <th style="padding:12px 16px;text-align:left;font-size:14px;font-weight:600">Condition</th>
              <th style="padding:12px 16px;text-align:left;font-size:14px;font-weight:600">Language</th>
              <th style="padding:12px 16px;text-align:right;font-size:14px;font-weight:600">Price</th>
              <th style="padding:12px 16px;text-align:right;font-size:14px;font-weight:600">Stock</th>
            </tr>
          </thead>
          <tbody>
            {data.listings.map((listing: any) => {
              const card = cardMap.get(listing.cardId) as any;
              return (
                <tr style="border-top:1px solid #e5e7eb">
                  <td style="padding:12px 16px">
                    <a href={`/cards/${listing.cardId}`} style="color:#2563eb;text-decoration:none">{card?.name || listing.cardId}</a>
                    <span style="font-size:12px;color:#6b7280;margin-left:8px">{card?.number}</span>
                  </td>
                  <td style="padding:12px 16px;font-size:14px">{listing.condition}</td>
                  <td style="padding:12px 16px;font-size:14px">{listing.language}</td>
                  <td style="padding:12px 16px;text-align:right;font-weight:600">${listing.price.toFixed(2)}</td>
                  <td style="padding:12px 16px;text-align:right;font-size:14px">{listing.quantity}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.totalPages > 1 && (
        <div style="display:flex;justify-content:center;gap:8px;margin-top:32px">
          {page > 1 && <a href={`/sellers/${slug}?page=${page - 1}`} style="padding:8px 16px;background:white;border:1px solid #e5e7eb;border-radius:4px;text-decoration:none;color:inherit">Previous</a>}
          <span style="padding:8px 16px">Page {page} of {data.totalPages}</span>
          {page < data.totalPages && <a href={`/sellers/${slug}?page=${page + 1}`} style="padding:8px 16px;background:white;border:1px solid #e5e7eb;border-radius:4px;text-decoration:none;color:inherit">Next</a>}
        </div>
      )}
    </Layout>
  );
});

// ── Start ──

const port = parseInt(process.env.PORT || '3000');

db.initialize().then(() => {
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Hono SSR server running on http://localhost:${port}`);
  });
});
