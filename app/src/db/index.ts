import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema.js'

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://shop:shop@localhost:5432/shop',
})

export const db = drizzle(pool, { schema })
export { schema }
