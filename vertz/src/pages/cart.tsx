import { css } from '@vertz/ui';

const s = css({
  card: ['bg:white', 'rounded:lg', 'shadow:sm', 'p:8'],
});

export default function CartPage() {
  return (
    <div>
      <h1 style={{ fontSize: '30px', fontWeight: 'bold', marginBottom: '32px' }}>Shopping Cart</h1>
      <div className={s.card} style={{ textAlign: 'center' }}>
        <div style={{ color: '#9ca3af', fontSize: '60px', marginBottom: '16px' }}>&#128722;</div>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Your cart is empty</h2>
        <p style={{ color: '#6b7280', marginBottom: '24px' }}>Start browsing and add some cards to your cart!</p>
        <a href="/search" style={{ display: 'inline-block', backgroundColor: '#2563eb', color: 'white', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none' }}>Browse Cards</a>
      </div>
    </div>
  );
}
