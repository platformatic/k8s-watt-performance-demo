import { query, useParams, css } from '@vertz/ui';

const s = css({
  header: ['mb:8'],
  grid: ['grid', 'grid-cols:3', 'gap:6'],
  card: ['bg:white', 'rounded:lg', 'shadow:sm', 'p:6'],
});

export default function GameDetailPage() {
  const { slug } = useParams<'/games/:slug'>();

  const gameQuery = query(async () => {
    const { db } = await import('../lib/db');
    return db.getGameWithSets(slug);
  }, { key: `game-${slug}` });

  const game = gameQuery.data;
  if (!game) return <div>Loading...</div>;

  return (
    <div>
      <div className={s.header}>
        <a href="/games" style={{ color: '#2563eb', textDecoration: 'none', marginBottom: '16px', display: 'inline-block' }}>&larr; Back to Games</a>
        <h1 style={{ fontSize: '30px', fontWeight: 'bold' }}>{game.name}</h1>
        <p style={{ color: '#4b5563', marginTop: '8px' }}>{game.description}</p>
        <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>{game.cardCount.toLocaleString()} total cards | {game.sets.length} sets</p>
      </div>

      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>Available Sets</h2>
      <div className={s.grid}>
        {game.sets.map((set) => (
          <a key={set.id} href={`/sets/${set.slug}`} className={s.card} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ aspectRatio: '16/9', backgroundColor: '#f3f4f6', borderRadius: '4px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#9ca3af' }}>{set.name.substring(0, 2)}</span>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>{set.name}</h3>
            <p style={{ fontSize: '14px', color: '#6b7280' }}>{set.totalCards} cards | Released {set.releaseDate}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
