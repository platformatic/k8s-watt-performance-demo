import { db } from '$lib/server/db.js';
export async function load({ url }) {
  const q = url.searchParams.get('q') || undefined;
  const [results, games] = await Promise.all([
    db.searchCards({ q, page: 1, limit: 24 }),
    db.getGames(),
  ]);
  return { results, games, q: q || '' };
}
