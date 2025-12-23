import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({isSsrBuild}) => {
  return {
    base: globalThis.platformatic?.basePath ?? '/',
    build: {
      rollupOptions: isSsrBuild ? { input: './app/server.ts' } : undefined
    },
    plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
    server: {
      fs: {
        strict: false
      },
      allowedHosts: ['.plt.local']
    }
  }
});
