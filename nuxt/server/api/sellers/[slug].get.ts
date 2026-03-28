import { db } from '../../utils/db';
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!;
  return db.getSellerWithListings(slug);
});
