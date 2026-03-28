import * as fs from 'node:fs';
import * as path from 'node:path';

interface SortOptions<T> {
  field: keyof T;
  order: 'asc' | 'desc';
}

interface PaginationOptions<T> {
  page?: number;
  limit?: number;
  filter?: Partial<T>;
  sort?: SortOptions<T>;
}

class JsonDatabase {
  private cache = new Map<string, unknown[]>();
  private dataDir: string;
  private delayMin: number;
  private delayMax: number;
  private delayEnabled: boolean;
  private initialized = false;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || this.findDataDir();
    this.delayMin = parseInt(process.env.DB_DELAY_MIN || '1', 10);
    this.delayMax = parseInt(process.env.DB_DELAY_MAX || '5', 10);
    this.delayEnabled = process.env.DB_DELAY_ENABLED !== 'false';
  }

  private findDataDir(): string {
    const dirname = typeof import.meta.dirname === 'string' ? import.meta.dirname : process.cwd();
    const candidates = [
      path.join(process.cwd(), 'data'),
      path.join(process.cwd(), '..', 'data'),
      path.join(dirname, '..', 'data'),
      path.join(dirname, 'data'),
    ];
    for (const dir of candidates) {
      if (fs.existsSync(path.join(dir, 'games.json'))) return dir;
    }
    return path.join(process.cwd(), 'data');
  }

  private async delay(): Promise<void> {
    if (!this.delayEnabled) return;
    const ms = Math.floor(Math.random() * (this.delayMax - this.delayMin + 1) + this.delayMin);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async loadCollection<T>(name: string): Promise<T[]> {
    if (this.cache.has(name)) return this.cache.get(name) as T[];
    const filePath = path.join(this.dataDir, name + '.json');
    if (!fs.existsSync(filePath)) return [];
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    this.cache.set(name, data);
    return data as T[];
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.loadCollection('games');
    await this.loadCollection('sets');
    await this.loadCollection('cards');
    await this.loadCollection('sellers');
    await this.loadCollection('listings');
    await this.loadCollection('featured');
    this.initialized = true;
  }

  async getGames(): Promise<any[]> {
    await this.delay();
    return this.loadCollection('games');
  }

  async getGameBySlug(slug: string): Promise<any | undefined> {
    await this.delay();
    const games = await this.loadCollection<any>('games');
    return games.find((g) => g.slug === slug);
  }

  async getGameWithSets(slug: string): Promise<any | undefined> {
    await this.delay();
    const game = await this.getGameBySlug(slug);
    if (!game) return undefined;
    const allSets = await this.loadCollection<any>('sets');
    const sets = allSets.filter((s) => s.gameId === game.id);
    return { ...game, sets };
  }

  async getSets(gameId?: string): Promise<any[]> {
    await this.delay();
    const sets = await this.loadCollection<any>('sets');
    return gameId ? sets.filter((s) => s.gameId === gameId) : sets;
  }

  async getSetBySlug(slug: string): Promise<any | undefined> {
    await this.delay();
    const sets = await this.loadCollection<any>('sets');
    return sets.find((s) => s.slug === slug);
  }

  async getSetWithCards(slug: string, page = 1, limit = 24): Promise<any | undefined> {
    await this.delay();
    const set = await this.getSetBySlug(slug);
    if (!set) return undefined;
    const games = await this.loadCollection<any>('games');
    const game = games.find((g) => g.id === set.gameId);
    if (!game) return undefined;
    const allCards = await this.loadCollection<any>('cards');
    const setCards = allCards.filter((c) => c.setId === set.id);
    const total = setCards.length;
    const start = (page - 1) * limit;
    const cards = setCards.slice(start, start + limit);
    return { ...set, cards, game, total, totalPages: Math.ceil(total / limit) };
  }

  async getCardById(id: string): Promise<any | undefined> {
    await this.delay();
    const cards = await this.loadCollection<any>('cards');
    return cards.find((c) => c.id === id);
  }

  async getCardWithListings(id: string): Promise<any | undefined> {
    await this.delay();
    const card = await this.getCardById(id);
    if (!card) return undefined;
    const allListings = await this.loadCollection<any>('listings');
    const listings = allListings.filter((l) => l.cardId === id);
    const lowestPrice = listings.length > 0 ? Math.min(...listings.map((l) => l.price)) : undefined;
    return { ...card, listings, lowestPrice, listingCount: listings.length };
  }

  async getSellers(): Promise<any[]> {
    await this.delay();
    return this.loadCollection('sellers');
  }

  async getSellerBySlug(slug: string): Promise<any | undefined> {
    await this.delay();
    const sellers = await this.loadCollection<any>('sellers');
    return sellers.find((s) => s.slug === slug);
  }

  async getSellerWithListings(slug: string, page = 1, limit = 20): Promise<any | undefined> {
    await this.delay();
    const seller = await this.getSellerBySlug(slug);
    if (!seller) return undefined;
    const allListings = await this.loadCollection<any>('listings');
    const sellerListings = allListings.filter((l) => l.sellerId === seller.id);
    const total = sellerListings.length;
    const start = (page - 1) * limit;
    const listings = sellerListings.slice(start, start + limit);
    return { ...seller, listings, total, totalPages: Math.ceil(total / limit) };
  }

  async getTrendingCards(limit = 10): Promise<any[]> {
    await this.delay();
    const featured = await this.getFeatured();
    if (!featured) return [];
    const trendingIds = featured.trendingCards.slice(0, limit);
    const cards = await this.loadCollection<any>('cards');
    return cards.filter((c) => trendingIds.includes(c.id));
  }

  async getNewReleaseSets(limit = 5): Promise<any[]> {
    await this.delay();
    const featured = await this.getFeatured();
    if (!featured) return [];
    const releaseIds = featured.newReleases.slice(0, limit);
    const sets = await this.loadCollection<any>('sets');
    return sets.filter((s) => releaseIds.includes(s.id));
  }

  async getFeatured(): Promise<any | null> {
    await this.delay();
    const data = await this.loadCollection<any>('featured');
    if (Array.isArray(data)) return data[0] || null;
    return data;
  }

  async searchCards(params: any): Promise<any> {
    await this.delay();
    const { q, game, sort, order = 'asc', page = 1, limit = 24 } = params;
    let cards = await this.loadCollection<any>('cards');

    if (game) {
      const games = await this.loadCollection<any>('games');
      const gameObj = games.find((g) => g.slug === game);
      if (gameObj) cards = cards.filter((c) => c.gameId === gameObj.id);
    }

    if (q) {
      const lowerQ = q.toLowerCase();
      cards = cards.filter((c) =>
        c.name.toLowerCase().includes(lowerQ) ||
        c.type.toLowerCase().includes(lowerQ) ||
        c.rarity.toLowerCase().includes(lowerQ)
      );
    }

    if (sort === 'name') {
      cards = [...cards].sort((a, b) => order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    }

    const total = cards.length;
    const start = (page - 1) * limit;
    const items = cards.slice(start, start + limit);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findMany<T extends { id: string }>(collection: string, ids: string[]): Promise<T[]> {
    await this.delay();
    const data = await this.loadCollection<T>(collection);
    const idSet = new Set(ids);
    return data.filter((item) => idSet.has(item.id));
  }
}

export const db = new JsonDatabase();
