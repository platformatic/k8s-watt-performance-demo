import { query } from '@vertz/ui';

export default function GamesPage() {
  const gamesQuery = query(async () => {
    const { db } = await import('../lib/db');
    return db.getGames();
  }, { key: 'games' });

  return (
    <div>
      <h1 style={{ fontSize: '30px', fontWeight: 'bold', marginBottom: '32px' }}>All Games</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
        {gamesQuery.data?.map((game) => (
          <a key={game.id} href={`/games/${game.slug}`} style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ aspectRatio: '16/9', backgroundColor: '#f3f4f6', borderRadius: '4px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '48px', fontWeight: 'bold', color: '#d1d5db' }}>{game.name.charAt(0)}</span>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{game.name}</h2>
            <p style={{ color: '#4b5563', marginBottom: '16px' }}>{game.description}</p>
            <p style={{ fontSize: '14px', color: '#2563eb' }}>{game.cardCount.toLocaleString()} cards available</p>
          </a>
        ))}
      </div>
    </div>
  );
}
