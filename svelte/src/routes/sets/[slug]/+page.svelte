<script>let { data } = $props();</script>
<div>
  <a href="/games/{data.game.slug}" class="text-blue-600 hover:underline">&larr; Back to {data.game.name}</a>
  <div class="mt-6">
    <h1 class="text-3xl font-bold mb-2">{data.name}</h1>
    <p class="text-gray-600 mb-6">{data.game.name} | {data.totalCards} cards | Released {data.releaseDate}</p>
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {#each data.cards as card}
        <a href="/cards/{card.id}" class="bg-white rounded-lg shadow p-3 hover:shadow-md transition no-underline text-inherit">
          <div class="aspect-[3/4] bg-gray-100 rounded mb-2 flex items-center justify-center"><span class="text-gray-400 text-xs">{card.number}</span></div>
          <h3 class="font-semibold text-sm truncate">{card.name}</h3>
          <p class="text-xs text-gray-500">{card.rarity}</p>
        </a>
      {/each}
    </div>
  </div>
</div>
