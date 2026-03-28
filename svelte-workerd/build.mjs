import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(import.meta.dirname, '..', 'svelte', 'data');
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
export function statSync() { return { isFile: () => true, isDirectory: () => false }; }
export function readdirSync() { return []; }
export function createReadStream() { return null; }
export async function readFile(p, enc) { return readFileSync(p, enc); }
export async function access() { }
export const promises = { readFile, access };
export default { readFileSync, existsSync, statSync, readdirSync, promises, createReadStream };
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
    // Polyfill fs and path
    build.onResolve({ filter: /^(node:)?fs(\/.*)?$/ }, () => ({ path: 'fs', namespace: 'poly' }));
    build.onResolve({ filter: /^(node:)?path$/ }, () => ({ path: 'path', namespace: 'poly' }));
    build.onResolve({ filter: /^(node:)?module$/ }, () => ({ path: 'module', namespace: 'poly' }));
    
    // Stub other Node builtins
    build.onResolve({ filter: /^node:/ }, (args) => ({ path: args.path, namespace: 'node-stub' }));

    build.onLoad({ filter: /.*/, namespace: 'poly' }, (args) => {
      const stubs = {
        fs: fsPolyfill,
        path: pathPolyfill,
        module: `export function createRequire() { return function() { return {}; }; } export default { createRequire };`,
      };
      return { contents: stubs[args.path] || 'export default {};', loader: 'js' };
    });

    build.onLoad({ filter: /.*/, namespace: 'node-stub' }, (args) => {
      const stubs = {
        'node:async_hooks': `
class AsyncLocalStorage { constructor() { this._store = undefined; } run(store, fn) { const p = this._store; this._store = store; try { return fn(); } finally { this._store = p; } } getStore() { return this._store; } }
export { AsyncLocalStorage }; export default { AsyncLocalStorage };`,
        'node:process': `const p = typeof globalThis.process !== 'undefined' ? {...globalThis.process} : { env: {} }; if (!p.cwd) p.cwd = () => '/app'; export default p;`,
        'node:url': `export function fileURLToPath(u) { return u.replace('file://', ''); } export default { fileURLToPath };`,
        'node:os': `export function platform() { return 'linux'; } export default { platform };`,
        'node:stream': `
export class Readable { constructor() {} static from(data) { return new Readable(); } pipe() { return this; } on() { return this; } }
export class Writable { constructor() {} write() {} end() {} on() { return this; } }
export class Transform extends Readable { constructor() { super(); } }
export class PassThrough extends Transform {}
export default { Readable, Writable, Transform, PassThrough };`,
        'node:querystring': `
export function parse(str) { const obj = {}; if (!str) return obj; str.split('&').forEach(p => { const [k,v] = p.split('='); if(k) obj[decodeURIComponent(k)] = v ? decodeURIComponent(v) : ''; }); return obj; }
export function stringify(obj) { return Object.entries(obj||{}).map(([k,v]) => encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&'); }
export default { parse, stringify };`,
        'node:http': `export default {};`,
        'node:timers': `
export function setImmediate(fn) { return setTimeout(fn, 0); }
export default { setImmediate };`,
        'node:crypto': `export function randomUUID() { return crypto.randomUUID(); } export default { randomUUID };`,
        'node:buffer': `export const Buffer = globalThis.Buffer || { from: (s) => new TextEncoder().encode(s), alloc: (n) => new Uint8Array(n) }; export default { Buffer };`,
      };
      return { contents: stubs[args.path] || 'export default {};', loader: 'js' };
    });
  }
};

await esbuild.build({
  entryPoints: ['svelte-workerd/worker.js'],
  bundle: true,
  outfile: 'svelte-workerd/worker-bundle.js',
  format: 'esm',
  platform: 'browser',
  target: 'esnext',
  plugins: [nodePolyfillPlugin],
  nodePaths: ['svelte/node_modules'],
  define: {
    'process.env.DB_DELAY_ENABLED': '"true"',
    'process.env.DB_DELAY_MIN': '"1"',
    'process.env.DB_DELAY_MAX': '"5"',
    'process.env.NODE_ENV': '"production"',
    
    'process.env.ORIGIN': '""',
    'process.env.PORT': '"3000"',
  },
  banner: { js: 'if (typeof globalThis.process === "undefined") globalThis.process = { env: {}, cwd: () => "/app" }; if (!globalThis.process.cwd) globalThis.process.cwd = () => "/app";' },
  minify: true,
  logLevel: 'info',
});

const size = fs.statSync('svelte-workerd/worker-bundle.js').size;
console.log(`Bundle: ${(size / 1024 / 1024).toFixed(1)}MB`);
