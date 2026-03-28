import { games, sets, cards, sellers, listings, featured } from './data-bundle.js';

const virtualFS = {
  'games.json': JSON.stringify(games),
  'sets.json': JSON.stringify(sets),
  'cards.json': JSON.stringify(cards),
  'sellers.json': JSON.stringify(sellers),
  'listings.json': JSON.stringify(listings),
  'featured.json': JSON.stringify(featured),
};

export function readFileSync(filePath, encoding) {
  // Extract just the filename
  const parts = filePath.replace(/\\/g, '/').split('/');
  const filename = parts[parts.length - 1];
  
  if (virtualFS[filename] !== undefined) {
    return virtualFS[filename];
  }
  
  // For template and CSS files, they'll be inlined in the worker entry
  throw new Error(`readFileSync: file not found: ${filePath}`);
}

export function existsSync(filePath) {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const filename = parts[parts.length - 1];
  return virtualFS[filename] !== undefined;
}

export function statSync() {
  return { isFile: () => true };
}

export default { readFileSync, existsSync, statSync };
