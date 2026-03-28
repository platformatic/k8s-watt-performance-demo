import { RouterView, createRouter, getInjectedCSS } from '@vertz/ui';
import { routes } from './router';
import { appTheme, themeGlobals } from './styles/theme';

export { getInjectedCSS };
export const theme = appTheme;
export const styles = [themeGlobals.css];

const router = createRouter(routes);

export function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '16px 0' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <a href="/" style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb', textDecoration: 'none' }}>CardMarket</a>
          <nav style={{ display: 'flex', gap: '24px' }}>
            <a href="/games" style={{ color: '#4b5563', textDecoration: 'none' }}>Games</a>
            <a href="/search" style={{ color: '#4b5563', textDecoration: 'none' }}>Search</a>
            <a href="/sellers" style={{ color: '#4b5563', textDecoration: 'none' }}>Sellers</a>
            <a href="/cart" style={{ color: '#4b5563', textDecoration: 'none' }}>Cart</a>
          </nav>
        </div>
      </header>
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 16px', flex: '1' }}>
        <RouterView router={router} />
      </main>
      <footer style={{ backgroundColor: 'white', borderTop: '1px solid #e5e7eb', padding: '24px 16px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
        CardMarket - Trading Card Marketplace Benchmark
      </footer>
    </div>
  );
}
