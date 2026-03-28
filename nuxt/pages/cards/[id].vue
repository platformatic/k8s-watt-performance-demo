<script setup lang="ts">
const route = useRoute();
const { data } = await useFetch(`/api/cards/${route.params.id}`);
</script>
<template>
  <div v-if="data">
    <NuxtLink :to="`/sets/${data.setSlug}`" class="text-blue-600 hover:underline">&larr; Back to {{ data.setName }}</NuxtLink>
    <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
      <div class="bg-gray-100 rounded-lg aspect-[3/4] flex items-center justify-center"><span class="text-gray-400 text-2xl">{{ data.number }}/{{ data.setTotalCards || 200 }}</span></div>
      <div>
        <h1 class="text-3xl font-bold mb-2">{{ data.name }}</h1>
        <div class="space-y-2 mb-6">
          <p class="text-gray-600">Rarity: <span class="font-semibold">{{ data.rarity }}</span></p>
          <p class="text-gray-600">Number: <span class="font-semibold">{{ data.number }}</span></p>
          <p class="text-gray-600">Set: <span class="font-semibold">{{ data.setName }}</span></p>
          <p class="text-gray-600">Game: <span class="font-semibold">{{ data.gameName }}</span></p>
        </div>
        <h2 class="text-xl font-bold mb-4">Listings ({{ data.listings?.length || 0 }})</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b"><th class="text-left py-2">Seller</th><th class="text-left py-2">Condition</th><th class="text-right py-2">Price</th></tr></thead>
            <tbody>
              <tr v-for="listing in data.listings" :key="listing.id" class="border-b">
                <td class="py-2"><NuxtLink :to="`/sellers/${listing.sellerSlug}`" class="text-blue-600 hover:underline">{{ listing.sellerName }}</NuxtLink></td>
                <td class="py-2">{{ listing.condition }}</td>
                <td class="py-2 text-right font-semibold">${{ listing.price.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
