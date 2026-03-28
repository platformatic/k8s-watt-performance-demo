import { db } from '$lib/server/db.js';
import { error } from '@sveltejs/kit';
export async function load({ params }) {
  const data = await db.getGameWithSets(params.slug);
  if (!data) error(404, 'Game not found');
  return data;
}
