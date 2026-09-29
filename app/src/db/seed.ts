import { db, pool, schema } from './index.js'
import { sql } from 'drizzle-orm'

export const SEED_PASSWORD = 'Password123!'
// P0 marker hash. M5 replaces the hashing scheme; the value here only needs to be stable.
export const SEED_PASSWORD_HASH = 'md5:319f4d26e3c536b5dd871bb2c52e3178'

export const SEED_USERS = [
  { email: 'alice@example.com', name: 'Alice', role: 'CUSTOMER' as const },
  { email: 'bob@example.com', name: 'Bob', role: 'CUSTOMER' as const },
  { email: 'carol@example.com', name: 'Carol', role: 'SELLER' as const },
  { email: 'admin@example.com', name: 'Admin', role: 'ADMIN' as const },
]

export async function seed(): Promise<void> {
  await db.execute(sql`TRUNCATE TABLE
    order_items, invoices, reviews, orders, products, coupons, users RESTART IDENTITY CASCADE`)

  const inserted = await db.insert(schema.users).values(
    SEED_USERS.map((u) => ({ ...u, passwordHash: SEED_PASSWORD_HASH })),
  ).returning()

  const byEmail = Object.fromEntries(inserted.map((u) => [u.email, u]))
  const carol = byEmail['carol@example.com']!
  const alice = byEmail['alice@example.com']!
  const bob = byEmail['bob@example.com']!

  const prods = await db.insert(schema.products).values([
    { sellerId: carol.id, name: 'Clavier mécanique', description: 'TKL', priceCents: 8900 },
    { sellerId: carol.id, name: 'Souris ergonomique', description: 'verticale', priceCents: 5900 },
    { sellerId: carol.id, name: 'Tapis XL', description: '90x40', priceCents: 2500 },
  ]).returning()

  const aliceOrder = (await db.insert(schema.orders).values(
    { userId: alice.id, totalCents: 8900, status: 'PAID' },
  ).returning())[0]!
  const bobOrder = (await db.insert(schema.orders).values(
    { userId: bob.id, totalCents: 5900, status: 'PAID' },
  ).returning())[0]!

  await db.insert(schema.orderItems).values([
    { orderId: aliceOrder.id, productId: prods[0]!.id, quantity: 1, unitPriceCents: 8900 },
    { orderId: bobOrder.id, productId: prods[1]!.id, quantity: 1, unitPriceCents: 5900 },
  ])
  await db.insert(schema.invoices).values([
    { orderId: aliceOrder.id, numberLabel: 'INV-A-001' },
    { orderId: bobOrder.id, numberLabel: 'INV-B-001' },
  ])
  await db.insert(schema.reviews).values([
    { productId: prods[0]!.id, userId: bob.id, body: 'Excellent clavier.' },
  ])
  await db.insert(schema.coupons).values([
    { code: 'WELCOME10', rules: { percentOff: 10 } },
  ])
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => { console.log('seed complete'); return pool.end() })
    .catch((e) => { console.error(e); process.exit(1) })
}
