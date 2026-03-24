'use client';

import Link from 'next/link';
import type { Seller } from '@/lib/types';

export function SellersContent({ sellers }: { sellers: Seller[] }) {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Marketplace Sellers</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sellers.map((seller) => (
          <Link
            key={seller.id}
            href={`/sellers/${seller.slug}`}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">{seller.name}</h2>
                <p className="text-sm text-gray-500">{seller.location}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1">
                  <span className="text-yellow-500">&#9733;</span>
                  <span className="font-bold">{seller.rating.toFixed(1)}</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              {seller.salesCount.toLocaleString()} sales completed
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
