import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/server.tsx'],
  bundle: true,
  outfile: 'dist/server.js',
  format: 'esm',
  platform: 'node',
  target: 'node22',
  banner: { js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);' },
  external: [],
  minify: true,
  define: {
    'process.env.DB_DELAY_ENABLED': '"true"',
    'process.env.DB_DELAY_MIN': '"1"',
    'process.env.DB_DELAY_MAX': '"5"',
  },
});

console.log('Build complete: dist/server.js');
