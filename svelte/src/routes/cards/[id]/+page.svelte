<script>let { data } = $props();</script>
<div>
  <a href="/search" class="text-blue-600 hover:underline mb-6 block">&larr; Back to Search</a>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <div class="lg:col-span-1">
      <div class="bg-white rounded-lg shadow p-4">
        <div class="aspect-[3/4] bg-gray-100 rounded flex items-center justify-center"><span class="text-gray-400">{data.card.number}</span></div>
      </div>
    </div>
    <div class="lg:col-span-2">
      <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h1 class="text-3xl font-bold mb-2">{data.card.name}</h1>
        <p class="text-gray-600 mb-4">{data.game?.name} | {data.set?.name || data.card.setId} | {data.card.number}</p>
        <div class="grid grid-cols-2 gap-4 mb-6">
          <div><span class="text-sm text-gray-500">Rarity</span><p class="font-semibold">{data.card.rarity}</p></div>
          <div><span class="text-sm text-gray-500">Type</span><p class="font-semibold">{data.card.type}</p></div>
        </div>
        {#if data.card.lowestPrice}
          <div class="border-t pt-4">
            <span class="text-sm text-gray-500">Starting from</span>
            <p class="text-2xl font-bold text-green-600">${data.card.lowestPrice.toFixed(2)}</p>
            <p class="text-sm text-gray-500">{data.card.listingCount} listings available</p>
          </div>
        {/if}
      </div>
      <div class="bg-white rounded-lg shadow">
        <div class="p-4 border-b"><h2 class="text-xl font-bold">Available Listings</h2></div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr><th class="px-4 py-3 text-left text-sm font-semibold">Seller</th><th class="px-4 py-3 text-left text-sm font-semibold">Condition</th><th class="px-4 py-3 text-left text-sm font-semibold">Language</th><th class="px-4 py-3 text-right text-sm font-semibold">Price</th><th class="px-4 py-3 text-right text-sm font-semibold">Qty</th></tr>
            </thead>
            <tbody class="divide-y">
              {#each data.card.listings.slice(0, 20) as listing}
                {@const seller = data.sellers.find(s => s.id === listing.sellerId)}
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3">{seller?.name || 'Unknown'}</td>
                  <td class="px-4 py-3 text-sm">{listing.condition}</td>
                  <td class="px-4 py-3 text-sm">{listing.language}</td>
                  <td class="px-4 py-3 text-right font-semibold">${listing.price.toFixed(2)}</td>
                  <td class="px-4 py-3 text-right text-sm">{listing.quantity}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div>
