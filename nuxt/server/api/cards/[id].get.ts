import { db } from '../../utils/db';
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!;
  return db.getCardWithListings(id);
});
