import { query, useParams, useRouter } from '@vertz/ui';

export default function SetDetailPage() {
  const { slug } = useParams<'/sets/:slug'>();
  const router = useRouter();
  const page = parseInt(router.current.value?.searchParams?.get('page') || '1');

  const setQuery = query(async () => {
    const { db } = await import('../lib/db');
    return db.getSetWithCards(slug, page, 24);
  }, { key: `set-${slug}-${page}` });

  const set = setQuery.data;
  if (!set) return <div>Loading...</div>;

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <a href={`/games/${set.game.slug}`} style={{ color: '#2563eb', textDecoration: 'none', marginBottom: '16px', display: 'inline-block' }}>&larr; Back to {set.game.name}</a>
        <h1 style={{ fontSize: '30px', fontWeight: 'bold' }}>{set.name}</h1>
        <p style={{ color: '#4b5563', marginTop: '8px' }}>{set.game.name} | {set.totalCards} cards | Released {set.releaseDate}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px' }}>
        {set.cards.map((card) => (
          <a key={card.id} href={`/cards/${card.id}`} style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '12px', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ aspectRatio: '3/4', backgroundColor: '#f3f4f6', borderRadius: '4px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#9ca3af', fontSize: '12px' }}>{card.number}</span>
            </div>
            <h3 style={{ fontWeight: '600', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</h3>
            <p style={{ fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.rarity}</p>
          </a>
        ))}
      </div>

      {set.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '32px' }}>
          {page > 1 && <a href={`/sets/${slug}?page=${page - 1}`} style={{ padding: '8px 16px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '4px', textDecoration: 'none', color: 'inherit' }}>Previous</a>}
          <span style={{ padding: '8px 16px' }}>Page {page} of {set.totalPages}</span>
          {page < set.totalPages && <a href={`/sets/${slug}?page=${page + 1}`} style={{ padding: '8px 16px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '4px', textDecoration: 'none', color: 'inherit' }}>Next</a>}
        </div>
      )}
    </div>
  );
}
