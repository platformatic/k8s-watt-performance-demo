import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { db } from '~/lib/db'

export const Route = createFileRoute('/sellers/$slug')({
  validateSearch: (search: Record<string, unknown>) => ({
    page: Number(search?.page) || 1,
  }),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ params, deps }) => {
    const page = deps?.page || 1
    const seller = await db.getSellerWithListings(params.slug, page, 20)
    if (!seller) {
      throw notFound()
    }
    const cards = await db.findMany<{ id: string; name: string; number: string }>(
      'cards',
      seller.listings.map((l) => l.cardId)
    )
    return { seller, cards, page }
  },
  component: SellerDetailPage,
  notFoundComponent: () => (
    <div className="text-center py-12">
      <h1 className="text-2xl font-bold mb-4">Seller Not Found</h1>
      <Link to="/sellers" className="text-blue-600 hover:underline">
        Back to Sellers
      </Link>
    </div>
  ),
})

function SellerDetailPage() {
  const { seller, cards, page } = Route.useLoaderData()
  const cardMap = new Map(cards.map((c) => [c.id, c]))

  return (
    <div>
      <div className="mb-8">
        <Link to="/sellers" className="text-blue-600 hover:underline mb-4 inline-block">
          &larr; Back to Sellers
        </Link>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">{seller.name}</h1>
              <p className="text-gray-600 mt-1">{seller.location}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-xl">
                <span className="text-yellow-500">&#9733;</span>
                <span className="font-bold">{seller.rating.toFixed(1)}</span>
              </div>
              <p className="text-sm text-gray-500">
                {seller.salesCount.toLocaleString()} sales
              </p>
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-6">Current Listings</h2>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Card</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Condition</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Language</th>
              <th className="px-4 py-3 text-right text-sm font-semibold">Price</th>
              <th className="px-4 py-3 text-right text-sm font-semibold">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {seller.listings.map((listing) => {
              const card = cardMap.get(listing.cardId)
              return (
                <tr key={listing.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      to="/cards/$id"
                      params={{ id: listing.cardId }}
                      className="text-blue-600 hover:underline"
                    >
                      {card?.name || listing.cardId}
                    </Link>
                    <span className="text-xs text-gray-500 ml-2">
                      {card?.number}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-sm ${
                        listing.condition === 'Near Mint'
                          ? 'text-green-600'
                          : listing.condition === 'Lightly Played'
                          ? 'text-yellow-600'
                          : 'text-orange-600'
                      }`}
                    >
                      {listing.condition}
                    </span>
                    {listing.isFoil && (
                      <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1 rounded">
                        Foil
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{listing.language}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    ${listing.price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">{listing.quantity}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {seller.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {page > 1 && (
            <Link
              to="/sellers/$slug"
              params={{ slug: seller.slug }}
              search={{ page: page - 1 }}
              className="px-4 py-2 bg-white border rounded hover:bg-gray-50"
            >
              Previous
            </Link>
          )}
          <span className="px-4 py-2">
            Page {page} of {seller.totalPages}
          </span>
          {page < seller.totalPages && (
            <Link
              to="/sellers/$slug"
              params={{ slug: seller.slug }}
              search={{ page: page + 1 }}
              className="px-4 py-2 bg-white border rounded hover:bg-gray-50"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
