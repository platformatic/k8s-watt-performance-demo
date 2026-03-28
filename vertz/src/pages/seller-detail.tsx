import { query, useParams, useRouter, css } from '@vertz/ui';

const s = css({
  header: ['mb:8'],
  infoCard: ['bg:white', 'rounded:lg', 'shadow:sm', 'p:6'],
  infoHeader: ['flex', 'justify:between', 'items:start'],
  tableCard: ['bg:white', 'rounded:lg', 'shadow:sm', 'overflow:hidden'],
  table: ['w:full'],
  pagination: ['flex', 'justify:center', 'gap:2', 'mt:8'],
});

export default function SellerDetailPage() {
  const { slug } = useParams<'/sellers/:slug'>();
  const router = useRouter();
  const page = parseInt(router.current.value?.searchParams?.get('page') || '1');

  const sellerQuery = query(async () => {
    const { db } = await import('../lib/db');
    const seller = await db.getSellerWithListings(slug, page, 20);
    if (!seller) return null;
    const cards = await db.findMany<{ id: string; name: string; number: string }>('cards', seller.listings.map((l) => l.cardId));
    return { ...seller, cards };
  }, { key: `seller-${slug}-${page}` });

  const data = sellerQuery.data;
  if (!data) return <div>Loading...</div>;

  const cardMap = new Map(data.cards.map((c) => [c.id, c]));

  return (
    <div>
      <div className={s.header}>
        <a href="/sellers" style={{ color: '#2563eb', textDecoration: 'none', marginBottom: '16px', display: 'inline-block' }}>&larr; Back to Sellers</a>
        <div className={s.infoCard}>
          <div className={s.infoHeader}>
            <div>
              <h1 style={{ fontSize: '30px', fontWeight: 'bold' }}>{data.name}</h1>
              <p style={{ color: '#4b5563', marginTop: '4px' }}>{data.location}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '20px' }}>
                <span style={{ color: '#eab308' }}>★</span>
                <span style={{ fontWeight: 'bold' }}>{data.rating.toFixed(1)}</span>
              </div>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>{data.salesCount.toLocaleString()} sales</p>
            </div>
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>Current Listings</h2>

      <div className={s.tableCard}>
        <table className={s.table} style={{ borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#f9fafb' }}>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Card</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Condition</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Language</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px', fontWeight: '600' }}>Price</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px', fontWeight: '600' }}>Stock</th>
            </tr>
          </thead>
          <tbody>
            {data.listings.map((listing) => {
              const card = cardMap.get(listing.cardId);
              return (
                <tr key={listing.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <a href={`/cards/${listing.cardId}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{card?.name || listing.cardId}</a>
                    <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>{card?.number}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '14px' }}>{listing.condition}</td>
                  <td style={{ padding: '12px 16px', fontSize: '14px' }}>{listing.language}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }}>${listing.price.toFixed(2)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px' }}>{listing.quantity}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.totalPages > 1 && (
        <div className={s.pagination}>
          {page > 1 && <a href={`/sellers/${slug}?page=${page - 1}`} style={{ padding: '8px 16px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '4px', textDecoration: 'none', color: 'inherit' }}>Previous</a>}
          <span style={{ padding: '8px 16px' }}>Page {page} of {data.totalPages}</span>
          {page < data.totalPages && <a href={`/sellers/${slug}?page=${page + 1}`} style={{ padding: '8px 16px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '4px', textDecoration: 'none', color: 'inherit' }}>Next</a>}
        </div>
      )}
    </div>
  );
}
