import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(import.meta.dirname, '..', 'vertz', 'data');

// Read all JSON data files
const games = fs.readFileSync(path.join(dataDir, 'games.json'), 'utf-8');
const sets = fs.readFileSync(path.join(dataDir, 'sets.json'), 'utf-8');
const cards = fs.readFileSync(path.join(dataDir, 'cards.json'), 'utf-8');
const sellers = fs.readFileSync(path.join(dataDir, 'sellers.json'), 'utf-8');
const listings = fs.readFileSync(path.join(dataDir, 'listings.json'), 'utf-8');
const featured = fs.readFileSync(path.join(dataDir, 'featured.json'), 'utf-8');

await esbuild.build({
  entryPoints: ['hono-workerd/worker.tsx'],
  bundle: true,
  outfile: 'hono-workerd/worker-bundle.js',
  format: 'esm',
  platform: 'browser',
  target: 'esnext',
  jsx: 'automatic',
  jsxImportSource: 'hono/jsx',
  define: {
    '__INLINE_GAMES__': games,
    '__INLINE_SETS__': sets,
    '__INLINE_CARDS__': cards,
    '__INLINE_SELLERS__': sellers,
    '__INLINE_LISTINGS__': listings,
    '__INLINE_FEATURED__': featured,
  },
  minify: true,
  logLevel: 'info',
});

const size = fs.statSync('hono-workerd/worker-bundle.js').size;
console.log(`Bundle: ${(size / 1024 / 1024).toFixed(1)}MB`);
