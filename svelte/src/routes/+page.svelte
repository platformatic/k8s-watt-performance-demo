<script>
  let { data } = $props();
</script>

<div class="space-y-12">
  <section class="text-center py-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl text-white">
    <h1 class="text-4xl font-bold mb-4">Trading Card Marketplace</h1>
    <p class="text-xl opacity-90 mb-6">Buy and sell cards from your favorite games</p>
    <a href="/search" class="inline-block bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition">Start Shopping</a>
  </section>
  <section>
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Browse by Game</h2>
      <a href="/games" class="text-blue-600 hover:underline">View All</a>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {#each data.games as game}
        <a href="/games/{game.slug}" class="bg-white rounded-lg shadow p-4 hover:shadow-md transition no-underline text-inherit">
          <div class="aspect-square bg-gray-100 rounded mb-3 flex items-center justify-center">
            <span class="text-3xl">{game.name.charAt(0)}</span>
          </div>
          <h3 class="font-semibold text-center">{game.name}</h3>
          <p class="text-sm text-gray-500 text-center">{game.cardCount.toLocaleString()} cards</p>
        </a>
      {/each}
    </div>
  </section>
  <section>
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Trending Cards</h2>
      <a href="/search" class="text-blue-600 hover:underline">View All</a>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      {#each data.trendingCards as card}
        <a href="/cards/{card.id}" class="bg-white rounded-lg shadow p-4 hover:shadow-md transition no-underline text-inherit">
          <div class="aspect-[3/4] bg-gray-100 rounded mb-3 flex items-center justify-center">
            <span class="text-gray-400 text-sm">{card.number}</span>
          </div>
          <h3 class="font-semibold text-sm truncate">{card.name}</h3>
          <p class="text-xs text-gray-500">{card.rarity}</p>
        </a>
      {/each}
    </div>
  </section>
  <section>
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">New Releases</h2>
      <a href="/games" class="text-blue-600 hover:underline">View All Sets</a>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {#each data.newReleases as set}
        <a href="/sets/{set.slug}" class="bg-white rounded-lg shadow p-4 hover:shadow-md transition no-underline text-inherit">
          <div class="aspect-video bg-gray-100 rounded mb-3 flex items-center justify-center">
            <span class="text-gray-400">{set.name.substring(0, 2)}</span>
          </div>
          <h3 class="font-semibold">{set.name}</h3>
          <p class="text-sm text-gray-500">{set.totalCards} cards | {set.releaseDate}</p>
        </a>
      {/each}
    </div>
  </section>
</div>
