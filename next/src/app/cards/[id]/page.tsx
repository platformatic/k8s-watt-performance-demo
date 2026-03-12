import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { CardDetailContent } from './card-detail-content';

export const dynamic = 'force-dynamic';

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const card = await db.getCardWithListings(id);

  if (!card) {
    notFound();
  }

  const [set, game, sellers] = await Promise.all([
    db.getSetBySlug(card.setId.replace(`${card.gameId}-`, '').replace(/-set-\d+$/, '')),
    db.getGameBySlug(card.gameId),
    db.getSellers(),
  ]);

  return (
    <CardDetailContent
      card={card}
      set={set}
      game={game}
      sellers={sellers}
    />
  );
}
