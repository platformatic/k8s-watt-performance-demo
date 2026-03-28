import { query, css } from '@vertz/ui';

const s = css({
  section: ['mb:12'],
  sectionHeader: ['flex', 'justify:between', 'items:center', 'mb:6'],
  grid5: ['grid', 'grid-cols:5', 'gap:4'],
  grid4: ['grid', 'grid-cols:4', 'gap:4'],
  card: ['bg:white', 'rounded:lg', 'shadow:sm', 'p:4'],
});

export default function HomePage() {
  const gamesQuery = query(async () => {
    const { db } = await import('../lib/db');
    return db.getGames();
  }, { key: 'home-games' });

  const trendingQuery = query(async () => {
    const { db } = await import('../lib/db');
    return db.getTrendingCards(8);
  }, { key: 'home-trending' });

  const releasesQuery = query(async () => {
    const { db } = await import('../lib/db');
    return db.getNewReleaseSets(4);
  }, { key: 'home-releases' });

  return (
    <div>
      <section style={{ textAlign: 'center', padding: '48px 0', background: 'linear-gradient(to right, #2563eb, #7c3aed)', borderRadius: '12px', color: 'white', marginBottom: '48px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '16px' }}>Trading Card Marketplace</h1>
        <p style={{ fontSize: '20px', opacity: 0.9, marginBottom: '24px' }}>Buy and sell cards from your favorite games</p>
        <a href="/search" style={{ display: 'inline-block', backgroundColor: 'white', color: '#2563eb', padding: '12px 24px', borderRadius: '8px', fontWeight: '600', textDecoration: 'none' }}>Start Shopping</a>
      </section>

      <section className={s.section}>
        <div className={s.sectionHeader}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>Browse by Game</h2>
          <a href="/games" style={{ color: '#2563eb', textDecoration: 'none' }}>View All</a>
        </div>
        <div className={s.grid5}>
          {gamesQuery.data?.map((game) => (
            <a key={game.id} href={`/games/${game.slug}`} className={s.card} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ aspectRatio: '1', backgroundColor: '#f3f4f6', borderRadius: '4px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '30px' }}>{game.name.charAt(0)}</span>
              </div>
              <h3 style={{ fontWeight: '600', textAlign: 'center' }}>{game.name}</h3>
              <p style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center' }}>{game.cardCount.toLocaleString()} cards</p>
            </a>
          ))}
        </div>
      </section>

      <section className={s.section}>
        <div className={s.sectionHeader}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>Trending Cards</h2>
          <a href="/search?sort=trending" style={{ color: '#2563eb', textDecoration: 'none' }}>View All</a>
        </div>
        <div className={s.grid4}>
          {trendingQuery.data?.map((card) => (
            <a key={card.id} href={`/cards/${card.id}`} className={s.card} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ aspectRatio: '3/4', backgroundColor: '#f3f4f6', borderRadius: '4px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#9ca3af', fontSize: '14px' }}>{card.number}</span>
              </div>
              <h3 style={{ fontWeight: '600', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</h3>
              <p style={{ fontSize: '12px', color: '#6b7280' }}>{card.rarity}</p>
            </a>
          ))}
        </div>
      </section>

      <section>
        <div className={s.sectionHeader}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>New Releases</h2>
          <a href="/games" style={{ color: '#2563eb', textDecoration: 'none' }}>View All Sets</a>
        </div>
        <div className={s.grid4}>
          {releasesQuery.data?.map((set) => (
            <a key={set.id} href={`/sets/${set.slug}`} className={s.card} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ aspectRatio: '16/9', backgroundColor: '#f3f4f6', borderRadius: '4px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#9ca3af' }}>{set.name.substring(0, 2)}</span>
              </div>
              <h3 style={{ fontWeight: '600' }}>{set.name}</h3>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>{set.totalCards} cards | {set.releaseDate}</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
