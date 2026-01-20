import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { db } from '~/lib/db'

export const Route = createFileRoute('/games/$slug')({
  loader: async ({ params }) => {
    const game = await db.getGameWithSets(params.slug)
    if (!game) {
      throw notFound()
    }
    return { game }
  },
  component: GameDetailPage,
  notFoundComponent: () => (
    <div className="text-center py-12">
      <h1 className="text-2xl font-bold mb-4">Game Not Found</h1>
      <Link to="/games" className="text-blue-600 hover:underline">
        Back to Games
      </Link>
    </div>
  ),
})

function GameDetailPage() {
  const { game } = Route.useLoaderData()

  return (
    <div>
      <div className="mb-8">
        <Link to="/games" className="text-blue-600 hover:underline mb-4 inline-block">
          &larr; Back to Games
        </Link>
        <h1 className="text-3xl font-bold">{game.name}</h1>
        <p className="text-gray-600 mt-2">{game.description}</p>
        <p className="text-sm text-gray-500 mt-1">
          {game.cardCount.toLocaleString()} total cards | {game.sets.length} sets
        </p>
      </div>

      <h2 className="text-2xl font-bold mb-6">Available Sets</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {game.sets.map((set) => (
          <Link
            key={set.id}
            to="/sets/$slug"
            params={{ slug: set.slug }}
            search={{ page: 1 }}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
          >
            <div className="aspect-video bg-gray-100 rounded mb-4 flex items-center justify-center">
              <span className="text-gray-400">{set.name.substring(0, 2)}</span>
            </div>
            <h3 className="text-lg font-bold">{set.name}</h3>
            <p className="text-sm text-gray-500">
              {set.totalCards} cards | Released {set.releaseDate}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
