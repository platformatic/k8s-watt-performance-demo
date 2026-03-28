import { query } from '@vertz/ui';

export default function SellersPage() {
  const sellersQuery = query(async () => {
    const { db } = await import('../lib/db');
    const sellers = await db.getSellers();
    return [...sellers].sort((a, b) => b.rating - a.rating);
  }, { key: 'sellers' });

  return (
    <div>
      <h1 style={{ fontSize: '30px', fontWeight: 'bold', marginBottom: '32px' }}>Marketplace Sellers</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
        {sellersQuery.data?.map((seller) => (
          <a key={seller.id} href={`/sellers/${seller.slug}`} style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
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
