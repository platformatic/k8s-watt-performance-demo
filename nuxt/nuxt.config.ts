export default defineNuxtConfig({
  ssr: true,
  modules: ['@nuxtjs/tailwindcss'],
  nitro: {
    preset: 'node-server',
  },
  app: {
    head: {
      title: 'CardMarket - Trading Card Marketplace',
    },
  },
  compatibilityDate: '2025-06-01',
});
