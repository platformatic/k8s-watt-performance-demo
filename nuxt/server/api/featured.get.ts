import { db } from '../utils/db';
export default defineEventHandler(async () => {
  const featured = await db.getFeatured();
  const games = await db.getGames();

  // Resolve popularGames slugs to game objects
  const popularGames = featured.popularGames
    .map((slug: string) => games.find((g: any) => g.slug === slug))
    .filter(Boolean);

  // Resolve trendingCards IDs to card objects
  const trendingCards = await Promise.all(
    featured.trendingCards.slice(0, 8).map(async (id: string) => {
      try {
        return await db.getCardById(id);
      } catch {
        return null;
      }
    })
  );

  // Resolve newReleases slugs to set objects
  const allSets = await db.getSets();
  const newReleases = featured.newReleases
    .map((slug: string) => allSets.find((s: any) => s.slug === slug))
    .filter(Boolean);

  return {
    games: popularGames,
    trendingCards: trendingCards.filter(Boolean),
    newReleases,
  };
});
