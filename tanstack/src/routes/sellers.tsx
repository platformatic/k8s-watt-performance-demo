import { createFileRoute, Link, Outlet, useMatch } from '@tanstack/react-router'
import { db } from '~/lib/db'

export const Route = createFileRoute('/sellers')({
  loader: async () => {
    const sellers = await db.getSellers()
    const sortedSellers = [...sellers].sort((a, b) => b.rating - a.rating)
    return { sellers: sortedSellers }
  },
  component: SellersLayout,
})

function SellersLayout() {
  // Check if we're on a child route (sellers/$slug)
  const childMatch = useMatch({ from: '/sellers/$slug', shouldThrow: false })

  // If there's a child match, render the Outlet (child route)
  if (childMatch) {
    return <Outlet />
  }

  // Otherwise render the sellers list
  return <SellersListPage />
}

function SellersListPage() {
  const { sellers } = Route.useLoaderData()

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Marketplace Sellers</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sellers.map((seller) => (
          <Link
            key={seller.id}
            to="/sellers/$slug"
            params={{ slug: seller.slug }}
            search={{ page: 1 }}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">{seller.name}</h2>
                <p className="text-sm text-gray-500">{seller.location}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1">
                  <span className="text-yellow-500">&#9733;</span>
                  <span className="font-bold">{seller.rating.toFixed(1)}</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              {seller.salesCount.toLocaleString()} sales completed
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
