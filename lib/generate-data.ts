#!/usr/bin/env npx tsx
/**
 * Data Generation Script for E-commerce Benchmark
 *
 * Generates realistic JSON data for the trading card marketplace:
 * - 5 games
 * - 50 sets (10 per game)
 * - 10,000 cards (200 per set)
 * - 100 sellers
 * - 100,000 listings (10 per card average)
 * - Featured content
 *
 * Usage: npx tsx lib/generate-data.ts [output-dir]
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Game, CardSet, Card, Seller, Listing, Featured, Condition, CardAttributes } from './types';

// Seed for reproducible random data
let seed = 12345;
function seededRandom(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

function randomInt(min: number, max: number): number {
  return Math.floor(seededRandom() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  const value = seededRandom() * (max - min) + min;
  return Number(value.toFixed(decimals));
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(seededRandom() * arr.length)];
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Game definitions
const GAMES_DATA = [
  { id: 'pokemon', name: 'Pokemon', description: 'Pokemon Trading Card Game - Catch them all!' },
  { id: 'magic', name: 'Magic: The Gathering', description: 'The original trading card game' },
  { id: 'yugioh', name: 'Yu-Gi-Oh!', description: "It's time to duel!" },
  { id: 'digimon', name: 'Digimon', description: 'Digital Monsters Card Game' },
  { id: 'onepiece', name: 'One Piece', description: 'One Piece Card Game' },
];

// Set name templates per game
const SET_TEMPLATES: Record<string, string[]> = {
  pokemon: [
    'Scarlet & Violet', 'Paldea Evolved', 'Obsidian Flames', 'Paradox Rift',
    'Temporal Forces', 'Twilight Masquerade', 'Shrouded Fable', 'Stellar Crown',
    'Surging Sparks', 'Prismatic Evolutions'
  ],
  magic: [
    'Murders at Karlov Manor', 'Outlaws of Thunder Junction', 'Bloomburrow',
    'Duskmourn', 'Foundations', 'Aetherdrift', 'Tarkir Dragonstorm',
    'Final Fantasy', 'Modern Horizons 3', 'Assassin\'s Creed'
  ],
  yugioh: [
    'Phantom Nightmare', 'Legacy of Destruction', 'The Infinite Forbidden',
    'Rage of the Abyss', 'Supreme Darkness', 'Alliance Insight',
    'Crossover Breakers', 'Deck Build Pack', 'Duelist Nexus', 'Cyberstorm Access'
  ],
  digimon: [
    'Beginning Observer', 'Exceed Apocalypse', 'Adventure Box 3',
    'Versus Royal Knights', 'Xros Encounter', 'Double Diamond',
    'New Awakening', 'Great Legend', 'Battle of Omni', 'Next Adventure'
  ],
  onepiece: [
    'Romance Dawn', 'Paramount War', 'Pillars of Strength', 'Kingdoms of Intrigue',
    'Awakening of the New Era', 'Wings of the Captain', 'Memorial Collection',
    '500 Years in the Future', 'Two Legends', 'Royal Blood'
  ],
};

// Rarity types per game
const RARITIES: Record<string, string[]> = {
  pokemon: ['Common', 'Uncommon', 'Rare', 'Double Rare', 'Ultra Rare', 'Illustration Rare', 'Special Art Rare', 'Hyper Rare'],
  magic: ['Common', 'Uncommon', 'Rare', 'Mythic Rare', 'Special', 'Borderless', 'Extended Art', 'Showcase'],
  yugioh: ['Common', 'Rare', 'Super Rare', 'Ultra Rare', 'Secret Rare', 'Ultimate Rare', 'Ghost Rare', 'Starlight Rare'],
  digimon: ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Secret Rare', 'Alternative Art'],
  onepiece: ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Secret Rare', 'Leader', 'Special Art'],
};

// Card types per game
const CARD_TYPES: Record<string, string[]> = {
  pokemon: ['Pokemon', 'Trainer', 'Energy', 'Pokemon ex', 'Pokemon V', 'Pokemon VSTAR'],
  magic: ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land'],
  yugioh: ['Monster', 'Spell', 'Trap', 'Fusion', 'Synchro', 'Xyz', 'Link'],
  digimon: ['Digimon', 'Tamer', 'Option', 'Digi-Egg'],
  onepiece: ['Leader', 'Character', 'Event', 'Stage'],
};

// Pokemon names for card generation
const POKEMON_NAMES = [
  'Pikachu', 'Charizard', 'Blastoise', 'Venusaur', 'Mewtwo', 'Mew', 'Gengar', 'Alakazam',
  'Gyarados', 'Dragonite', 'Snorlax', 'Eevee', 'Jolteon', 'Flareon', 'Vaporeon', 'Espeon',
  'Umbreon', 'Leafeon', 'Glaceon', 'Sylveon', 'Lucario', 'Garchomp', 'Rayquaza', 'Giratina',
  'Dialga', 'Palkia', 'Arceus', 'Darkrai', 'Zoroark', 'Hydreigon', 'Zekrom', 'Reshiram',
  'Kyurem', 'Xerneas', 'Yveltal', 'Zygarde', 'Solgaleo', 'Lunala', 'Necrozma', 'Zeraora',
  'Zacian', 'Zamazenta', 'Eternatus', 'Calyrex', 'Koraidon', 'Miraidon', 'Terapagos', 'Pecharunt',
  'Bulbasaur', 'Charmander', 'Squirtle', 'Pidgey', 'Rattata', 'Spearow', 'Ekans', 'Sandshrew',
];

// Magic creature names
const MAGIC_NAMES = [
  'Arcane Signet', 'Sol Ring', 'Lightning Bolt', 'Counterspell', 'Dark Ritual', 'Giant Growth',
  'Llanowar Elves', 'Birds of Paradise', 'Shivan Dragon', 'Serra Angel', 'Lord of the Pit',
  'Wrath of God', 'Armageddon', 'Mind Twist', 'Ancestral Recall', 'Time Walk', 'Black Lotus',
  'Mox Pearl', 'Mox Sapphire', 'Mox Jet', 'Mox Ruby', 'Mox Emerald', 'Brainstorm', 'Ponder',
  'Thoughtseize', 'Fatal Push', 'Path to Exile', 'Swords to Plowshares', 'Force of Will',
  'Jace, the Mind Sculptor', 'Liliana of the Veil', 'Ragavan, Nimble Pilferer', 'Orcish Bowmasters',
];

// Yu-Gi-Oh card names
const YUGIOH_NAMES = [
  'Blue-Eyes White Dragon', 'Dark Magician', 'Red-Eyes Black Dragon', 'Exodia the Forbidden One',
  'Slifer the Sky Dragon', 'Obelisk the Tormentor', 'The Winged Dragon of Ra', 'Black Luster Soldier',
  'Buster Blader', 'Summoned Skull', 'Jinzo', 'Cyber Dragon', 'Stardust Dragon', 'Black Rose Dragon',
  'Number 39: Utopia', 'Firewall Dragon', 'Accesscode Talker', 'Ash Blossom & Joyous Spring',
  'Nibiru, the Primal Being', 'Infinite Impermanence', 'Called by the Grave', 'Pot of Prosperity',
  'Lightning Storm', 'Forbidden Droplet', 'Triple Tactics Talent', 'Change of Heart', 'Raigeki',
];

// Generic names for other games
const GENERIC_NAMES = [
  'Brave Warrior', 'Mystic Sage', 'Shadow Knight', 'Thunder Beast', 'Crystal Guardian',
  'Fire Phoenix', 'Ice Dragon', 'Storm Caller', 'Death Reaper', 'Light Angel',
  'Dark Emperor', 'Wind Rider', 'Earth Titan', 'Water Serpent', 'Void Walker',
  'Chaos Mage', 'Order Paladin', 'Nature Spirit', 'Tech Cyborg', 'Demon Lord',
];

const CARD_NAMES: Record<string, string[]> = {
  pokemon: POKEMON_NAMES,
  magic: MAGIC_NAMES,
  yugioh: YUGIOH_NAMES,
  digimon: GENERIC_NAMES.map(n => n.replace('Warrior', 'mon').replace('Knight', 'mon')),
  onepiece: ['Monkey D. Luffy', 'Roronoa Zoro', 'Nami', 'Usopp', 'Sanji', 'Tony Tony Chopper',
    'Nico Robin', 'Franky', 'Brook', 'Jinbe', 'Shanks', 'Whitebeard', 'Kaido', 'Big Mom',
    'Blackbeard', 'Trafalgar Law', 'Eustass Kid', 'Boa Hancock', 'Dracule Mihawk', 'Crocodile'],
};

// Artist names
const ARTISTS = [
  'PLANETA Tsuji', 'Mitsuhiro Arita', 'Ken Sugimori', 'Atsuko Nishida', 'Kouki Saitou',
  'Shin Nagasawa', 'Ryo Ueda', 'Naoki Saito', 'Akira Egawa', 'Kagemaru Himeno',
  'Hideaki Hakozaki', 'Tomokazu Komiya', 'Ayaka Yoshida', 'Souichirou Gunjima',
  'Studio Bora', 'AKIRA EGAWA', 'Teeziro', 'kawayoo', 'kodama', 'Saya Tsuruta',
];

// Seller name templates
const SELLER_PREFIXES = ['Card', 'Game', 'TCG', 'Trading', 'Collectible', 'Premium', 'Elite', 'Pro', 'Master', 'Super'];
const SELLER_SUFFIXES = ['Kingdom', 'Empire', 'House', 'Store', 'Shop', 'Market', 'Haven', 'World', 'Zone', 'Hub'];
const LOCATIONS = [
  'Seattle, WA', 'Los Angeles, CA', 'New York, NY', 'Chicago, IL', 'Houston, TX',
  'Phoenix, AZ', 'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA', 'Dallas, TX',
  'Austin, TX', 'Portland, OR', 'Denver, CO', 'Miami, FL', 'Atlanta, GA',
  'Boston, MA', 'Detroit, MI', 'Minneapolis, MN', 'Las Vegas, NV', 'Orlando, FL',
];

const CONDITIONS: Condition[] = ['Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged'];
const LANGUAGES = ['English', 'Japanese', 'Korean', 'Chinese', 'German', 'French', 'Italian', 'Spanish', 'Portuguese'];

// Generate games
function generateGames(): Game[] {
  return GAMES_DATA.map(g => ({
    id: g.id,
    name: g.name,
    slug: g.id,
    description: g.description,
    imageUrl: `/images/games/${g.id}.webp`,
    cardCount: 0, // Will be updated after cards are generated
  }));
}

// Generate sets
function generateSets(games: Game[]): CardSet[] {
  const sets: CardSet[] = [];
  const baseYear = 2020;

  for (const game of games) {
    const templates = SET_TEMPLATES[game.id];
    for (let i = 0; i < 10; i++) {
      const setNumber = String(i + 1).padStart(2, '0');
      const year = baseYear + Math.floor(i / 3);
      const month = ((i * 2) % 12) + 1;

      sets.push({
        id: `${game.id}-set-${setNumber}`,
        gameId: game.id,
        name: templates[i],
        slug: slugify(templates[i]),
        releaseDate: `${year}-${String(month).padStart(2, '0')}-01`,
        totalCards: 200,
        imageUrl: `/images/sets/${game.id}-set-${setNumber}.webp`,
      });
    }
  }

  return sets;
}

// Generate card attributes based on game
function generateCardAttributes(gameId: string, cardType: string): CardAttributes {
  switch (gameId) {
    case 'pokemon':
      if (cardType === 'Pokemon' || cardType.includes('Pokemon')) {
        return {
          hp: randomInt(3, 34) * 10,
          types: [randomElement(['Fire', 'Water', 'Grass', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Dragon', 'Colorless'])],
          artist: randomElement(ARTISTS),
        };
      }
      return { artist: randomElement(ARTISTS) };

    case 'magic':
      if (cardType === 'Creature') {
        return {
          attack: String(randomInt(0, 10)),
          defense: String(randomInt(0, 10)),
          artist: randomElement(ARTISTS),
        };
      }
      return { artist: randomElement(ARTISTS) };

    case 'yugioh':
      if (cardType === 'Monster' || ['Fusion', 'Synchro', 'Xyz', 'Link'].includes(cardType)) {
        return {
          attack: randomInt(0, 50) * 100,
          defense: randomInt(0, 50) * 100,
          level: randomInt(1, 12),
          artist: randomElement(ARTISTS),
        };
      }
      return { artist: randomElement(ARTISTS) };

    default:
      return { artist: randomElement(ARTISTS) };
  }
}

// Generate cards
function generateCards(sets: CardSet[]): Card[] {
  const cards: Card[] = [];

  for (const set of sets) {
    const gameId = set.gameId;
    const names = CARD_NAMES[gameId] || GENERIC_NAMES;
    const rarities = RARITIES[gameId];
    const types = CARD_TYPES[gameId];

    for (let i = 1; i <= 200; i++) {
      const cardNumber = String(i).padStart(3, '0');
      const baseName = names[(i - 1) % names.length];
      const suffix = i > names.length ? ` ${Math.ceil(i / names.length)}` : '';
      const cardType = randomElement(types);
      const rarity = i <= 100
        ? randomElement(rarities.slice(0, 3)) // Common/Uncommon/Rare for first half
        : randomElement(rarities); // Any rarity for second half

      cards.push({
        id: `${set.id}-${cardNumber}`,
        setId: set.id,
        gameId: gameId,
        name: `${baseName}${suffix}`,
        number: `${cardNumber}/${set.totalCards}`,
        rarity: rarity,
        type: cardType,
        imageUrl: `/images/cards/${set.id}-${cardNumber}.webp`,
        attributes: generateCardAttributes(gameId, cardType),
      });
    }
  }

  return cards;
}

// Generate sellers
function generateSellers(): Seller[] {
  const sellers: Seller[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < 100; i++) {
    let name: string;
    do {
      name = `${randomElement(SELLER_PREFIXES)} ${randomElement(SELLER_SUFFIXES)}`;
    } while (usedNames.has(name));
    usedNames.add(name);

    sellers.push({
      id: `seller-${String(i + 1).padStart(3, '0')}`,
      name: name,
      slug: slugify(name),
      rating: randomFloat(3.5, 5.0, 1),
      salesCount: randomInt(100, 500000),
      location: randomElement(LOCATIONS),
    });
  }

  return sellers;
}

// Generate listings
function generateListings(cards: Card[], sellers: Seller[]): Listing[] {
  const listings: Listing[] = [];
  let listingId = 1;

  for (const card of cards) {
    // Each card gets 5-15 listings
    const numListings = randomInt(5, 15);
    const selectedSellers = shuffleArray(sellers).slice(0, numListings);

    // Base price depends on rarity
    const rarityIndex = RARITIES[card.gameId]?.indexOf(card.rarity) ?? 0;
    const basePrice = Math.pow(2, rarityIndex) * randomFloat(0.5, 2);

    for (const seller of selectedSellers) {
      const condition = randomElement(CONDITIONS);
      const conditionMultiplier = {
        'Near Mint': 1.0,
        'Lightly Played': 0.85,
        'Moderately Played': 0.7,
        'Heavily Played': 0.5,
        'Damaged': 0.3,
      }[condition];

      const isFoil = seededRandom() < 0.15; // 15% chance of foil
      const foilMultiplier = isFoil ? randomFloat(1.5, 3) : 1;

      listings.push({
        id: `listing-${String(listingId++).padStart(6, '0')}`,
        cardId: card.id,
        sellerId: seller.id,
        condition: condition,
        price: Math.max(0.25, randomFloat(basePrice * conditionMultiplier * foilMultiplier * 0.8, basePrice * conditionMultiplier * foilMultiplier * 1.2)),
        quantity: randomInt(1, 20),
        language: seededRandom() < 0.7 ? 'English' : randomElement(LANGUAGES),
        isFoil: isFoil,
      });
    }
  }

  return listings;
}

// Generate featured content
function generateFeatured(games: Game[], sets: CardSet[], cards: Card[]): Featured {
  // Get newest sets
  const sortedSets = [...sets].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
  const newReleases = sortedSets.slice(0, 5).map(s => s.id);

  // Get random trending cards (high rarity)
  const highRarityCards = cards.filter(c => {
    const rarities = RARITIES[c.gameId];
    const rarityIndex = rarities?.indexOf(c.rarity) ?? 0;
    return rarityIndex >= rarities.length - 3;
  });
  const trendingCards = shuffleArray(highRarityCards).slice(0, 20).map(c => c.id);

  // All games are popular
  const popularGames = games.map(g => g.id);

  return {
    banners: [
      { id: 'banner-1', imageUrl: '/images/banners/new-releases.webp', link: '/sets', title: 'New Releases' },
      { id: 'banner-2', imageUrl: '/images/banners/trending.webp', link: '/search?sort=trending', title: 'Trending Now' },
      { id: 'banner-3', imageUrl: '/images/banners/deals.webp', link: '/search?sort=price&order=asc', title: 'Best Deals' },
    ],
    trendingCards,
    newReleases,
    popularGames,
  };
}

// Update game card counts
function updateGameCardCounts(games: Game[], cards: Card[]): void {
  const counts = new Map<string, number>();
  for (const card of cards) {
    counts.set(card.gameId, (counts.get(card.gameId) || 0) + 1);
  }
  for (const game of games) {
    game.cardCount = counts.get(game.id) || 0;
  }
}

// Write data to file
function writeJsonFile(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Written: ${filePath} (${(fs.statSync(filePath).size / 1024).toFixed(1)} KB)`);
}

// Main generation function
function generateAllData(outputDir: string): void {
  console.log('Generating e-commerce benchmark data...\n');

  // Generate all data
  const games = generateGames();
  console.log(`Generated ${games.length} games`);

  const sets = generateSets(games);
  console.log(`Generated ${sets.length} sets`);

  const cards = generateCards(sets);
  console.log(`Generated ${cards.length} cards`);

  // Update game card counts
  updateGameCardCounts(games, cards);

  const sellers = generateSellers();
  console.log(`Generated ${sellers.length} sellers`);

  const listings = generateListings(cards, sellers);
  console.log(`Generated ${listings.length} listings`);

  const featured = generateFeatured(games, sets, cards);
  console.log(`Generated featured content`);

  console.log('\nWriting JSON files...\n');

  // Write to output directory
  writeJsonFile(path.join(outputDir, 'games.json'), games);
  writeJsonFile(path.join(outputDir, 'sets.json'), sets);
  writeJsonFile(path.join(outputDir, 'cards.json'), cards);
  writeJsonFile(path.join(outputDir, 'sellers.json'), sellers);
  writeJsonFile(path.join(outputDir, 'listings.json'), listings);
  writeJsonFile(path.join(outputDir, 'featured.json'), featured);

  console.log('\nData generation complete!');
  console.log(`\nSummary:`);
  console.log(`  - Games: ${games.length}`);
  console.log(`  - Sets: ${sets.length}`);
  console.log(`  - Cards: ${cards.length}`);
  console.log(`  - Sellers: ${sellers.length}`);
  console.log(`  - Listings: ${listings.length}`);
}

// Run if called directly
const outputDir = process.argv[2] || './data';
generateAllData(outputDir);
