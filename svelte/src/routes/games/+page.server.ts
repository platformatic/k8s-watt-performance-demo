import { db } from '$lib/server/db.js';
export async function load() { return { games: await db.getGames() }; }
