import request from 'supertest'
import { createApp } from '../../src/app.js'
import { runMigrations } from '../../src/db/migrate.js'
import { seed, SEED_PASSWORD } from '../../src/db/seed.js'
import { signToken } from '../../src/lib/jwt.js'
import { db, schema } from '../../src/db/index.js'
import { eq } from 'drizzle-orm'

export const app = request(createApp())

export async function resetDb(): Promise<void> {
  await runMigrations()
  await seed()
}

export async function loginAs(email: string): Promise<{ auth: { Authorization: string } }> {
  const res = await app.post('/api/auth/login').send({ email, password: SEED_PASSWORD })
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`)
  return { auth: { Authorization: `Bearer ${res.body.token}` } }
}

// Forge arbitrary claims — used to prove role-escalation and confused-deputy behavior.
export function tokenFor(claims: { sub: number; email: string; role: string }): string {
  return signToken(claims)
}

export async function userId(email: string): Promise<number> {
  const rows = await db.select().from(schema.users).where(eq(schema.users.email, email))
  return rows[0]!.id
}

export async function seedOrderFor(email: string): Promise<number> {
  const uid = await userId(email)
  const rows = await db.select().from(schema.orders).where(eq(schema.orders.userId, uid))
  return rows[0]!.id
}
