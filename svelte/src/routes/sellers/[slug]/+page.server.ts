import { db } from '$lib/server/db.js';
import { error } from '@sveltejs/kit';
export async function load({ params }) {
  const data = await db.getSellerWithListings(params.slug);
  if (!data) error(404, 'Seller not found');
  return data;
}
