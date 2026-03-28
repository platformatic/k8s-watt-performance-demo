<script setup lang="ts">
const { data: sellers } = await useFetch('/api/sellers');
</script>
<template>
  <div>
    <h1 class="text-3xl font-bold mb-8">Sellers</h1>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <NuxtLink v-for="seller in sellers" :key="seller.id" :to="`/sellers/${seller.slug}`" class="bg-white rounded-lg shadow p-6 hover:shadow-md transition no-underline text-inherit">
        <div class="flex items-center gap-4 mb-3">
          <div class="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center"><span class="text-xl font-bold">{{ seller.name[0] }}</span></div>
          <div><h3 class="font-semibold">{{ seller.name }}</h3><p class="text-sm text-gray-500">{{ seller.totalListings }} listings</p></div>
        </div>
        <div class="flex gap-2"><span class="text-yellow-500">★</span><span class="text-sm">{{ seller.rating.toFixed(1) }}</span></div>
      </NuxtLink>
    </div>
  </div>
</template>
