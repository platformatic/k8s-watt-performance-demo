import { query, css } from '@vertz/ui';

const s = css({
  grid: ['grid', 'grid-cols:3', 'gap:6'],
  card: ['bg:white', 'rounded:lg', 'shadow:sm', 'p:6'],
  cardHeader: ['flex', 'justify:between', 'items:start', 'mb:4'],
});

export default function SellersPage() {
  const sellersQuery = query(async () => {
    const { db } = await import('../lib/db');
    const sellers = await db.getSellers();
    return [...sellers].sort((a, b) => b.rating - a.rating);
  }, { key: 'sellers' });

  return (
    <div>
      <h1 style={{ fontSize: '30px', fontWeight: 'bold', marginBottom: '32px' }}>Marketplace Sellers</h1>
      <div className={s.grid}>
        {sellersQuery.data?.map((seller) => (
          <a key={seller.id} href={`/sellers/${seller.slug}`} className={s.card} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className={s.cardHeader}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>{seller.name}</h2>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>{seller.location}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: '#eab308' }}>★</span>
                  <span style={{ fontWeight: 'bold' }}>{seller.rating.toFixed(1)}</span>
                </div>
              </div>
            </div>
            <p style={{ fontSize: '14px', color: '#4b5563' }}>{seller.salesCount.toLocaleString()} sales completed</p>
          </a>
        ))}
      </div>
    </div>
  );
}
