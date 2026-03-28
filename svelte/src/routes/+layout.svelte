<script>
  import '../app.css';
  let { children } = $props();
</script>

<div class="min-h-screen flex flex-col">
  <header class="bg-white py-4 border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 flex justify-between items-center">
      <a href="/" class="text-2xl font-bold text-blue-600 no-underline">CardMarket</a>
      <nav class="flex gap-6">
        <a href="/games" class="text-gray-600 no-underline">Games</a>
        <a href="/search" class="text-gray-600 no-underline">Search</a>
        <a href="/sellers" class="text-gray-600 no-underline">Sellers</a>
        <a href="/cart" class="text-gray-600 no-underline">Cart</a>
      </nav>
    </div>
  </header>
  <main class="max-w-7xl w-full mx-auto px-4 py-8 flex-1">
    {@render children()}
  </main>
  <footer class="bg-white py-6 px-4 text-gray-500 text-sm border-t border-gray-200 text-center">
    CardMarket - Trading Card Marketplace Benchmark
  </footer>
</div>
