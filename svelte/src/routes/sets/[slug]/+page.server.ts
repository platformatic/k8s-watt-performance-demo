import { db } from '$lib/server/db.js';
import { error } from '@sveltejs/kit';
export async function load({ params }) {
  const data = await db.getSetWithCards(params.slug);
  if (!data) error(404, 'Set not found');
  return data;
}
