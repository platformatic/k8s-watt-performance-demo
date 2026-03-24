import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { SellerDetailContent } from './seller-detail-content';

export const dynamic = 'force-dynamic';

export default async function SellerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = parseInt(pageParam || '1');
  const limit = 20;

  const seller = await db.getSellerWithListings(slug, page, limit);

  if (!seller) {
    notFound();
  }

  const cards = await db.findMany<{ id: string; name: string; number: string }>(
    'cards',
    seller.listings.map((l) => l.cardId)
  );
  const cardMap = Object.fromEntries(cards.map((c) => [c.id, c]));

  return (
    <SellerDetailContent
      seller={seller}
      cardMap={cardMap}
      slug={slug}
      page={page}
    />
  );
}
