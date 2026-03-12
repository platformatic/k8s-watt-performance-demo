import { db } from '@/lib/db';
import type { CardSearchParams } from '@/lib/types';
import { SearchContent } from './search-content';

export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;

  const searchConfig: CardSearchParams = {
    q: params.q || undefined,
    game: params.game || undefined,
    set: params.set || undefined,
    rarity: params.rarity || undefined,
    page: parseInt(params.page || '1'),
    limit: 24,
    sort: (params.sort as CardSearchParams['sort']) || undefined,
    order: (params.order as CardSearchParams['order']) || 'asc',
  };

  if (params.minPrice) searchConfig.minPrice = parseFloat(params.minPrice);
  if (params.maxPrice) searchConfig.maxPrice = parseFloat(params.maxPrice);

  const [results, games] = await Promise.all([
    db.searchCards(searchConfig),
    db.getGames(),
  ]);

  return (
    <SearchContent
      results={results}
      games={games}
      params={params}
    />
  );
}
