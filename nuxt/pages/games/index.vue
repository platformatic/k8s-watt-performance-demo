<script setup lang="ts">
const { data: games } = await useFetch('/api/games');
</script>
<template>
  <div>
    <h1 class="text-3xl font-bold mb-8">All Games</h1>
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
      <NuxtLink v-for="game in games" :key="game.id" :to="`/games/${game.slug}`" class="bg-white rounded-lg shadow p-4 hover:shadow-md transition no-underline text-inherit">
        <div class="aspect-square bg-gray-100 rounded mb-3 flex items-center justify-center"><span class="text-3xl">{{ game.name[0] }}</span></div>
        <h3 class="font-semibold text-center">{{ game.name }}</h3>
        <p class="text-sm text-gray-500 text-center">{{ game.totalCards.toLocaleString() }} cards</p>
      </NuxtLink>
    </div>
  </div>
</template>
