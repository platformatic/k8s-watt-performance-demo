<script>let { data } = $props();</script>
<div>
  <h1 class="text-3xl font-bold mb-8">Sellers</h1>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {#each data.sellers as seller}
      <a href="/sellers/{seller.slug}" class="bg-white rounded-lg shadow p-6 hover:shadow-md transition no-underline text-inherit">
        <h2 class="font-bold text-lg mb-2">{seller.name}</h2>
        <div class="flex justify-between text-sm text-gray-500"><span>Rating: {seller.rating.toFixed(1)}</span><span>{seller.salesCount.toLocaleString()} sales</span></div>
        <p class="text-xs text-gray-400 mt-2">{seller.location}</p>
      </a>
    {/each}
  </div>
</div>
