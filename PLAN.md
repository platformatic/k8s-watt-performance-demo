# E-commerce Benchmark Transformation Plan

Transform the existing benchmark applications into realistic e-commerce applications inspired by TCGPlayer.com (trading card game marketplace).

## Overview

Each framework (Next.js, React Router, TanStack) will be transformed into a **Trading Card Marketplace** with:
- Product catalog with cards, sets, and categories
- Multi-seller pricing (same card, different sellers/conditions)
- Search and filtering capabilities
- Shopping cart functionality
- JSON file-based database with configurable latency

**All frameworks use TypeScript.**

---

## 1. Data Models & JSON Database

### Directory Structure (per framework)
```
{framework}/
├── data/
│   ├── games.json          # Game categories (Pokemon, Magic, Yu-Gi-Oh, etc.)
│   ├── sets.json           # Card sets/expansions per game
│   ├── cards.json          # Individual cards with metadata
│   ├── sellers.json        # Marketplace sellers
│   ├── listings.json       # Card listings (price, condition, seller, stock)
│   └── featured.json       # Featured/promoted items for homepage
```

### Data Schemas

#### `games.json`
```json
[
  {
    "id": "pokemon",
    "name": "Pokemon",
    "slug": "pokemon",
    "description": "Pokemon Trading Card Game",
    "imageUrl": "/images/games/pokemon.png",
    "cardCount": 15000
  }
]
```

#### `sets.json`
```json
[
  {
    "id": "sv08",
    "gameId": "pokemon",
    "name": "Surging Sparks",
    "slug": "surging-sparks",
    "releaseDate": "2024-11-08",
    "totalCards": 191,
    "imageUrl": "/images/sets/sv08.png"
  }
]
```

#### `cards.json`
```json
[
  {
    "id": "sv08-001",
    "setId": "sv08",
    "gameId": "pokemon",
    "name": "Pikachu ex",
    "number": "001/191",
    "rarity": "Double Rare",
    "type": "Pokemon",
    "imageUrl": "/images/cards/sv08-001.png",
    "attributes": {
      "hp": 200,
      "types": ["Lightning"],
      "artist": "PLANETA Tsuji"
    }
  }
]
```

#### `sellers.json`
```json
[
  {
    "id": "seller-001",
    "name": "CardKingdom",
    "slug": "cardkingdom",
    "rating": 4.9,
    "salesCount": 125000,
    "location": "Seattle, WA"
  }
]
```

#### `listings.json`
```json
[
  {
    "id": "listing-001",
    "cardId": "sv08-001",
    "sellerId": "seller-001",
    "condition": "Near Mint",
    "price": 24.99,
    "quantity": 5,
    "language": "English",
    "isFoil": false
  }
]
```

#### `featured.json`
```json
{
  "banners": [...],
  "trendingCards": ["sv08-001", "sv08-025", ...],
  "newReleases": ["sv08", "sv07", ...],
  "popularGames": ["pokemon", "magic", ...]
}
```

### Data Generation Script

Create a shared script to generate realistic test data:

```
lib/
├── generate-data.ts        # TypeScript script to generate JSON files
└── data-templates/         # Template data for generation
```

**Generation targets:**
- 5 games
- 50 sets (10 per game)
- 10,000 cards (200 per set)
- 100 sellers
- 100,000 listings (10 listings per card average)
- Featured content

---

## 2. Database Layer with Configurable Delay

### Implementation (`lib/db.ts`)

```typescript
// Environment variables
// DB_DELAY_MIN=1        (minimum delay in ms, default: 1)
// DB_DELAY_MAX=5        (maximum delay in ms, default: 5)
// DB_DELAY_ENABLED=true (enable/disable delay, default: true)

interface PaginationOptions<T> {
  page?: number;
  limit?: number;
  filter?: Partial<T>;
  sort?: { field: keyof T; order: 'asc' | 'desc' };
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class JsonDatabase {
  private cache = new Map<string, unknown[]>();
  private delayMin: number;
  private delayMax: number;
  private delayEnabled: boolean;

  constructor() {
    this.delayMin = parseInt(process.env.DB_DELAY_MIN || '1');
    this.delayMax = parseInt(process.env.DB_DELAY_MAX || '5');
    this.delayEnabled = process.env.DB_DELAY_ENABLED !== 'false';
  }

  private async delay(): Promise<void> {
    if (!this.delayEnabled) return;
    const ms = Math.floor(
      Math.random() * (this.delayMax - this.delayMin + 1) + this.delayMin
    );
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async query<T>(collection: string, filter?: Partial<T>): Promise<T[]> {
    await this.delay();
    const data = this.loadCollection<T>(collection);
    return filter ? this.applyFilter(data, filter) : data;
  }

  async findById<T extends { id: string }>(collection: string, id: string): Promise<T | undefined> {
    await this.delay();
    const data = this.loadCollection<T>(collection);
    return data.find(item => item.id === id);
  }

  async findMany<T extends { id: string }>(collection: string, ids: string[]): Promise<T[]> {
    await this.delay();
    const data = this.loadCollection<T>(collection);
    return data.filter(item => ids.includes(item.id));
  }

  async paginate<T>(
    collection: string,
    options: PaginationOptions<T> = {}
  ): Promise<PaginatedResult<T>> {
    await this.delay();
    const { page = 1, limit = 20, filter, sort } = options;
    let data = this.loadCollection<T>(collection);
    if (filter) data = this.applyFilter(data, filter);
    if (sort) data = this.applySort(data, sort);
    const total = data.length;
    const start = (page - 1) * limit;
    const items = data.slice(start, start + limit);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  private loadCollection<T>(name: string): T[] {
    // Implementation: load from JSON file with caching
  }

  private applyFilter<T>(data: T[], filter: Partial<T>): T[] {
    // Implementation: filter data by partial match
  }

  private applySort<T>(data: T[], sort: { field: keyof T; order: 'asc' | 'desc' }): T[] {
    // Implementation: sort data
  }
}

export const db = new JsonDatabase();
```

### Environment Variables for Kubernetes

Add to `kube.yaml` for each deployment:
```yaml
env:
  - name: DB_DELAY_MIN
    value: "1"
  - name: DB_DELAY_MAX
    value: "5"
  - name: DB_DELAY_ENABLED
    value: "true"
```

---

## 3. TypeScript Types (Shared)

### `types/index.ts`

```typescript
export interface Game {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  cardCount: number;
}

export interface CardSet {
  id: string;
  gameId: string;
  name: string;
  slug: string;
  releaseDate: string;
  totalCards: number;
  imageUrl: string;
}

export interface Card {
  id: string;
  setId: string;
  gameId: string;
  name: string;
  number: string;
  rarity: string;
  type: string;
  imageUrl: string;
  attributes: Record<string, unknown>;
}

export interface Seller {
  id: string;
  name: string;
  slug: string;
  rating: number;
  salesCount: number;
  location: string;
}

export interface Listing {
  id: string;
  cardId: string;
  sellerId: string;
  condition: 'Near Mint' | 'Lightly Played' | 'Moderately Played' | 'Heavily Played' | 'Damaged';
  price: number;
  quantity: number;
  language: string;
  isFoil: boolean;
}

export interface Featured {
  banners: { id: string; imageUrl: string; link: string }[];
  trendingCards: string[];
  newReleases: string[];
  popularGames: string[];
}

export interface CartItem {
  listingId: string;
  quantity: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

---

## 4. API Routes

### Endpoints (implement in each framework)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/games` | List all games |
| GET | `/api/games/:slug` | Get game details with sets |
| GET | `/api/sets` | List sets (with game filter) |
| GET | `/api/sets/:slug` | Get set details with cards |
| GET | `/api/cards` | Search/filter cards (paginated) |
| GET | `/api/cards/:id` | Get card details with listings |
| GET | `/api/listings` | Get listings (with filters) |
| GET | `/api/sellers` | List sellers |
| GET | `/api/sellers/:slug` | Get seller details with listings |
| GET | `/api/search` | Full-text search across cards |
| GET | `/api/featured` | Get homepage featured content |
| POST | `/api/cart` | Add item to cart (session-based) |
| GET | `/api/cart` | Get cart contents |
| DELETE | `/api/cart/:id` | Remove item from cart |

### Query Parameters

**`/api/cards`:**
- `game` - Filter by game slug
- `set` - Filter by set slug
- `rarity` - Filter by rarity
- `minPrice` - Minimum price filter
- `maxPrice` - Maximum price filter
- `q` - Search query
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `sort` - Sort field (price, name, date)
- `order` - Sort order (asc, desc)

---

## 5. Page Routes

### Pages to Implement

| Route | Description | Data Requirements |
|-------|-------------|-------------------|
| `/` | Homepage | Featured content, trending, new releases |
| `/games` | All games listing | Games list |
| `/games/:slug` | Game detail | Game + sets + popular cards |
| `/sets/:slug` | Set detail | Set + cards (paginated) |
| `/cards/:id` | Card detail | Card + all listings + seller info |
| `/search` | Search results | Cards (paginated, filtered) |
| `/sellers` | Sellers directory | Sellers list |
| `/sellers/:slug` | Seller storefront | Seller + listings |
| `/cart` | Shopping cart | Cart items + totals |

### Page Components (shared across frameworks)

```
components/
├── layout/
│   ├── Header.tsx          # Navigation, search bar, cart icon
│   ├── Footer.tsx          # Site links, info
│   └── Sidebar.tsx         # Filters for search/browse
├── cards/
│   ├── CardGrid.tsx        # Grid of card thumbnails
│   ├── CardItem.tsx        # Individual card in grid
│   ├── CardDetail.tsx      # Full card view
│   └── CardFilters.tsx     # Filter controls
├── listings/
│   ├── ListingTable.tsx    # Price/seller table
│   └── ListingRow.tsx      # Individual listing
├── cart/
│   ├── CartSummary.tsx     # Cart totals
│   └── CartItem.tsx        # Item in cart
└── common/
    ├── Pagination.tsx      # Pagination controls
    ├── SearchBar.tsx       # Search input
    ├── PriceDisplay.tsx    # Formatted price
    └── RarityBadge.tsx     # Rarity indicator
```

---

## 6. Framework-Specific Implementation

### Next.js (`next/`) - TypeScript

**Structure:**
```
next/
├── src/
│   ├── app/
│   │   ├── page.tsx                   # Homepage
│   │   ├── layout.tsx                 # Root layout
│   │   ├── games/
│   │   │   ├── page.tsx               # Games list
│   │   │   └── [slug]/page.tsx        # Game detail
│   │   ├── sets/
│   │   │   └── [slug]/page.tsx        # Set detail
│   │   ├── cards/
│   │   │   └── [id]/page.tsx          # Card detail
│   │   ├── search/page.tsx            # Search results
│   │   ├── sellers/
│   │   │   ├── page.tsx               # Sellers list
│   │   │   └── [slug]/page.tsx        # Seller detail
│   │   ├── cart/page.tsx              # Shopping cart
│   │   └── api/
│   │       ├── games/route.ts
│   │       ├── games/[slug]/route.ts
│   │       ├── sets/route.ts
│   │       ├── sets/[slug]/route.ts
│   │       ├── cards/route.ts
│   │       ├── cards/[id]/route.ts
│   │       ├── listings/route.ts
│   │       ├── sellers/route.ts
│   │       ├── sellers/[slug]/route.ts
│   │       ├── search/route.ts
│   │       ├── featured/route.ts
│   │       └── cart/route.ts
│   ├── components/                    # Shared components
│   ├── lib/
│   │   └── db.ts                      # Database layer
│   └── types/
│       └── index.ts                   # Shared types
├── data/                              # JSON data files
├── public/images/                     # Static images
└── tsconfig.json                      # TypeScript config
```

**Implementation notes:**
- Use App Router with Server Components
- API routes use Route Handlers
- Server Components fetch data directly
- Client components for interactivity (cart, filters)
- Full TypeScript throughout

### React Router (`react-router/`) - TypeScript

**Structure:**
```
react-router/
├── app/
│   ├── root.tsx                       # Root layout
│   ├── routes.ts                      # Route definitions
│   ├── routes/
│   │   ├── home.tsx                   # Homepage
│   │   ├── games.tsx                  # Games list
│   │   ├── games.$slug.tsx            # Game detail
│   │   ├── sets.$slug.tsx             # Set detail
│   │   ├── cards.$id.tsx              # Card detail
│   │   ├── search.tsx                 # Search results
│   │   ├── sellers.tsx                # Sellers list
│   │   ├── sellers.$slug.tsx          # Seller detail
│   │   └── cart.tsx                   # Shopping cart
│   ├── components/                    # Shared components
│   ├── lib/
│   │   └── db.ts                      # Database layer
│   └── types/
│       └── index.ts                   # Shared types
├── server.ts                          # Express server with API routes
├── data/                              # JSON data files
├── public/images/                     # Static images
└── tsconfig.json                      # TypeScript config
```

**Implementation notes:**
- Use loaders for data fetching
- API routes in Express server
- Actions for mutations (cart operations)

### TanStack Start (`tanstack/`) - TypeScript

**Structure:**
```
tanstack/
├── src/
│   ├── routes/
│   │   ├── __root.tsx                 # Root layout
│   │   ├── index.tsx                  # Homepage
│   │   ├── games.tsx                  # Games layout
│   │   ├── games.index.tsx            # Games list
│   │   ├── games.$slug.tsx            # Game detail
│   │   ├── sets.$slug.tsx             # Set detail
│   │   ├── cards.$id.tsx              # Card detail
│   │   ├── search.tsx                 # Search results
│   │   ├── sellers.tsx                # Sellers layout
│   │   ├── sellers.index.tsx          # Sellers list
│   │   ├── sellers.$slug.tsx          # Seller detail
│   │   ├── cart.tsx                   # Shopping cart
│   │   └── api/
│   │       ├── games.ts
│   │       ├── games.$slug.ts
│   │       ├── sets.ts
│   │       ├── sets.$slug.ts
│   │       ├── cards.ts
│   │       ├── cards.$id.ts
│   │       ├── listings.ts
│   │       ├── sellers.ts
│   │       ├── sellers.$slug.ts
│   │       ├── search.ts
│   │       ├── featured.ts
│   │       └── cart.ts
│   ├── components/                    # Shared components
│   ├── lib/
│   │   └── db.ts                      # Database layer
│   ├── types/
│   │   └── index.ts                   # Shared types
│   └── styles/
├── data/                              # JSON data files
├── public/images/                     # Static images
└── tsconfig.json                      # TypeScript config
```

**Implementation notes:**
- Use TanStack Router loaders
- API routes as server functions
- Type-safe routing throughout

---

## 7. Load Testing Updates

### Update `loadtest.sh` for Each Framework

Test realistic user journeys:

```javascript
// k6 test scenarios
export const options = {
  scenarios: {
    // Browse homepage
    homepage: {
      executor: 'constant-arrival-rate',
      rate: 200,
      duration: '2m',
      exec: 'browseHomepage',
    },
    // Search for cards
    search: {
      executor: 'constant-arrival-rate',
      rate: 300,
      duration: '2m',
      exec: 'searchCards',
    },
    // View card details
    cardDetail: {
      executor: 'constant-arrival-rate',
      rate: 400,
      duration: '2m',
      exec: 'viewCardDetail',
    },
    // Browse by game/set
    browseCatalog: {
      executor: 'constant-arrival-rate',
      rate: 100,
      duration: '2m',
      exec: 'browseCatalog',
    },
  },
};

export function browseHomepage() {
  http.get(`${BASE_URL}/`);
  http.get(`${BASE_URL}/api/featured`);
}

export function searchCards() {
  const queries = ['pikachu', 'charizard', 'rare', 'ex'];
  const q = queries[Math.floor(Math.random() * queries.length)];
  http.get(`${BASE_URL}/api/cards?q=${q}&limit=20`);
}

export function viewCardDetail() {
  // Random card ID from pool
  const cardId = `sv08-${String(Math.floor(Math.random() * 191) + 1).padStart(3, '0')}`;
  http.get(`${BASE_URL}/api/cards/${cardId}`);
}

export function browseCatalog() {
  http.get(`${BASE_URL}/api/games`);
  http.get(`${BASE_URL}/api/games/pokemon`);
  http.get(`${BASE_URL}/api/sets?game=pokemon`);
}
```

---

## 8. Implementation Order

### Phase 1: Foundation
1. [x] Create data generation script (`lib/generate-data.ts`)
2. [x] Generate sample JSON data files
3. [x] Implement shared database layer with configurable delay
4. [x] Create placeholder images (or use placeholder service)
5. [x] Define shared TypeScript types

### Phase 2: Next.js Implementation
6. [x] Convert project to TypeScript
7. [x] Implement API routes
8. [x] Implement page routes with Server Components
9. [x] Add shared components
10. [x] Test locally
11. [x] Update Dockerfile if needed
12. [x] Update load test script

### Phase 3: React Router Implementation
13. [x] Implement API routes in server.ts
14. [x] Implement page routes with loaders
15. [x] Add shared components
16. [x] Test locally
17. [x] Update Dockerfile if needed
18. [x] Update load test script

### Phase 4: TanStack Implementation
19. [x] Implement API routes as server functions
20. [x] Implement page routes with loaders
21. [x] Add shared components
22. [x] Test locally
23. [x] Update Dockerfile if needed
24. [x] Update load test script

### Phase 5: Integration & Testing
25. [x] Update Kubernetes manifests with DB env vars
26. [ ] Run local benchmarks for each framework
27. [ ] Deploy to EKS and run full benchmark suite
28. [ ] Document results and compare performance

---

## 9. Configuration & Environment

### New Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_DELAY_MIN` | Minimum simulated DB delay (ms) | `1` |
| `DB_DELAY_MAX` | Maximum simulated DB delay (ms) | `5` |
| `DB_DELAY_ENABLED` | Enable/disable DB delay | `true` |

### Updated `kube.yaml` Template

```yaml
env:
  - name: SCRIPT_NAME
    value: "start:node"
  - name: DB_DELAY_MIN
    value: "1"
  - name: DB_DELAY_MAX
    value: "5"
  - name: DB_DELAY_ENABLED
    value: "true"
```

---

## 10. Success Criteria

- [x] All three frameworks implement identical e-commerce functionality
- [x] All frameworks use TypeScript
- [x] JSON database with 10k+ cards, 100k+ listings loads efficiently
- [x] Configurable delay works correctly (1-5ms range)
- [x] All API endpoints return consistent data structure
- [x] All pages render correctly with real data
- [x] Load tests simulate realistic user behavior
- [ ] Benchmarks complete successfully on EKS
- [ ] Performance comparison data is collected for Node vs PM2 vs Watt

---

## 11. Notes

- **No external dependencies**: All data is self-contained in JSON files
- **Stateless design**: Cart uses session/cookie storage, no persistent state needed
- **Consistent across frameworks**: Same data, same APIs, same pages
- **Realistic workload**: Mix of read-heavy (browse, search) and write (cart) operations
- **Scalable data**: Can increase data volume for stress testing
- **TypeScript everywhere**: Full type safety across all frameworks
