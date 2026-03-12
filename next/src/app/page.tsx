import { db } from '@/lib/db';
import { HomeContent } from './home-content';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [games, trendingCards, newReleases] = await Promise.all([
    db.getGames(),
    db.getTrendingCards(8),
    db.getNewReleaseSets(4),
  ]);

  return (
    <HomeContent
      games={games}
      trendingCards={trendingCards}
      newReleases={newReleases}
    />
  );
}
