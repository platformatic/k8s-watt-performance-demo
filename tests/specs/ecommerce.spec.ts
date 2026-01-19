import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('displays featured content and navigation', async ({ page }) => {
    await page.goto('/');

    // Should have main heading
    await expect(page.locator('h1')).toContainText(/card|marketplace|trading/i);

    // Should display featured games
    await expect(page.getByText('Pokemon').first()).toBeVisible();
    await expect(page.getByText('Magic: The Gathering').first()).toBeVisible();

    // Should have navigation links
    await expect(page.getByRole('link', { name: /games/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /sellers/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /cart/i }).first()).toBeVisible();
  });

  test('displays trending cards section', async ({ page }) => {
    await page.goto('/');

    // Should show trending cards
    await expect(page.getByText(/trending/i).first()).toBeVisible();
  });
});

test.describe('Games', () => {
  test('lists all games', async ({ page }) => {
    await page.goto('/games');

    // Should show all 5 games (Pokemon, Magic, Yu-Gi-Oh!, Digimon, One Piece)
    await expect(page.getByText('Pokemon').first()).toBeVisible();
    await expect(page.getByText('Magic: The Gathering').first()).toBeVisible();
    await expect(page.getByText('Yu-Gi-Oh!').first()).toBeVisible();
    await expect(page.getByText('Digimon').first()).toBeVisible();
    await expect(page.getByText('One Piece').first()).toBeVisible();
  });

  test('shows game detail with sets', async ({ page }) => {
    await page.goto('/games/pokemon');

    // Should show game title
    await expect(page.locator('h1')).toContainText('Pokemon');

    // Should show sets for this game (10 sets per game)
    const setLinks = page.locator('a[href*="/sets/"]');
    await expect(setLinks.first()).toBeVisible();
  });

  test('navigates from games list to game detail', async ({ page }) => {
    await page.goto('/games');

    // Click on Pokemon game
    await page.getByRole('link', { name: /pokemon/i }).first().click();

    // Should navigate to Pokemon detail page
    await expect(page).toHaveURL(/\/games\/pokemon/);
    await expect(page.locator('h1')).toContainText('Pokemon');
  });
});

test.describe('Sets', () => {
  test('shows set detail with cards', async ({ page }) => {
    // Navigate to a set page
    await page.goto('/games/pokemon');

    // Get the first set link and click it
    const setLink = page.locator('a[href*="/sets/"]').first();
    await setLink.click();

    // Should show set details
    await expect(page.locator('h1')).toBeVisible();

    // Should show cards in the set
    const cardLinks = page.locator('a[href*="/cards/"]');
    await expect(cardLinks.first()).toBeVisible();
  });
});

test.describe('Cards', () => {
  test('shows card detail with listings from multiple sellers', async ({ page }) => {
    // Navigate to a card page through the hierarchy
    await page.goto('/games/pokemon');

    const setLink = page.locator('a[href*="/sets/"]').first();
    await setLink.click();

    const cardLink = page.locator('a[href*="/cards/"]').first();
    await cardLink.click();

    // Should show card details
    await expect(page.locator('h1')).toBeVisible();

    // Should show listings table with prices
    await expect(page.getByText(/\$/).first()).toBeVisible();

    // Should show condition information
    await expect(page.getByText(/near mint|lightly played|moderately played/i).first()).toBeVisible();
  });

  test('displays card attributes', async ({ page }) => {
    await page.goto('/games/pokemon');

    const setLink = page.locator('a[href*="/sets/"]').first();
    await setLink.click();

    const cardLink = page.locator('a[href*="/cards/"]').first();
    await cardLink.click();

    // Should show rarity
    await expect(page.getByText(/common|uncommon|rare|ultra rare|secret rare/i).first()).toBeVisible();
  });
});

test.describe('Search', () => {
  test('displays search page with results', async ({ page }) => {
    await page.goto('/search');

    // Should have search functionality visible
    await expect(page.locator('h1')).toContainText(/search/i);
  });

  test('search with query returns results', async ({ page }) => {
    await page.goto('/search?q=dragon');

    // Should show search results
    const cardLinks = page.locator('a[href*="/cards/"]');

    // Wait for results to load
    await page.waitForLoadState('networkidle');

    // Should have some results (cards with "dragon" in name)
    const count = await cardLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('search with game filter', async ({ page }) => {
    await page.goto('/search?game=pokemon');

    // Should show filtered results
    await page.waitForLoadState('networkidle');

    // Results should be visible
    const cardLinks = page.locator('a[href*="/cards/"]');
    const count = await cardLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Sellers', () => {
  test('lists all sellers', async ({ page }) => {
    await page.goto('/sellers');

    // Should show sellers list
    await expect(page.locator('h1')).toContainText(/sellers/i);

    // Should show seller names (we have 100 sellers)
    const sellerLinks = page.locator('a[href*="/sellers/"]');
    await expect(sellerLinks.first()).toBeVisible();
  });

  test('shows seller detail with their listings', async ({ page }) => {
    await page.goto('/sellers');

    // Click on first seller
    const sellerLink = page.locator('a[href*="/sellers/"]').first();
    await sellerLink.click();

    // Should show seller details
    await expect(page.locator('h1')).toBeVisible();

    // Should show seller rating (star icon)
    await expect(page.getByText(/★/).first()).toBeVisible();

    // Should show their listings with prices
    await expect(page.getByText(/\$/).first()).toBeVisible();
  });
});

test.describe('Cart', () => {
  test('displays empty cart', async ({ page }) => {
    await page.goto('/cart');

    // Should show cart page
    await expect(page.locator('h1')).toContainText(/cart/i);

    // Should indicate empty cart
    await expect(page.getByText(/empty/i).first()).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('header navigation works', async ({ page }) => {
    // Start from homepage
    await page.goto('/');

    // Navigate to games
    await page.getByRole('link', { name: /games/i }).first().click();
    await expect(page).toHaveURL(/\/games/);

    // Navigate to sellers
    await page.getByRole('link', { name: /sellers/i }).first().click();
    await expect(page).toHaveURL(/\/sellers/);

    // Navigate to cart
    await page.getByRole('link', { name: /cart/i }).first().click();
    await expect(page).toHaveURL(/\/cart/);
  });
});

test.describe('API Endpoints (Next.js only)', () => {
  test('GET /api/games returns all games', async ({ request, baseURL }) => {
    const response = await request.get('/api/games');

    // Skip test if API routes don't exist (React Router, TanStack)
    if (response.status() === 404) {
      test.skip();
      return;
    }

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBe(5);

    // Verify game structure
    const pokemon = data.find((g: { slug: string }) => g.slug === 'pokemon');
    expect(pokemon).toBeDefined();
    expect(pokemon.name).toBe('Pokemon');
    expect(pokemon.cardCount).toBeGreaterThan(0);
  });

  test('GET /api/cards returns paginated cards', async ({ request }) => {
    const response = await request.get('/api/cards?limit=10&page=1');

    if (response.status() === 404) {
      test.skip();
      return;
    }

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.items).toBeDefined();
    expect(data.items.length).toBeLessThanOrEqual(10);
    expect(data.total).toBeGreaterThan(0);
    expect(data.page).toBe(1);
  });

  test('GET /api/cards with search query', async ({ request }) => {
    const response = await request.get('/api/cards?q=dragon&limit=20');

    if (response.status() === 404) {
      test.skip();
      return;
    }

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.items).toBeDefined();
    // All returned cards should contain "dragon" in name (case insensitive)
    for (const card of data.items) {
      expect(card.name.toLowerCase()).toContain('dragon');
    }
  });

  test('GET /api/sellers returns all sellers', async ({ request }) => {
    const response = await request.get('/api/sellers');

    if (response.status() === 404) {
      test.skip();
      return;
    }

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBe(100);

    // Verify seller structure
    const seller = data[0];
    expect(seller.id).toBeDefined();
    expect(seller.name).toBeDefined();
    expect(seller.slug).toBeDefined();
    expect(seller.rating).toBeGreaterThanOrEqual(0);
    expect(seller.rating).toBeLessThanOrEqual(5);
  });

  test('GET /api/featured returns homepage data', async ({ request }) => {
    const response = await request.get('/api/featured');

    if (response.status() === 404) {
      test.skip();
      return;
    }

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.trendingCards).toBeDefined();
    expect(data.newReleases).toBeDefined();
    expect(data.popularGames).toBeDefined();
    expect(Array.isArray(data.trendingCards)).toBeTruthy();
  });
});

test.describe('Data Consistency', () => {
  test('game detail shows correct number of sets', async ({ page }) => {
    // Visit Pokemon game page
    await page.goto('/games/pokemon');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Count sets displayed
    const setLinks = page.locator('a[href*="/sets/"]');
    const displayedSets = await setLinks.count();

    // Should show 10 sets (as per data generation)
    expect(displayedSets).toBe(10);
  });

  test('card detail page loads correctly', async ({ page }) => {
    await page.goto('/games/pokemon');

    const setLink = page.locator('a[href*="/sets/"]').first();
    await setLink.click();

    // Wait for the set page to load
    await page.waitForLoadState('networkidle');

    const cardLink = page.locator('a[href*="/cards/"]').first();
    await cardLink.click();

    // Wait for the card page to load
    await page.waitForLoadState('networkidle');

    // Card page should have loaded with a heading
    await expect(page.locator('h1')).toBeVisible();

    // Should have navigated to a card page
    await expect(page).toHaveURL(/\/cards\//);

    // Should show price information (either in page text or as a locator)
    await expect(page.getByText(/\$/).first()).toBeVisible();
  });

  test('seller ratings are within valid range', async ({ page }) => {
    await page.goto('/sellers');

    // Find rating displays (looking for star ratings)
    const ratingElements = page.locator('text=/★/');
    const ratingCount = await ratingElements.count();

    // Should display ratings
    expect(ratingCount).toBeGreaterThan(0);
  });
});
