// Tiny concurrent load generator for flamegraph profiling.
// Usage: node .flame-load.mjs <baseUrl> <durationSec> <concurrency>
const base = process.argv[2] || 'http://127.0.0.1:3200'
const durationMs = (Number(process.argv[3]) || 30) * 1000
const concurrency = Number(process.argv[4]) || 50

// Representative SSR routes (weighted toward the homepage, like the benchmark).
const paths = [
  '/', '/', '/', '/',
  '/search?q=dragon&page=1', '/search?q=pikachu&page=2',
  '/games', '/games/pokemon', '/games/magic',
  '/sellers',
]

let done = 0, ok = 0, err = 0
const end = Date.now() + durationMs

async function worker() {
  while (Date.now() < end) {
    const p = paths[(Math.random() * paths.length) | 0]
    try {
      const res = await fetch(base + p)
      await res.arrayBuffer() // drain body so streaming actually runs
      done++
      res.status === 200 ? ok++ : err++
    } catch {
      done++; err++
    }
  }
}

const t0 = Date.now()
await Promise.all(Array.from({ length: concurrency }, worker))
const secs = (Date.now() - t0) / 1000
console.log(`load done: ${done} reqs in ${secs.toFixed(1)}s (${(done / secs).toFixed(0)}/s), ok=${ok} err=${err}`)
