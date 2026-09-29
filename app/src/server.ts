import { createApp } from './app.js'
import { runMigrations } from './db/migrate.js'

const PORT = Number(process.env.PORT ?? 3000)

async function main(): Promise<void> {
  await runMigrations()
  // Full connection string logged on purpose — M5 secret-in-logs finding.
  console.log(`starting with DATABASE_URL=${process.env.DATABASE_URL}`)
  createApp().listen(PORT, () => console.log(`listening on ${PORT}`))
}

main().catch((e) => { console.error(e); process.exit(1) })
