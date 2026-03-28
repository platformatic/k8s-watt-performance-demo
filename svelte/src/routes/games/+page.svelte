<script>let { data } = $props();</script>
<div>
  <h1 class="text-3xl font-bold mb-8">All Games</h1>
  <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
    {#each data.games as game}
      <a href="/games/{game.slug}" class="bg-white rounded-lg shadow p-6 hover:shadow-md transition no-underline text-inherit">
        <div class="aspect-square bg-gray-100 rounded mb-4 flex items-center justify-center"><span class="text-4xl">{game.name.charAt(0)}</span></div>
        <h2 class="font-bold text-lg text-center mb-1">{game.name}</h2>
        <p class="text-sm text-gray-500 text-center">{game.cardCount.toLocaleString()} cards</p>
        <p class="text-xs text-gray-400 text-center mt-2">{game.description}</p>
      </a>
    {/each}
  </div>
</div>
