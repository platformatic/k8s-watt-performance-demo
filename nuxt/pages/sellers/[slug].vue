<script setup lang="ts">
const route = useRoute();
const { data } = await useFetch(`/api/sellers/${route.params.slug}`);
</script>
<template>
  <div v-if="data">
    <NuxtLink to="/sellers" class="text-blue-600 hover:underline">&larr; Back to Sellers</NuxtLink>
    <div class="mt-6">
      <div class="flex items-center gap-4 mb-6">
        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center"><span class="text-2xl font-bold">{{ data.name[0] }}</span></div>
        <div><h1 class="text-3xl font-bold">{{ data.name }}</h1><p class="text-gray-600">{{ data.totalListings }} listings | ★ {{ data.rating.toFixed(1) }}</p></div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b"><th class="text-left py-2">Card</th><th class="text-left py-2">Game</th><th class="text-left py-2">Condition</th><th class="text-right py-2">Price</th></tr></thead>
          <tbody>
            <tr v-for="listing in data.listings" :key="listing.id" class="border-b hover:bg-gray-50">
              <td class="py-2"><NuxtLink :to="`/cards/${listing.cardId}`" class="text-blue-600 hover:underline">{{ listing.cardName }}</NuxtLink></td>
              <td class="py-2">{{ listing.gameName }}</td>
              <td class="py-2">{{ listing.condition }}</td>
              <td class="py-2 text-right font-semibold">${{ listing.price.toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
