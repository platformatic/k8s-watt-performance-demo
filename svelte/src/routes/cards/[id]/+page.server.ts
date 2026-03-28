import { db } from '$lib/server/db.js';
import { error } from '@sveltejs/kit';
export async function load({ params }) {
  const card = await db.getCardWithListings(params.id);
  if (!card) error(404, 'Card not found');
  const [set, game, sellers] = await Promise.all([
    db.getSetBySlug(card.setId.replace(`${card.gameId}-`, '').replace(/-set-\d+$/, '')),
    db.getGameBySlug(card.gameId),
    db.getSellers(),
  ]);
  return { card, set, game, sellers };
}
