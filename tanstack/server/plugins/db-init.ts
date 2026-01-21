import { db } from '../../src/lib/db'

export default defineNitroPlugin(async () => {
  // Pre-initialize database to avoid file reads during request handling
  await db.initialize()
})
