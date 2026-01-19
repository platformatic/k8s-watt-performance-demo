/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import * as React from 'react'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { NotFound } from '~/components/NotFound'
import appCss from '~/styles/app.css?url'
import { seo } from '~/utils/seo'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      ...seo({
        title: 'CardMarket - Trading Card Marketplace',
        description: 'Buy and sell trading cards from Pokemon, Magic, Yu-Gi-Oh and more',
      }),
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
      },
      { rel: 'icon', href: '/favicon.ico' },
    ],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-gray-50 font-sans">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <nav className="flex items-center justify-between">
              <Link to="/" className="text-2xl font-bold text-blue-600">
                CardMarket
              </Link>
              <div className="flex items-center gap-6">
                <Link
                  to="/games"
                  className="text-gray-600 hover:text-gray-900"
                  activeProps={{ className: 'text-gray-900 font-semibold' }}
                >
                  Games
                </Link>
                <Link
                  to="/search"
                  className="text-gray-600 hover:text-gray-900"
                  activeProps={{ className: 'text-gray-900 font-semibold' }}
                >
                  Search
                </Link>
                <Link
                  to="/sellers"
                  className="text-gray-600 hover:text-gray-900"
                  activeProps={{ className: 'text-gray-900 font-semibold' }}
                >
                  Sellers
                </Link>
                <Link
                  to="/cart"
                  className="text-gray-600 hover:text-gray-900"
                  activeProps={{ className: 'text-gray-900 font-semibold' }}
                >
                  Cart
                </Link>
              </div>
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8">
          <Outlet />
        </main>
        <footer className="bg-white border-t mt-auto">
          <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-500 text-sm">
            CardMarket - Trading Card Marketplace Benchmark
          </div>
        </footer>
        <Scripts />
      </body>
    </html>
  )
}
