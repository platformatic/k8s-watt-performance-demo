export function join(...parts) {
  return parts.join('/').replace(/\/+/g, '/');
}

export function resolve(...parts) {
  return join(...parts);
}

export function extname(p) {
  const idx = p.lastIndexOf('.');
  return idx >= 0 ? p.slice(idx) : '';
}

export const dirname = '/app';
export const sep = '/';

export default { join, resolve, extname, dirname, sep };
