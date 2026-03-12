import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { GameDetailContent } from './game-detail-content';

export const dynamic = 'force-dynamic';

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = await db.getGameWithSets(slug);

  if (!game) {
    notFound();
  }

  return <GameDetailContent game={game} />;
}
