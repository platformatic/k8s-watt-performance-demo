import { db } from '@/lib/db';
import { GamesContent } from './games-content';

export const dynamic = 'force-dynamic';

export default async function GamesPage() {
  const games = await db.getGames();

  return <GamesContent games={games} />;
}
