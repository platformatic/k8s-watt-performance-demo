import { RouterView, createRouter, getInjectedCSS, css } from '@vertz/ui';
import { routes } from './router';
import { appTheme, themeGlobals } from './styles/theme';

export { getInjectedCSS };
export const theme = appTheme;
export const styles = [themeGlobals.css];

const router = createRouter(routes);

const s = css({
  root: ['min-h:screen', 'flex', 'flex-col'],
  header: ['bg:white', 'py:4'],
  headerInner: ['max-w:7xl', 'mx:auto', 'px:4', 'flex', 'justify:between', 'items:center'],
  nav: ['flex', 'gap:6'],
  main: ['max-w:7xl', 'w:full', 'mx:auto', 'px:4', 'py:8', 'flex-1'],
  footer: ['bg:white', 'py:6', 'px:4', 'font:sm'],
});

export function App() {
  return (
    <div className={s.root}>
      <header className={s.header} style={{ borderBottom: '1px solid #e5e7eb' }}>
        <div className={s.headerInner}>
          <a href="/" style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb', textDecoration: 'none' }}>CardMarket</a>
          <nav className={s.nav}>
            <a href="/games" style={{ color: '#4b5563', textDecoration: 'none' }}>Games</a>
            <a href="/search" style={{ color: '#4b5563', textDecoration: 'none' }}>Search</a>
            <a href="/sellers" style={{ color: '#4b5563', textDecoration: 'none' }}>Sellers</a>
            <a href="/cart" style={{ color: '#4b5563', textDecoration: 'none' }}>Cart</a>
          </nav>
        </div>
      </header>
      <main className={s.main}>
        <RouterView router={router} />
      </main>
      <footer className={s.footer} style={{ borderTop: '1px solid #e5e7eb', textAlign: 'center', color: '#6b7280' }}>
        CardMarket - Trading Card Marketplace Benchmark
      </footer>
    </div>
  );
}
