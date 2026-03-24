import { defineRoutes } from '@vertz/ui';

export const routes = defineRoutes({
  '/': {
    component: () => import('./pages/home'),
  },
  '/games': {
    component: () => import('./pages/games'),
  },
  '/games/:slug': {
    component: () => import('./pages/game-detail'),
  },
  '/sets/:slug': {
    component: () => import('./pages/set-detail'),
  },
  '/cards/:id': {
    component: () => import('./pages/card-detail'),
  },
  '/search': {
    component: () => import('./pages/search'),
  },
  '/sellers': {
    component: () => import('./pages/sellers'),
  },
  '/sellers/:slug': {
    component: () => import('./pages/seller-detail'),
  },
  '/cart': {
    component: () => import('./pages/cart'),
  },
});
