'use client';

import Link from 'next/link';
import type { SetWithCards } from '@/lib/types';

export function SetDetailContent({
  set,
  slug,
  page,
}: {
  set: SetWithCards;
  slug: string;
  page: number;
}) {
  return (
    <div>
      <div className="mb-8">
        <Link
          href={`/games/${set.game.slug}`}
          className="text-blue-600 hover:underline mb-4 inline-block"
        >
          &larr; Back to {set.game.name}
        </Link>
        <h1 className="text-3xl font-bold">{set.name}</h1>
        <p className="text-gray-600 mt-2">
          {set.game.name} | {set.totalCards} cards | Released {set.releaseDate}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {set.cards.map((card) => (
          <Link
            key={card.id}
            href={`/cards/${card.id}`}
            className="bg-white rounded-lg shadow p-3 hover:shadow-md transition"
          >
            <div className="aspect-[3/4] bg-gray-100 rounded mb-2 flex items-center justify-center">
              <span className="text-gray-400 text-xs">{card.number}</span>
            </div>
            <h3 className="font-semibold text-sm truncate">{card.name}</h3>
            <p className="text-xs text-gray-500 truncate">{card.rarity}</p>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {set.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {page > 1 && (
            <Link
              href={`/sets/${slug}?page=${page - 1}`}
              className="px-4 py-2 bg-white border rounded hover:bg-gray-50"
            >
              Previous
            </Link>
          )}
          <span className="px-4 py-2">
            Page {page} of {set.totalPages}
          </span>
          {page < set.totalPages && (
            <Link
              href={`/sets/${slug}?page=${page + 1}`}
              className="px-4 py-2 bg-white border rounded hover:bg-gray-50"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
