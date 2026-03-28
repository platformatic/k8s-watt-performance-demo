import { defineRoutes } from '@vertz/ui';
import HomePage from './pages/home';
import GamesPage from './pages/games';
import GameDetailPage from './pages/game-detail';
import SetDetailPage from './pages/set-detail';
import CardDetailPage from './pages/card-detail';
import SearchPage from './pages/search';
import SellersPage from './pages/sellers';
import SellerDetailPage from './pages/seller-detail';
import CartPage from './pages/cart';

export const routes = defineRoutes({
  '/': {
    component: () => <HomePage />,
  },
  '/games': {
    component: () => <GamesPage />,
  },
  '/games/:slug': {
    component: () => <GameDetailPage />,
  },
  '/sets/:slug': {
    component: () => <SetDetailPage />,
  },
  '/cards/:id': {
    component: () => <CardDetailPage />,
  },
  '/search': {
    component: () => <SearchPage />,
  },
  '/sellers': {
    component: () => <SellersPage />,
  },
  '/sellers/:slug': {
    component: () => <SellerDetailPage />,
  },
  '/cart': {
    component: () => <CartPage />,
  },
});
