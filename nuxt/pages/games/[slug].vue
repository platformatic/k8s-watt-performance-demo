<script setup lang="ts">
const route = useRoute();
const { data } = await useFetch(`/api/games/${route.params.slug}`);
</script>
<template>
  <div v-if="data">
    <NuxtLink to="/games" class="text-blue-600 hover:underline">&larr; Back to Games</NuxtLink>
    <div class="mt-6">
      <h1 class="text-3xl font-bold mb-2">{{ data.name }}</h1>
      <p class="text-gray-600 mb-8">{{ data.description }}</p>
      <h2 class="text-2xl font-bold mb-4">Sets ({{ data.sets.length }})</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <NuxtLink v-for="set in data.sets" :key="set.id" :to="`/sets/${set.slug}`" class="bg-white rounded-lg shadow p-4 hover:shadow-md transition no-underline text-inherit">
          <div class="aspect-video bg-gray-100 rounded mb-3 flex items-center justify-center"><span class="text-gray-400">{{ set.name.substring(0, 2) }}</span></div>
          <h3 class="font-semibold">{{ set.name }}</h3>
          <p class="text-sm text-gray-500">{{ set.totalCards }} cards | {{ set.releaseDate }}</p>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
