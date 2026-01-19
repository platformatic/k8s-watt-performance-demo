import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { db } from '~/lib/db'
import type { CardSearchParams } from '~/lib/types'

export const Route = createFileRoute('/search')({
  validateSearch: (search: Record<string, unknown>): CardSearchParams => ({
    q: search.q as string | undefined,
    game: search.game as string | undefined,
    set: search.set as string | undefined,
    rarity: search.rarity as string | undefined,
    page: Number(search.page) || 1,
    limit: 24,
    sort: search.sort as CardSearchParams['sort'],
    order: (search.order as CardSearchParams['order']) || 'asc',
    minPrice: search.minPrice ? Number(search.minPrice) : undefined,
    maxPrice: search.maxPrice ? Number(search.maxPrice) : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [results, games] = await Promise.all([
      db.searchCards(deps),
      db.getGames(),
    ])
    return { results, games, searchConfig: deps }
  },
  component: SearchPage,
})

function SearchPage() {
  const { results, games, searchConfig } = Route.useLoaderData()
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    navigate({
      to: '/search',
      search: {
        q: formData.get('q') as string || undefined,
        game: formData.get('game') as string || undefined,
        sort: formData.get('sort') as CardSearchParams['sort'] || undefined,
        page: 1,
      },
    })
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Search Cards</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4 sticky top-4">
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Search</label>
                <input
                  type="text"
                  name="q"
                  defaultValue={searchConfig.q}
                  placeholder="Card name..."
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Game</label>
                <select
                  name="game"
                  defaultValue={searchConfig.game}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">All Games</option>
                  {games.map((game) => (
                    <option key={game.id} value={game.slug}>
                      {game.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Sort By</label>
                <select
                  name="sort"
                  defaultValue={searchConfig.sort}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Relevance</option>
                  <option value="name">Name</option>
                  <option value="price">Price</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white rounded py-2 hover:bg-blue-700"
              >
                Apply Filters
              </button>
            </form>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-3">
          <div className="flex justify-between items-center mb-4">
            <p className="text-gray-600">
              {results.total.toLocaleString()} results
              {searchConfig.q && ` for "${searchConfig.q}"`}
            </p>
            <div className="flex gap-2">
              <Link
                to="/search"
                search={{ ...searchConfig, order: 'asc', page: 1 }}
                className={`px-3 py-1 text-sm rounded ${
                  searchConfig.order !== 'desc' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'
                }`}
              >
                Asc
              </Link>
              <Link
                to="/search"
                search={{ ...searchConfig, order: 'desc', page: 1 }}
                className={`px-3 py-1 text-sm rounded ${
                  searchConfig.order === 'desc' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'
                }`}
              >
                Desc
              </Link>
            </div>
          </div>

          {results.items.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">No cards found. Try adjusting your filters.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {results.items.map((card) => (
                  <Link
                    key={card.id}
                    to="/cards/$id"
                    params={{ id: card.id }}
                    className="bg-white rounded-lg shadow p-3 hover:shadow-md transition"
                  >
                    <div className="aspect-[3/4] bg-gray-100 rounded mb-2 flex items-center justify-center">
                      <span className="text-gray-400 text-xs">{card.number}</span>
                    </div>
                    <h3 className="font-semibold text-sm truncate">{card.name}</h3>
                    <p className="text-xs text-gray-500">{card.rarity}</p>
                    <p className="text-xs text-gray-400">{card.type}</p>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {results.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  {results.page > 1 && (
                    <Link
                      to="/search"
                      search={{ ...searchConfig, page: results.page - 1 }}
                      className="px-4 py-2 bg-white border rounded hover:bg-gray-50"
                    >
                      Previous
                    </Link>
                  )}
                  <span className="px-4 py-2">
                    Page {results.page} of {results.totalPages}
                  </span>
                  {results.page < results.totalPages && (
                    <Link
                      to="/search"
                      search={{ ...searchConfig, page: results.page + 1 }}
                      className="px-4 py-2 bg-white border rounded hover:bg-gray-50"
                    >
                      Next
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
