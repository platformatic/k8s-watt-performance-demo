<template>
  <div class="min-h-screen flex flex-col">
    <header class="bg-white py-4 border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 flex justify-between items-center">
        <NuxtLink to="/" class="text-2xl font-bold text-blue-600 no-underline">CardMarket</NuxtLink>
        <nav class="flex gap-6">
          <NuxtLink to="/games" class="text-gray-600 no-underline">Games</NuxtLink>
          <NuxtLink to="/search" class="text-gray-600 no-underline">Search</NuxtLink>
          <NuxtLink to="/sellers" class="text-gray-600 no-underline">Sellers</NuxtLink>
          <NuxtLink to="/cart" class="text-gray-600 no-underline">Cart</NuxtLink>
        </nav>
      </div>
    </header>
    <main class="max-w-7xl w-full mx-auto px-4 py-8 flex-1">
      <NuxtPage />
    </main>
    <footer class="bg-white py-6 px-4 text-gray-500 text-sm border-t border-gray-200 text-center">
      CardMarket - Trading Card Marketplace Benchmark
    </footer>
  </div>
</template>
