import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db, pool } from './index.js'

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: './src/db/migrations' })
}

// Allow `tsx src/db/migrate.ts` to run standalone.
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => { console.log('migrations applied'); return pool.end() })
    .catch((e) => { console.error(e); process.exit(1) })
}
