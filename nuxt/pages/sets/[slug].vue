<script setup lang="ts">
const route = useRoute();
const { data } = await useFetch(`/api/sets/${route.params.slug}`);
</script>
<template>
  <div v-if="data">
    <NuxtLink :to="`/games/${data.gameSlug}`" class="text-blue-600 hover:underline">&larr; Back to {{ data.gameName }}</NuxtLink>
    <div class="mt-6">
      <h1 class="text-3xl font-bold mb-2">{{ data.name }}</h1>
      <p class="text-gray-600 mb-8">{{ data.totalCards }} cards | Released {{ data.releaseDate }}</p>
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <NuxtLink v-for="card in data.cards" :key="card.id" :to="`/cards/${card.id}`" class="bg-white rounded-lg shadow p-3 hover:shadow-md transition no-underline text-inherit">
          <div class="aspect-[3/4] bg-gray-100 rounded mb-2 flex items-center justify-center"><span class="text-gray-400 text-xs">{{ card.number }}/{{ data.totalCards }}</span></div>
          <h3 class="font-semibold text-xs truncate">{{ card.name }}</h3>
          <p class="text-xs text-gray-500">{{ card.rarity }}</p>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
