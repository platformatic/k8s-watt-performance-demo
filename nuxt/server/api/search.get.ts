import { db } from '../utils/db';
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  return {
    cards: await db.searchCards({ q: query.q as string, game: query.game as string }),
    games: await db.getGames(),
    q: query.q || '',
    game: query.game || '',
  };
});
