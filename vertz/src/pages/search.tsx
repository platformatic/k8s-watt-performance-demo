import { query, useRouter, css } from '@vertz/ui';

const s = css({
  layout: ['grid', 'gap:8'],
  sidebar: ['bg:white', 'rounded:lg', 'shadow:sm', 'p:4', 'sticky'],
  mb4: ['mb:4'],
  resultsHeader: ['flex', 'justify:between', 'items:center', 'mb:4'],
  emptyCard: ['bg:white', 'rounded:lg', 'shadow:sm', 'p:8'],
  grid: ['grid', 'grid-cols:4', 'gap:4'],
  card: ['bg:white', 'rounded:lg', 'shadow:sm', 'p:3'],
  pagination: ['flex', 'justify:center', 'gap:2', 'mt:8'],
});

export default function SearchPage() {
  const router = useRouter();
  const sp = router.current.value?.searchParams;
  const q = sp?.get('q') || undefined;
  const game = sp?.get('game') || undefined;
  const sort = sp?.get('sort') || undefined;
  const order = sp?.get('order') || 'asc';
  const page = parseInt(sp?.get('page') || '1');

  const searchQuery = query(async () => {
    const { db } = await import('../lib/db');
    return db.searchCards({ q, game, sort: sort as 'price' | 'name' | 'date' | undefined, order: order as 'asc' | 'desc', page, limit: 24 });
  }, { key: `search-${q}-${game}-${sort}-${order}-${page}` });

  const gamesQuery = query(async () => {
    const { db } = await import('../lib/db');
    return db.getGames();
  }, { key: 'search-games' });

  const results = searchQuery.data;

  return (
    <div>
      <h1 style={{ fontSize: '30px', fontWeight: 'bold', marginBottom: '32px' }}>Search Cards</h1>

      <div className={s.layout} style={{ gridTemplateColumns: '1fr 3fr' }}>
        <div>
          <div className={s.sidebar} style={{ top: '16px' }}>
            <form action="/search" method="GET">
              <div className={s.mb4}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Search</label>
                <input type="text" name="q" value={q || ''} placeholder="Card name..." style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '8px 12px', boxSizing: 'border-box' }} />
              </div>
              <div className={s.mb4}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Game</label>
                <select name="game" value={game || ''} style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '8px 12px', boxSizing: 'border-box' }}>
                  <option value="">All Games</option>
                  {gamesQuery.data?.map((g) => (
                    <option key={g.id} value={g.slug}>{g.name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" style={{ width: '100%', backgroundColor: '#2563eb', color: 'white', borderRadius: '4px', padding: '8px', border: 'none', cursor: 'pointer', fontWeight: '600' }}>Apply Filters</button>
            </form>
          </div>
        </div>

        <div>
          <div className={s.resultsHeader}>
            <p style={{ color: '#4b5563' }}>
              {results?.total.toLocaleString() || 0} results{q ? ` for "${q}"` : ''}
            </p>
          </div>

          {results && results.items.length === 0 ? (
            <div className={s.emptyCard} style={{ textAlign: 'center' }}>
              <p style={{ color: '#6b7280' }}>No cards found. Try adjusting your filters.</p>
            </div>
          ) : (
            <>
              <div className={s.grid}>
                {results?.items.map((card) => (
                  <a key={card.id} href={`/cards/${card.id}`} className={s.card} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ aspectRatio: '3/4', backgroundColor: '#f3f4f6', borderRadius: '4px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#9ca3af', fontSize: '12px' }}>{card.number}</span>
                    </div>
                    <h3 style={{ fontWeight: '600', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</h3>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>{card.rarity}</p>
                    <p style={{ fontSize: '12px', color: '#9ca3af' }}>{card.type}</p>
                  </a>
                ))}
              </div>

              {results && results.totalPages > 1 && (
                <div className={s.pagination}>
                  {results.page > 1 && <a href={`/search?${new URLSearchParams({ ...(q ? { q } : {}), ...(game ? { game } : {}), page: String(results.page - 1) }).toString()}`} style={{ padding: '8px 16px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '4px', textDecoration: 'none', color: 'inherit' }}>Previous</a>}
                  <span style={{ padding: '8px 16px' }}>Page {results.page} of {results.totalPages}</span>
                  {results.page < results.totalPages && <a href={`/search?${new URLSearchParams({ ...(q ? { q } : {}), ...(game ? { game } : {}), page: String(results.page + 1) }).toString()}`} style={{ padding: '8px 16px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '4px', textDecoration: 'none', color: 'inherit' }}>Next</a>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
