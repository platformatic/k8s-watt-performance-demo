import { db } from '@/lib/db';
import { SellersContent } from './sellers-content';

export const dynamic = 'force-dynamic';

export default async function SellersPage() {
  const sellers = await db.getSellers();
  const sortedSellers = [...sellers].sort((a, b) => b.rating - a.rating);

  return <SellersContent sellers={sortedSellers} />;
}
