import { createFileRoute, Link, Outlet, useMatch } from '@tanstack/react-router'
import { db } from '~/lib/db'

export const Route = createFileRoute('/games')({
  loader: async () => {
    const games = await db.getGames()
    return { games }
  },
  component: GamesLayout,
})

function GamesLayout() {
  // Check if we're on a child route (games/$slug)
  const childMatch = useMatch({ from: '/games/$slug', shouldThrow: false })

  // If there's a child match, render the Outlet (child route)
  if (childMatch) {
    return <Outlet />
  }

  // Otherwise render the games list
  return <GamesListPage />
}

function GamesListPage() {
  const { games } = Route.useLoaderData()

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">All Games</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {games.map((game) => (
          <Link
            key={game.id}
            to="/games/$slug"
            params={{ slug: game.slug }}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
          >
            <div className="aspect-video bg-gray-100 rounded mb-4 flex items-center justify-center">
              <span className="text-5xl font-bold text-gray-300">
                {game.name.charAt(0)}
              </span>
            </div>
            <h2 className="text-xl font-bold mb-2">{game.name}</h2>
            <p className="text-gray-600 mb-4">{game.description}</p>
            <p className="text-sm text-blue-600">
              {game.cardCount.toLocaleString()} cards available
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
