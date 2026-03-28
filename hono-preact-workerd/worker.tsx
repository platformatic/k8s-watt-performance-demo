/** @jsxImportSource preact */
import { Hono } from 'hono';
import { h } from 'preact';
import renderToString from 'preact-render-to-string';

// ── Inline DB (data injected at build time via define) ──

declare const __INLINE_GAMES__: any[];
declare const __INLINE_SETS__: any[];
declare const __INLINE_CARDS__: any[];
declare const __INLINE_SELLERS__: any[];
declare const __INLINE_LISTINGS__: any[];
declare const __INLINE_FEATURED__: any;

const GAMES: any[] = __INLINE_GAMES__;
const SETS: any[] = __INLINE_SETS__;
const CARDS: any[] = __INLINE_CARDS__;
const SELLERS: any[] = __INLINE_SELLERS__;
const LISTINGS: any[] = __INLINE_LISTINGS__;
const FEATURED: any = __INLINE_FEATURED__;

// ── Data access functions ──

async function getGames() { return GAMES; }
async function getGameWithSets(slug: string) {
  const game = GAMES.find((g: any) => g.slug === slug);
  if (!game) return undefined;
  const sets = SETS.filter((s: any) => s.gameId === game.id);
  return { ...game, sets };
}
async function getCardWithListings(id: string) {
  const card = CARDS.find((c: any) => c.id === id);
  if (!card) return undefined;
  const listings = LISTINGS.filter((l: any) => l.cardId === id);
  const lowestPrice = listings.length > 0 ? Math.min(...listings.map((l: any) => l.price)) : undefined;
  return { ...card, listings, lowestPrice, listingCount: listings.length };
}
async function getSellers() { return SELLERS; }
async function getTrendingCards(limit = 10) {
  if (!FEATURED) return [];
  const trendingIds = FEATURED.trendingCards.slice(0, limit);
  return CARDS.filter((c: any) => trendingIds.includes(c.id));
}
async function getNewReleaseSets(limit = 5) {
  if (!FEATURED) return [];
  const releaseIds = FEATURED.newReleases.slice(0, limit);
  return SETS.filter((s: any) => releaseIds.includes(s.id));
}

// ── Preact Components (SSR with hydration) ──

function Layout({ title, ssrData, children }: { title: string; ssrData?: unknown; children?: any }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title} - Card Marketplace</title>
        <style dangerouslySetInnerHTML={{ __html: `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; color: #111827; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
    nav { background: white; border-bottom: 1px solid #e5e7eb; padding: 16px 0; margin-bottom: 32px; }
    nav .inner { display: flex; align-items: center; gap: 24px; }
    nav a { text-decoration: none; color: #4b5563; font-weight: 500; }
    nav a.brand { font-weight: bold; font-size: 20px; color: #111827; }
    .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    footer { margin-top: 64px; padding: 32px 0; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 14px; }
        ` }} />
      </head>
      <body>
        <nav>
          <div class="container inner">
            <a href="/" class="brand">CardMarket</a>
            <a href="/games">Games</a>
            <a href="/search">Search</a>
            <a href="/sellers">Sellers</a>
            <a href="/cart">Cart</a>
          </div>
        </nav>
        <main class="container">
          {children}
        </main>
        <footer>
          <div class="container">
            <p>&copy; 2024 Card Marketplace. All rights reserved.</p>
          </div>
        </footer>
        {ssrData !== undefined && (
          <script dangerouslySetInnerHTML={{
            __html: `window.__SSR_DATA__=${JSON.stringify(ssrData)}`
          }} />
        )}
        <script type="module" src="/assets/client.js"></script>
      </body>
    </html>
  );
}

function HomePage({ games, trending, releases }: { games: any[]; trending: any[]; releases: any[] }) {
  return (
    <Layout title="Home" ssrData={{ games, trending, releases }}>
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
            <a href={`/games/${game.slug}`} class="card" style="text-decoration:none;color:inherit;padding:16px">
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
            <a href={`/cards/${card.id}`} class="card" style="text-decoration:none;color:inherit;padding:16px">
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
            <a href={`/sets/${set.slug}`} class="card" style="text-decoration:none;color:inherit;padding:16px">
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
}

function GamesPage({ games }: { games: any[] }) {
  return (
    <Layout title="Games" ssrData={{ games }}>
      <h1 style="font-size:30px;font-weight:bold;margin-bottom:32px">All Games</h1>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px">
        {games.map((game: any) => (
          <a href={`/games/${game.slug}`} class="card" style="text-decoration:none;color:inherit;padding:24px">
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
}

function GameDetailPage({ game }: { game: any }) {
  return (
    <Layout title={game.name} ssrData={{ game }}>
      <div style="margin-bottom:32px">
        <a href="/games" style="color:#2563eb;text-decoration:none;font-size:14px">&larr; Back to Games</a>
      </div>
      <div style="display:flex;gap:32px;margin-bottom:48px">
        <div style="width:200px;height:200px;background:#f3f4f6;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <span style="font-size:64px;font-weight:bold;color:#d1d5db">{game.name.charAt(0)}</span>
        </div>
        <div>
          <h1 style="font-size:30px;font-weight:bold;margin-bottom:8px">{game.name}</h1>
          <p style="color:#4b5563;margin-bottom:16px">{game.description}</p>
          <p style="font-size:14px;color:#6b7280">{game.cardCount.toLocaleString()} cards &middot; {game.sets?.length || 0} sets</p>
        </div>
      </div>
      {game.sets && game.sets.length > 0 && (
        <section>
          <h2 style="font-size:24px;font-weight:bold;margin-bottom:24px">Sets</h2>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
            {game.sets.map((set: any) => (
              <a href={`/sets/${set.slug}`} class="card" style="text-decoration:none;color:inherit;padding:20px">
                <h3 style="font-weight:600;margin-bottom:4px">{set.name}</h3>
                <p style="font-size:14px;color:#6b7280">{set.totalCards} cards &middot; {set.releaseDate}</p>
              </a>
            ))}
          </div>
        </section>
      )}
    </Layout>
  );
}

function CardDetailPage({ card }: { card: any }) {
  return (
    <Layout title={card.name} ssrData={{ card }}>
      <div style="margin-bottom:32px">
        <a href="/games" style="color:#2563eb;text-decoration:none;font-size:14px">&larr; Back</a>
      </div>
      <div style="display:flex;gap:32px;margin-bottom:48px">
        <div style="width:300px;aspect-ratio:3/4;background:#f3f4f6;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <span style="color:#9ca3af;font-size:24px">{card.number}</span>
        </div>
        <div style="flex:1">
          <h1 style="font-size:30px;font-weight:bold;margin-bottom:8px">{card.name}</h1>
          <p style="color:#6b7280;margin-bottom:16px">{card.rarity} &middot; #{card.number}</p>
          {card.lowestPrice !== undefined && (
            <div class="card" style="padding:16px;margin-bottom:24px">
              <p style="font-size:14px;color:#6b7280;margin-bottom:4px">Starting from</p>
              <p style="font-size:28px;font-weight:bold;color:#059669">${card.lowestPrice.toFixed(2)}</p>
              <p style="font-size:12px;color:#9ca3af">{card.listingCount} listings available</p>
            </div>
          )}
          {card.listings && card.listings.length > 0 && (
            <section>
              <h2 style="font-size:18px;font-weight:bold;margin-bottom:16px">Available Listings</h2>
              <div style="display:flex;flex-direction:column;gap:8px">
                {card.listings.slice(0, 5).map((listing: any) => (
                  <div class="card" style="padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
                    <div>
                      <p style="font-weight:500">{listing.condition}</p>
                      <p style="font-size:12px;color:#6b7280">Seller #{listing.sellerId.slice(0, 8)}</p>
                    </div>
                    <div style="text-align:right">
                      <p style="font-weight:bold;color:#059669">${listing.price.toFixed(2)}</p>
                      <button style="background:#2563eb;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px">Add to Cart</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </Layout>
  );
}

function SellersPage({ sellers }: { sellers: any[] }) {
  return (
    <Layout title="Sellers" ssrData={{ sellers }}>
      <h1 style="font-size:30px;font-weight:bold;margin-bottom:32px">Marketplace Sellers</h1>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px">
        {sellers.map((seller: any) => (
          <a href={`/sellers/${seller.slug}`} class="card" style="text-decoration:none;color:inherit;padding:24px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
              <div>
                <h2 style="font-size:20px;font-weight:bold">{seller.name}</h2>
                <p style="font-size:14px;color:#6b7280">{seller.location}</p>
              </div>
              <div style="text-align:right;display:flex;align-items:center;gap:4px">
                <span style="color:#eab308">&#9733;</span>
                <span style="font-weight:bold">{seller.rating.toFixed(1)}</span>
              </div>
            </div>
            <p style="font-size:14px;color:#4b5563">{seller.salesCount.toLocaleString()} sales completed</p>
          </a>
        ))}
      </div>
    </Layout>
  );
}

function CartPage() {
  return (
    <Layout title="Cart" ssrData={{ items: [] }}>
      <h1 style="font-size:30px;font-weight:bold;margin-bottom:32px">Shopping Cart</h1>
      <div class="card" style="padding:32px;text-align:center">
        <div style="color:#9ca3af;font-size:60px;margin-bottom:16px">&#128722;</div>
        <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">Your cart is empty</h2>
        <p style="color:#6b7280;margin-bottom:24px">Start browsing and add some cards to your cart!</p>
        <a href="/search" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none">Browse Cards</a>
      </div>
    </Layout>
  );
}

// ── Hono app with Preact SSR ──

const app = new Hono();

function render(vnode: any): Response {
  const html = '<!DOCTYPE html>' + renderToString(vnode);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

app.get('/', async (c) => {
  const [games, trending, releases] = await Promise.all([
    getGames(), getTrendingCards(8), getNewReleaseSets(4),
  ]);
  return render(<HomePage games={games} trending={trending} releases={releases} />);
});

app.get('/games', async (c) => {
  const games = await getGames();
  return render(<GamesPage games={games} />);
});

app.get('/games/:slug', async (c) => {
  const game = await getGameWithSets(c.req.param('slug'));
  if (!game) return c.notFound();
  return render(<GameDetailPage game={game} />);
});

app.get('/cards/:id', async (c) => {
  const card = await getCardWithListings(c.req.param('id'));
  if (!card) return c.notFound();
  return render(<CardDetailPage card={card} />);
});

app.get('/sellers', async (c) => {
  const sellers = await getSellers();
  const sorted = [...sellers].sort((a: any, b: any) => b.rating - a.rating);
  return render(<SellersPage sellers={sorted} />);
});

app.get('/cart', (c) => {
  return render(<CartPage />);
});

export default app;
