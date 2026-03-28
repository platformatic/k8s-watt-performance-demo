import { db } from '$lib/server/db.js';
export async function load() {
  const [games, trendingCards, newReleases] = await Promise.all([
    db.getGames(),
    db.getTrendingCards(8),
    db.getNewReleaseSets(4),
  ]);
  return { games, trendingCards, newReleases };
}
