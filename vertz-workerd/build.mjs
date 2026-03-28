import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(import.meta.dirname, '..', 'vertz', 'data');
const dataFiles = {};
for (const name of ['games', 'sets', 'cards', 'sellers', 'listings', 'featured']) {
  dataFiles[name] = fs.readFileSync(path.join(dataDir, `${name}.json`), 'utf-8');
}

const fsPolyfill = `
const data = {
  ${Object.entries(dataFiles).map(([k, v]) => `'${k}.json': ${v}`).join(',\n  ')}
};
export function readFileSync(filePath, encoding) {
  if (typeof filePath !== 'string') return '';
  const parts = filePath.replace(/\\\\/g, '/').split('/');
  const filename = parts[parts.length - 1];
  if (data[filename] !== undefined) {
    return typeof data[filename] === 'string' ? data[filename] : JSON.stringify(data[filename]);
  }
  return '';
}
export function existsSync(filePath) {
  if (typeof filePath !== 'string') return false;
  const parts = filePath.replace(/\\\\/g, '/').split('/');
  const filename = parts[parts.length - 1];
  return data[filename] !== undefined;
}
export function statSync() { return { isFile: () => true }; }
export function readdirSync() { return []; }
export async function readFile(p) { return readFileSync(p, 'utf-8'); }
export async function access() { }
export const promises = { readFile, access };
export default { readFileSync, existsSync, statSync, readdirSync, promises };
`;

const pathPolyfill = `
export function join(...parts) { return parts.filter(p => typeof p === 'string').join('/').replace(/\\/+/g, '/'); }
export function resolve(...parts) { return join(...parts); }
export function extname(p) { const i = (p||'').lastIndexOf('.'); return i >= 0 ? p.slice(i) : ''; }
export function dirname(p) { return (p||'').replace(/\\/[^/]*$/, '') || '/'; }
export const sep = '/';
export function basename(p) { return (p||'').split('/').pop() || ''; }
export function relative(from, to) { return to; }
export function normalize(p) { return p; }
export function isAbsolute(p) { return (p||'').startsWith('/'); }
export function parse(p) { return { dir: dirname(p), base: basename(p), ext: extname(p) }; }
export default { join, resolve, extname, dirname, sep, basename, relative, normalize, isAbsolute, parse };
`;

const nodePolyfillPlugin = {
  name: 'node-polyfill',
  setup(build) {
    build.onResolve({ filter: /^(node:)?fs(\/.*)?$/ }, () => ({ path: 'fs', namespace: 'poly' }));
    build.onResolve({ filter: /^(node:)?path$/ }, () => ({ path: 'path', namespace: 'poly' }));
    build.onResolve({ filter: /^(node:)?module$/ }, () => ({ path: 'module', namespace: 'poly' }));
    build.onResolve({ filter: /^react(\/.*)?$/ }, () => ({ path: 'react-stub', namespace: 'poly' }));
    build.onResolve({ filter: /^@vertz\/ui-compiler/ }, () => ({ path: 'ui-compiler', namespace: 'poly' }));
    build.onResolve({ filter: /^node:/ }, (args) => ({ path: args.path, namespace: 'node-stub' }));

    // Resolve relative imports from aot-routes.js to source files
    build.onResolve({ filter: /^\.\/(router|styles\/.*)$/ }, (args) => {
      if (args.importer.includes('aot-routes')) {
        // These are app source files referenced by the AOT App component
        const srcDir = path.resolve(import.meta.dirname, '..', 'vertz', 'src');
        const resolved = path.resolve(srcDir, args.path);
        // Try .tsx, .ts extensions
        for (const ext of ['.tsx', '.ts', '.js']) {
          const full = resolved + ext;
          if (fs.existsSync(full)) {
            return { path: full };
          }
        }
        // Try as directory with index
        for (const ext of ['.tsx', '.ts', '.js']) {
          const full = path.join(resolved, `index${ext}`);
          if (fs.existsSync(full)) {
            return { path: full };
          }
        }
      }
      return undefined;
    });

    build.onLoad({ filter: /.*/, namespace: 'poly' }, (args) => {
      const stubs = {
        fs: fsPolyfill,
        path: pathPolyfill,
        module: `export function createRequire() { return function() { return {}; }; } export default { createRequire };`,
        'react-stub': `export function jsxDEV(tag, props, key) { return ''; } export function jsx(tag, props, key) { return ''; } export function Fragment() { return ''; } export default {};`,
        'ui-compiler': `export function extractRoutes() { return []; } export function compileForSSRAot() { return { code: '', aotManifest: null }; } export function analyzeComponentQueries() { return []; } export function generatePrefetchManifest() { return {}; } export default {};`,
      };
      return { contents: stubs[args.path] || 'export default {};', loader: 'js' };
    });

    build.onLoad({ filter: /.*/, namespace: 'node-stub' }, (args) => {
      const stubs = {
        'node:async_hooks': `
class AsyncLocalStorage { constructor() { this._store = undefined; } run(store, fn) { const p = this._store; this._store = store; try { return fn(); } finally { this._store = p; } } getStore() { return this._store; } }
export { AsyncLocalStorage }; export default { AsyncLocalStorage };`,
        'node:process': `export default globalThis.process || { env: {}, cwd: () => '/app' };`,
        'node:url': `export function fileURLToPath(u) { return u.replace('file://', ''); } export default { fileURLToPath };`,
        'node:os': `export function platform() { return 'linux'; } export default { platform };`,
      };
      return { contents: stubs[args.path] || 'export default {};', loader: 'js' };
    });
  }
};

await esbuild.build({
  entryPoints: ['vertz-workerd/worker.js'],
  bundle: true,
  outfile: 'vertz-workerd/worker-bundle.js',
  format: 'esm',
  platform: 'browser',
  target: 'esnext',
  plugins: [nodePolyfillPlugin],
  nodePaths: ['vertz/node_modules'],
  define: {
    'process.env.DB_DELAY_ENABLED': '"false"',
    'process.env.DB_DELAY_MIN': '"1"',
    'process.env.DB_DELAY_MAX': '"5"',
    'process.env.NODE_ENV': '"production"',
    'process.env.VERTZ_DEBUG': '""',
  },
  banner: { js: 'if(typeof globalThis.process==="undefined"){globalThis.process={env:{},cwd:function(){return"/app"},argv:[]}}else if(typeof process.cwd!=="function"){process.cwd=function(){return"/app"}}' },
  minify: true,
  logLevel: 'info',
});

const size = fs.statSync('vertz-workerd/worker-bundle.js').size;
console.log(`Bundle: ${(size / 1024 / 1024).toFixed(1)}MB`);
