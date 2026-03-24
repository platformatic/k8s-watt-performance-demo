import { query, useParams } from '@vertz/ui';

export default function CardDetailPage() {
  const { id } = useParams<'/cards/:id'>();

  const cardQuery = query(async () => {
    const { db } = await import('../lib/db');
    const card = await db.getCardWithListings(id);
    if (!card) return null;
    const sellers = await db.getSellers();
    const sets = await db.getSets();
    const games = await db.getGames();
    const set = sets.find((s) => s.id === card.setId);
    const game = games.find((g) => g.id === card.gameId);
    return { ...card, sellers, set, game };
  }, { key: `card-${id}` });

  const data = cardQuery.data;
  if (!data) return <div>Loading...</div>;

  const sellerMap = new Map(data.sellers.map((s) => [s.id, s]));

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <a href="/search" style={{ color: '#2563eb', textDecoration: 'none' }}>← Back to Search</a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px' }}>
        <div>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '16px' }}>
            <div style={{ aspectRatio: '3/4', backgroundColor: '#f3f4f6', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#9ca3af' }}>{data.number}</span>
            </div>
          </div>
        </div>

        <div>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '30px', fontWeight: 'bold', marginBottom: '8px' }}>{data.name}</h1>
            <p style={{ color: '#4b5563', marginBottom: '16px' }}>{data.game?.name} | {data.set?.name || data.setId} | {data.number}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Rarity</span>
                <p style={{ fontWeight: '600' }}>{data.rarity}</p>
              </div>
              <div>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Type</span>
                <p style={{ fontWeight: '600' }}>{data.type}</p>
              </div>
            </div>

            {data.lowestPrice !== undefined && (
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Starting from</span>
                <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>${data.lowestPrice.toFixed(2)}</p>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>{data.listingCount} listings available</p>
              </div>
            )}
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Available Listings</h2>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Seller</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Condition</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Language</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px', fontWeight: '600' }}>Price</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px', fontWeight: '600' }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {data.listings.slice(0, 20).map((listing) => {
                  const seller = sellerMap.get(listing.sellerId);
                  return (
                    <tr key={listing.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <a href={`/sellers/${seller?.slug}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{seller?.name || 'Unknown'}</a>
                        {seller && <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>({seller.rating.toFixed(1)})</span>}
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
        </div>
      </div>
    </div>
  );
}
