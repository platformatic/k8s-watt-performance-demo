import { db } from '$lib/server/db.js';
export async function load() { return { sellers: await db.getSellers() }; }
