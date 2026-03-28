import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(import.meta.dirname, '..', 'hono', 'data');
const dataFiles = {};
for (const name of ['games', 'sets', 'cards', 'sellers', 'listings', 'featured']) {
  dataFiles[name] = fs.readFileSync(path.join(dataDir, `${name}.json`), 'utf-8');
}

await esbuild.build({
  entryPoints: ['hono-preact-workerd/worker.tsx'],
  bundle: true,
  outfile: 'hono-preact-workerd/worker-bundle.js',
  format: 'esm',
  platform: 'browser',
  target: 'esnext',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  define: {
    '__INLINE_GAMES__': dataFiles['games'],
    '__INLINE_SETS__': dataFiles['sets'],
    '__INLINE_CARDS__': dataFiles['cards'],
    '__INLINE_SELLERS__': dataFiles['sellers'],
    '__INLINE_LISTINGS__': dataFiles['listings'],
    '__INLINE_FEATURED__': dataFiles['featured'],
    'process.env.NODE_ENV': '"production"',
  },
  minify: true,
  logLevel: 'info',
});

const size = fs.statSync('hono-preact-workerd/worker-bundle.js').size;
console.log(`Bundle: ${(size / 1024 / 1024).toFixed(1)}MB`);
