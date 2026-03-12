import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { SetDetailContent } from './set-detail-content';

export const dynamic = 'force-dynamic';

export default async function SetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = parseInt(pageParam || '1');
  const limit = 24;

  const set = await db.getSetWithCards(slug, page, limit);

  if (!set) {
    notFound();
  }

  return <SetDetailContent set={set} slug={slug} page={page} />;
}
