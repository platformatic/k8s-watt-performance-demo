<script>let { data } = $props();</script>
<div>
  <a href="/sellers" class="text-blue-600 hover:underline">&larr; Back to Sellers</a>
  <div class="mt-6">
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <h1 class="text-3xl font-bold mb-2">{data.name}</h1>
      <div class="flex gap-6 text-sm text-gray-500"><span>Rating: {data.rating.toFixed(1)}</span><span>{data.salesCount.toLocaleString()} sales</span><span>{data.location}</span></div>
    </div>
    <h2 class="text-2xl font-bold mb-4">Listings ({data.total})</h2>
    <div class="bg-white rounded-lg shadow overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50"><tr><th class="px-4 py-3 text-left text-sm font-semibold">Card</th><th class="px-4 py-3 text-left text-sm font-semibold">Condition</th><th class="px-4 py-3 text-right text-sm font-semibold">Price</th><th class="px-4 py-3 text-right text-sm font-semibold">Qty</th></tr></thead>
        <tbody class="divide-y">
          {#each data.listings as listing}
            <tr class="hover:bg-gray-50"><td class="px-4 py-3">{listing.cardId}</td><td class="px-4 py-3 text-sm">{listing.condition}</td><td class="px-4 py-3 text-right font-semibold">${listing.price.toFixed(2)}</td><td class="px-4 py-3 text-right text-sm">{listing.quantity}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
