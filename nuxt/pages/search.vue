<script setup lang="ts">
const route = useRoute();
const { data } = await useFetch('/api/search', { query: { q: route.query.q, game: route.query.game } });
</script>
<template>
  <div v-if="data">
    <h1 class="text-3xl font-bold mb-8">Search Cards</h1>
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div class="lg:col-span-1">
        <div class="bg-white rounded-lg shadow p-4 sticky top-4">
          <form>
            <div class="mb-4"><label class="block text-sm font-semibold mb-2">Search</label><input type="text" name="q" :value="data.q" placeholder="Card name..." class="w-full border rounded px-3 py-2" /></div>
            <div class="mb-4"><label class="block text-sm font-semibold mb-2">Game</label>
              <select name="game" class="w-full border rounded px-3 py-2"><option value="">All Games</option><option v-for="game in data.games" :key="game.slug" :value="game.slug">{{ game.name }}</option></select>
            </div>
            <button type="submit" class="w-full bg-blue-600 text-white rounded py-2 hover:bg-blue-700">Apply Filters</button>
          </form>
        </div>
      </div>
      <div class="lg:col-span-3">
        <p class="text-gray-600 mb-4">{{ data.cards.length }} results</p>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <NuxtLink v-for="card in data.cards" :key="card.id" :to="`/cards/${card.id}`" class="bg-white rounded-lg shadow p-3 hover:shadow-md transition no-underline text-inherit">
            <div class="aspect-[3/4] bg-gray-100 rounded mb-2 flex items-center justify-center"><span class="text-gray-400 text-xs">{{ card.number }}</span></div>
            <h3 class="font-semibold text-sm truncate">{{ card.name }}</h3>
            <p class="text-xs text-gray-500">{{ card.rarity }}</p>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
