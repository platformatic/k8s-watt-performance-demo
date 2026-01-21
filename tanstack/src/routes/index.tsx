import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

const getServerInfo = createServerFn().handler(async () => {
  return { pid: process.pid }
})

export const Route = createFileRoute('/')({
  loader: () => getServerInfo(),
  component: Home,
})

function Home() {
  const { pid } = Route.useLoaderData()
  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-8 row-start-2 items-center">
        <h1 className="text-4xl font-bold">Welcome to TanStack Start</h1>
        <p className="text-lg text-gray-600">
          A type-safe, client-first, full-stack React framework
        </p>
        <div className="mt-8 p-4 bg-gray-100 rounded-lg">
          <p className="text-sm text-gray-500">Process ID: <span className="font-mono font-bold">{pid}</span></p>
        </div>
      </main>
    </div>
  )
}
