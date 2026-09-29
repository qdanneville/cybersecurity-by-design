# secdev-lab P0 — Foundation + M1 + M2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the runnable, deliberately-vulnerable orders application with its Docker base stack, deterministic seed, security/functional test harness, the `make` learner interface, and the M1 (access control) and M2 (injection) vulnerability sets — each with a red-on-vulnerable security test and a reference fix patch.

**Architecture:** One Express 5 / TypeScript-strict / Drizzle / PostgreSQL / Redis app on a single `main` branch, vulnerable by design. Docker Compose base (`app` + `postgres` + `redis`) with per-module overlays. Reference fixes live as `solutions/<vuln>.patch` files, never applied to `main`; the learner's `git diff` is their deliverable. Tests use Vitest + Supertest against the running compose stack.

**Tech Stack:** Node 22, Express 5, TypeScript (strict), Drizzle ORM + drizzle-kit, PostgreSQL 16, Redis 7, Vitest, Supertest, Docker Compose, GNU Make.

**Spec:** `secdev-lab-architecture.md` (repo root). This plan implements §1 (tree), §2 (Makefile), §3 (app + M1/M2 rows of the failure map), §4 (4-step loop, worked IDOR test), §5 (compose base). Also read `CLAUDE.md`.

## Global Constraints

- **Code in `app/` is intentionally vulnerable.** Never harden it on `main`. Fixes go only to `solutions/*.patch`.
- **TypeScript strict** — `"strict": true` in `tsconfig.json`, no `any` in scaffolding.
- **One patch per vulnerability**, named `solutions/<mID>-<vuln>.patch`, applied with `git apply`.
- **Offline-first**: every image pinned by tag; no build-time network downloads; base stack < 2 GB RAM, < 90 s start.
- **Internal Docker network only**; the only external egress is the M1 SSRF lab, whose intended target is an internal compose service.
- **Deterministic seed**: users `alice@example.com` (CUSTOMER), `bob@example.com` (CUSTOMER), `carol@example.com` (SELLER), `admin@example.com` (ADMIN); password for all: `Password123!`.
- **Security tests must FAIL against vulnerable `main`** (they encode the secure expectation). **Functional tests must PASS against vulnerable `main`** (they guard that a fix doesn't break the app).
- Learner-facing text is French; code/comments/engineering docs are English.
- Commit messages end with the attribution line the harness specifies at commit time.

## Review Focus

Inputs the spec implies but no single task's happy-path test exercises — most likely to bite first:

1. **Unauthenticated access to protected endpoints** — a missing/blank `Authorization` header must yield 401, not a 500 stack trace. → pinned in Task 8 harness test.
2. **Cross-role token reuse** — a CUSTOMER token hitting a SELLER/ADMIN route must be 403, and the *security* test for M1 role escalation must confirm the vulnerable app wrongly allows it. → pinned in Task 11.
3. **Non-existent resource id** — `GET /api/orders/:id` with an id that does not exist must be 404 (same shape as the IDOR "not yours" case, so existence never leaks). → pinned in Task 10.
4. **Malformed JSON body** — `PATCH /api/users/me` with invalid JSON must be 400, not an unhandled throw. → pinned in Task 7 (error middleware) test.
5. **Empty/again-applied patch** — `make solution M=<x>` applied twice must fail loudly (patch already applied), not silently corrupt files. → pinned in Task 9 Makefile test.

---

## Task 0: Repository skeleton and git init

**Files:**
- Create: `.gitignore`, `README.md`, `.env.example`, `.nvmrc`
- Init: git repository on branch `main`

**Interfaces:**
- Produces: a committed `main` branch; `.env.example` with the canonical variable names other tasks copy.

- [ ] **Step 1: Initialize git and set default branch**

Run:
```bash
cd secdev-lab || (mkdir -p secdev-lab && cd secdev-lab)
git init -b main
```
(If the repo already exists at the project root, run `git init -b main` in place.)

- [ ] **Step 2: Write `.gitignore`**

```gitignore
node_modules/
.bin/
.env
*.log
app/dist/
coverage/
.DS_Store
```

- [ ] **Step 3: Write `.nvmrc`**

```
22
```

- [ ] **Step 4: Write `.env.example`**

```dotenv
# Copied verbatim into image/dev — intentionally weak in later modules.
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://shop:shop@postgres:5432/shop
REDIS_URL=redis://redis:6379
# M5 will show why a shared dev/prod JWT secret is a finding. For P0 it just needs to exist.
JWT_SECRET=dev-not-secret-change-me
```

- [ ] **Step 5: Write a minimal `README.md`**

```markdown
# secdev-lab

Deliberately vulnerable training lab. **Do not deploy.**

## Démarrage (5 min)

1. `cp .env.example .env`
2. `make check`
3. `make up M=m1`
4. `make test`

Une seule interface : `make`. Voir la doc du module dans `docs/`.
```

- [ ] **Step 6: Commit**

```bash
git add .gitignore README.md .env.example .nvmrc
git commit -m "chore: repository skeleton"
```

---

## Task 1: App package, TypeScript config, Drizzle config

**Files:**
- Create: `app/package.json`, `app/tsconfig.json`, `app/drizzle.config.ts`, `app/vitest.config.ts`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `test`, `db:generate`, `db:migrate`, `db:seed`; TS path base `src/`.

- [ ] **Step 1: Write `app/package.json`**

```json
{
  "name": "secdev-lab-app",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/server.js",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts",
    "db:seed": "tsx src/db/seed.ts"
  },
  "dependencies": {
    "drizzle-orm": "0.36.4",
    "express": "5.0.1",
    "ioredis": "5.4.1",
    "jsonwebtoken": "9.0.2",
    "pg": "8.13.1"
  },
  "devDependencies": {
    "@types/express": "5.0.0",
    "@types/jsonwebtoken": "9.0.7",
    "@types/node": "22.9.0",
    "@types/pg": "8.11.10",
    "@types/supertest": "6.0.2",
    "drizzle-kit": "0.28.1",
    "supertest": "7.0.0",
    "tsx": "4.19.2",
    "typescript": "5.6.3",
    "vitest": "2.1.5"
  }
}
```

- [ ] **Step 2: Write `app/tsconfig.json` (type-check config) and `app/tsconfig.build.json` (emit config)**

Two configs: the base type-checks everything (src, tests, config files) with `noEmit`; the build config sets `rootDir`/`outDir` and compiles only `src` → `dist`. A single config with `rootDir: "src"` but `include` listing files outside `src` fails with `TS6059`.

`app/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "tests", "drizzle.config.ts", "vitest.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

`app/tsconfig.build.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests", "drizzle.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Write `app/drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://shop:shop@localhost:5432/shop' },
})
```

- [ ] **Step 4: Write `app/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
    fileParallelism: false,
  },
})
```

- [ ] **Step 5: Install and verify the toolchain resolves**

Run:
```bash
cd app && npm install && npx tsc --noEmit
```
Expected: install succeeds; `tsc` type-checks the two config files (the only `.ts` files that exist yet) and exits 0. (Node >= 22 satisfies the engine; a newer major such as 24 is fine.)

- [ ] **Step 6: Commit**

```bash
git add app/package.json app/tsconfig.json app/drizzle.config.ts app/vitest.config.ts app/package-lock.json
git commit -m "chore(app): toolchain, TS strict, drizzle + vitest config"
```

---

## Task 2: Database schema (Drizzle)

**Files:**
- Create: `app/src/db/schema.ts`

**Interfaces:**
- Produces: tables `users`, `products`, `orders`, `orderItems`, `invoices`, `reviews`, `coupons` and their inferred types (`User`, `NewUser`, etc.). Consumed by every module.

- [ ] **Step 1: Write `app/src/db/schema.ts`**

```ts
import { pgTable, serial, text, integer, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['CUSTOMER', 'SELLER', 'ADMIN'])

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  // Intentionally weak hashing arrives in M5; P0 stores a plain marker hash.
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull().default('CUSTOMER'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  sellerId: integer('seller_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  priceCents: integer('price_cents').notNull(),
  imageUrl: text('image_url'),
})

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  totalCents: integer('total_cents').notNull(),
  status: text('status').notNull().default('PAID'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  productId: integer('product_id').notNull().references(() => products.id),
  quantity: integer('quantity').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
})

export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  numberLabel: text('number_label').notNull(),
})

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id),
  userId: integer('user_id').notNull().references(() => users.id),
  // Stored raw on purpose (M2 stored XSS). Rendering is where the flaw shows.
  body: text('body').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  // Discount rules merged with lib/merge.ts (M2 prototype pollution).
  rules: jsonb('rules').notNull().default({}),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Product = typeof products.$inferSelect
export type Order = typeof orders.$inferSelect
```

- [ ] **Step 2: Generate the migration SQL and read it**

Run:
```bash
cd app && npm run db:generate
```
Expected: a `.sql` file appears under `src/db/migrations/`. Open it and confirm it creates all seven tables and the `role` enum. This SQL is versioned and reviewed (per architecture §3, this is the Drizzle preparation cost).

- [ ] **Step 3: Commit**

```bash
git add app/src/db/schema.ts app/src/db/migrations/
git commit -m "feat(db): schema + generated migration for orders domain"
```

---

## Task 3: DB client and migrate runner

**Files:**
- Create: `app/src/db/index.ts`, `app/src/db/migrate.ts`

**Interfaces:**
- Consumes: `DATABASE_URL`.
- Produces: `db` (Drizzle client), `pool` (pg Pool), and `runMigrations()`. Consumed by server, seed, and all endpoints.

- [ ] **Step 1: Write `app/src/db/index.ts`**

```ts
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema.js'

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://shop:shop@localhost:5432/shop',
})

export const db = drizzle(pool, { schema })
export { schema }
```

- [ ] **Step 2: Write `app/src/db/migrate.ts`**

```ts
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
```

- [ ] **Step 3: Commit**

```bash
git add app/src/db/index.ts app/src/db/migrate.ts
git commit -m "feat(db): pg pool, drizzle client, migrate runner"
```

---

## Task 4: Deterministic seed

**Files:**
- Create: `app/src/db/seed.ts`

**Interfaces:**
- Consumes: `db`, `schema`.
- Produces: `seed()` that truncates and repopulates; fixed users/products/orders. Consumed by `make reset` and test setup. Exports `SEED_USERS` (email→role map) for tests.

- [ ] **Step 1: Write `app/src/db/seed.ts`**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add app/src/db/seed.ts
git commit -m "feat(db): deterministic seed with fixed users/products/orders"
```

---

## Task 5: Minimal JWT auth (deliberately trusting the role claim)

**Files:**
- Create: `app/src/lib/jwt.ts`, `app/src/middleware/auth.ts`, `app/src/modules/auth/auth.routes.ts`

**Interfaces:**
- Consumes: `JWT_SECRET`, `db`.
- Produces:
  - `signToken(payload: { sub: number; email: string; role: string }): string`
  - `authRouter` mounting `POST /api/auth/login` → `{ token }`
  - `requireAuth` middleware setting `req.user = { id, email, role }` **from the JWT claims** (role is NOT re-read from DB — this is the M1 horizontal-escalation surface; full M3 auth hardening is a later plan).

- [ ] **Step 1: Write `app/src/lib/jwt.ts`**

```ts
import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET ?? 'dev-not-secret-change-me'

export interface Claims { sub: number; email: string; role: string }

export function signToken(payload: Claims): string {
  return jwt.sign(payload, SECRET, { expiresIn: '2h' })
}

export function verifyToken(token: string): Claims {
  return jwt.verify(token, SECRET) as unknown as Claims
}
```

- [ ] **Step 2: Write `app/src/middleware/auth.ts`**

```ts
import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../lib/jwt.js'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { user?: { id: number; email: string; role: string } }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthenticated' })
    return
  }
  try {
    const claims = verifyToken(header.slice('Bearer '.length))
    // NOTE: role trusted straight from the claim, never re-checked against the DB.
    req.user = { id: claims.sub, email: claims.email, role: claims.role }
    next()
  } catch {
    res.status(401).json({ error: 'invalid token' })
  }
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.user?.role !== role) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    next()
  }
}
```

- [ ] **Step 3: Write `app/src/modules/auth/auth.routes.ts`**

```ts
import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { db, schema } from '../../db/index.js'
import { signToken } from '../../lib/jwt.js'
import { SEED_PASSWORD, SEED_PASSWORD_HASH } from '../../db/seed.js'

export const authRouter = Router()

// P0 login: all seeded users share one marker hash / password. Real per-user
// password hashing (and its weaknesses) arrive in M5; enumeration nuance in M3.
// NOTE: `password` MUST be checked here — omitting it makes login accept any
// password, which also breaks the M3 enumeration lesson.
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {}
  const rows = await db.select().from(schema.users).where(eq(schema.users.email, email))
  const user = rows[0]
  if (!user || user.passwordHash !== SEED_PASSWORD_HASH || password !== SEED_PASSWORD) {
    res.status(401).json({ error: 'invalid credentials' })
    return
  }
  res.json({ token: signToken({ sub: user.id, email: user.email, role: user.role }) })
})
```

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/jwt.ts app/src/middleware/auth.ts app/src/modules/auth/auth.routes.ts
git commit -m "feat(auth): minimal JWT login, role claim trusted (M1 surface)"
```

---

## Task 6: Error + CORS middleware and app assembly (vulnerable defaults)

**Files:**
- Create: `app/src/middleware/errors.ts`, `app/src/app.ts`

**Interfaces:**
- Consumes: all routers (auth now; module routers added in later tasks).
- Produces: `createApp(): Express` returning a configured app **without** starting a listener (so Supertest can import it). Error middleware leaks stack traces in dev (M8 surface) but must still return 400 on malformed JSON rather than throwing.

- [ ] **Step 1: Write `app/src/middleware/errors.ts`**

```ts
import type { Request, Response, NextFunction } from 'express'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // Malformed JSON from express.json() arrives here as a SyntaxError with status 400.
  const e = err as { status?: number; type?: string; stack?: string; message?: string }
  if (e?.status === 400 || e?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'invalid request body' })
    return
  }
  // Stack trace leaked in the HTTP response — intentional M8 finding.
  res.status(500).json({ error: e?.message ?? 'error', stack: e?.stack })
}
```

- [ ] **Step 2: Write `app/src/app.ts`**

```ts
import express, { type Express } from 'express'
import { authRouter } from './modules/auth/auth.routes.js'
import { errorHandler } from './middleware/errors.js'

export function createApp(): Express {
  const app = express()
  app.use(express.json())
  app.get('/api/health', (_req, res) => res.json({ ok: true }))
  app.use('/api/auth', authRouter)
  // Module routers are mounted here by later tasks (users, orders, products).
  app.use(errorHandler)
  return app
}
```

- [ ] **Step 3: Commit**

```bash
git add app/src/middleware/errors.ts app/src/app.ts
git commit -m "feat(app): app assembly, error handler (leaks stack — M8 surface)"
```

---

## Task 7: Server entrypoint (leaks DATABASE_URL — M5 surface)

**Files:**
- Create: `app/src/server.ts`
- Test: `app/tests/functional/health.spec.ts`

**Interfaces:**
- Consumes: `createApp`, `runMigrations`.
- Produces: a process that migrates then listens on `PORT`. Startup logs the full `DATABASE_URL` (intentional M5 finding).

- [ ] **Step 1: Write the failing functional test `app/tests/functional/health.spec.ts`**

```ts
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'

describe('health', () => {
  it('returns ok', async () => {
    const res = await request(createApp()).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('returns 400 (not 500) on malformed JSON', async () => {
    const res = await request(createApp())
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ not json')
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run to verify it passes (app.ts already exists)**

Run:
```bash
cd app && npx vitest run tests/functional/health.spec.ts
```
Expected: PASS (2 tests). This confirms the error middleware handles malformed JSON — Review Focus item 4.

- [ ] **Step 3: Write `app/src/server.ts`**

```ts
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
```

- [ ] **Step 4: Commit**

```bash
git add app/src/server.ts app/tests/functional/health.spec.ts
git commit -m "feat(app): server entrypoint (logs DATABASE_URL — M5 surface) + health tests"
```

---

## Task 8: Docker base stack + test harness

**Files:**
- Create: `docker-compose.base.yml`, `app/Dockerfile`, `app/tests/security/_harness.ts`
- Test: `app/tests/functional/harness.spec.ts`

**Interfaces:**
- Consumes: seed `SEED_USERS`, `SEED_PASSWORD`, `createApp`.
- Produces harness exports used by every security test:
  - `app` — a Supertest agent over `createApp()`
  - `resetDb(): Promise<void>` — runs migrations + `seed()`
  - `loginAs(email: string): Promise<{ auth: { Authorization: string } }>`
  - `tokenFor(claims): string` — forge arbitrary claims (for escalation tests)
  - `seedOrderFor(email): Promise<number>` — id of that user's seeded order

- [ ] **Step 1: Write `docker-compose.base.yml`**

```yaml
name: secdev-lab
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: shop
      POSTGRES_PASSWORD: shop
      POSTGRES_DB: shop
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shop"]
      interval: 3s
      timeout: 3s
      retries: 10
  redis:
    image: redis:7-alpine
  app:
    build: ./app
    env_file: .env
    environment:
      DATABASE_URL: postgres://shop:shop@postgres:5432/shop
      REDIS_URL: redis://redis:6379
    ports: ["3000:3000"]
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_started }
```

- [ ] **Step 2: Write `app/Dockerfile` (P0 single-stage; M7 rewrites this)**

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
CMD ["npm", "run", "dev"]
```

- [ ] **Step 3: Write `app/tests/security/_harness.ts`**

```ts
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
```

- [ ] **Step 4: Write `app/tests/functional/harness.spec.ts` (proves login + unauth handling — Review Focus 1)**

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { app, resetDb, loginAs } from '../security/_harness.js'

describe('harness', () => {
  beforeAll(async () => { await resetDb() })

  it('logs a seeded user in', async () => {
    const alice = await loginAs('alice@example.com')
    expect(alice.auth.Authorization).toMatch(/^Bearer /)
  })

  it('rejects a missing Authorization header with 401', async () => {
    const res = await app.get('/api/orders/1')
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 5: Run against the stack**

Run:
```bash
docker compose -f docker-compose.base.yml up -d
cd app && DATABASE_URL=postgres://shop:shop@localhost:5432/shop npx vitest run tests/functional/harness.spec.ts
```
Expected: `/api/orders/1` returns 401 (route not yet mounted → 401 comes from... note: without the orders router the path 404s). **Adjust expectation:** if the orders route is absent, Express returns 404, so this test must run after Task 10 mounts the router. Mark this test `it.todo` until Task 10, then flip it. (Task 10 Step 6 re-enables it.)

- [ ] **Step 6: Commit**

```bash
git add docker-compose.base.yml app/Dockerfile app/tests/security/_harness.ts app/tests/functional/harness.spec.ts
git commit -m "feat: docker base stack, Dockerfile, security test harness"
```

---

## Task 9: Makefile — the learner interface

**Files:**
- Create: `Makefile`, `solutions/.gitkeep`
- Test: `tools/check.sh` (invoked by `make check`)

**Interfaces:**
- Consumes: `docker-compose.base.yml`, `labs/*/overlay.yml` (created by later module tasks).
- Produces: targets `check`, `up`, `down`, `reset`, `test`, `solution`, `hint`. `make solution M=<x>` applies `solutions/<x>.patch` and fails loudly if already applied (Review Focus 5).

- [ ] **Step 1: Write `tools/check.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
ok(){ printf "\033[32m✓ %s\033[0m\n" "$1"; }
ko(){ printf "\033[31m✗ %s\033[0m\n" "$1"; FAIL=1; }
FAIL=0
command -v docker >/dev/null && ok "docker présent" || ko "docker manquant"
docker info >/dev/null 2>&1 && ok "docker actif" || ko "docker daemon arrêté"
node -v 2>/dev/null | grep -qE 'v(2[2-9]|[3-9][0-9])' && ok "node >= 22" || ko "node >= 22 requis"
# Available RAM (not total; architecture §5). Linux: MemAvailable via free.
# macOS: free + inactive + speculative + purgeable pages ≈ what the OS can hand out.
# (Pages-free alone is misleadingly low on macOS and would fail on every Mac.)
if command -v free >/dev/null; then
  FREE_MB=$(free -m | awk '/^Mem:/{print $7}')
else
  PS=$(vm_stat)
  PGSIZE=$(echo "$PS" | sed -n 's/.*page size of \([0-9]*\) bytes.*/\1/p'); PGSIZE=${PGSIZE:-4096}
  pages(){ echo "$PS" | awk -v k="$1" 'index($0,k){gsub(/\./,"",$NF); print $NF+0}'; }
  FREE_MB=$(( ( $(pages "Pages free:") + $(pages "Pages inactive:") \
    + $(pages "Pages speculative:") + $(pages "Pages purgeable:") ) * PGSIZE / 1024 / 1024 ))
fi
[ "${FREE_MB:-0}" -ge 3000 ] && ok "RAM libre ${FREE_MB} Mo" || ko "RAM libre ${FREE_MB} Mo (<3 Go, 16 Go conseillés)"
for p in 3000 5432 6379; do
  (lsof -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1) && ko "port $p occupé" || ok "port $p libre"
done
exit $FAIL
```

- [ ] **Step 2: Write `Makefile`**

```makefile
COMPOSE := docker compose -f docker-compose.base.yml

.PHONY: check up down reset test solution hint

check:
	@bash tools/check.sh

up:
	@test -n "$(M)" || (echo "usage: make up M=m1"; exit 1)
	@overlay=$$(ls labs/$(M)-*/overlay.yml 2>/dev/null | head -1); \
	 args="-f docker-compose.base.yml"; \
	 if [ -n "$$overlay" ]; then args="$$args -f $$overlay"; echo "overlay: $$overlay"; fi; \
	 docker compose $$args up -d --build

down:
	$(COMPOSE) down -v

reset:
	$(COMPOSE) exec -T app npm run db:migrate
	$(COMPOSE) exec -T app npm run db:seed
	git checkout -- app/src

test:
	$(COMPOSE) exec -T app npm test

solution:
	@test -n "$(M)" || (echo "usage: make solution M=m1-idor"; exit 1)
	@test -f solutions/$(M).patch || (echo "no patch solutions/$(M).patch"; exit 1)
	@git apply --check solutions/$(M).patch \
	  || (echo "patch n'applique pas (déjà appliqué ? code modifié ?)"; exit 1)
	@git apply solutions/$(M).patch && echo "patch $(M) appliqué"

hint:
	@test -n "$(M)" || (echo "usage: make hint M=m1-idor"; exit 1)
	@bash tools/hint.sh $(M)
```

Note: the overlay is resolved with a shell glob at run time (an in-recipe
`$(wildcard …:%=-f %)` expression does not perform the `-f` substitution and
silently drops overlays).

- [ ] **Step 3: Write `tools/hint.sh` and a seed hint file**

```bash
#!/usr/bin/env bash
set -euo pipefail
M="$1"; DIR="docs/hints/$M"
STATE=".hint-state/$M"; mkdir -p "$(dirname "$STATE")"
N=$(( $(cat "$STATE" 2>/dev/null || echo 0) + 1 ))
FILE="$DIR/$N.md"
if [ -f "$FILE" ]; then echo "$N" > "$STATE"; cat "$FILE";
else echo "Plus d'indices. Regarde solutions/$M.patch si tu es bloqué."; fi
```

Also create `docs/hints/m1-idor/1.md`:
```markdown
Indice 1/3 — Que compare le handler avant de renvoyer la commande ? Regarde s'il vérifie à *qui* elle appartient.
```
And add `.hint-state/` to `.gitignore`.

- [ ] **Step 4: Make scripts executable and smoke-test check**

Run:
```bash
chmod +x tools/check.sh tools/hint.sh
make check
```
Expected: green/red report, exit reflects environment.

- [ ] **Step 5: Test the "patch applied twice fails loudly" behavior**

Run (after Task 10 produces `solutions/m1-idor.patch`; until then this step is deferred):
```bash
make solution M=m1-idor && make solution M=m1-idor; echo "exit=$?"
```
Expected: first succeeds; second prints "patch n'applique pas" and exits non-zero (Review Focus 5). Then `git checkout -- app/src` to restore.

- [ ] **Step 6: Commit**

```bash
touch solutions/.gitkeep
git add Makefile tools/check.sh tools/hint.sh docs/hints/m1-idor/1.md solutions/.gitkeep .gitignore
git commit -m "feat: Makefile learner interface, check + hint scripts"
```

---

## Task 10: M1 — IDOR (the worked example) + orders router

**Files:**
- Create: `app/src/modules/orders/orders.routes.ts`, `app/tests/security/m1-idor.spec.ts`, `solutions/m1-idor.patch`, `labs/m1-access-control/.gitkeep`
- Modify: `app/src/app.ts` (mount orders router)

**Interfaces:**
- Consumes: `requireAuth`, `db`, `schema`, harness (`loginAs`, `seedOrderFor`, `resetDb`).
- Produces: `GET /api/orders/:id` (vulnerable: no ownership check), `ordersRouter`. This is the shipped worked example (architecture §4).

- [ ] **Step 1: Write the vulnerable `app/src/modules/orders/orders.routes.ts`**

```ts
import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { db, schema } from '../../db/index.js'
import { requireAuth } from '../../middleware/auth.js'

export const ordersRouter = Router()

// VULNERABLE (M1 IDOR): returns any order by id, no ownership check.
ordersRouter.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  const rows = await db.select().from(schema.orders).where(eq(schema.orders.id, id))
  const order = rows[0]
  if (!order) { res.status(404).json({ error: 'not found' }); return }
  res.json(order)
})
```

- [ ] **Step 2: Mount the router — modify `app/src/app.ts`**

Add the import and mount line:
```ts
import { ordersRouter } from './modules/orders/orders.routes.js'
// ...inside createApp, before errorHandler:
app.use('/api/orders', ordersRouter)
```

- [ ] **Step 3: Write the failing security test `app/tests/security/m1-idor.spec.ts` (the shipped model)**

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { app, resetDb, loginAs, seedOrderFor } from './_harness.js'

describe('M1 IDOR — GET /api/orders/:id', () => {
  beforeAll(async () => { await resetDb() })

  it("refuse l'accès à la commande d'un autre client", async () => {
    const alice = await loginAs('alice@example.com')
    const bobOrderId = await seedOrderFor('bob@example.com')

    const res = await app.get(`/api/orders/${bobOrderId}`).set(alice.auth)

    expect(res.status).toBe(404)         // 404, pas 403 : pas de fuite d'existence
    expect(res.body).not.toHaveProperty('totalCents')
  })

  it('renvoie 404 pour une commande inexistante', async () => {
    const alice = await loginAs('alice@example.com')
    const res = await app.get('/api/orders/999999').set(alice.auth)
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 4: Run to verify the security test FAILS on vulnerable code**

Run:
```bash
cd app && DATABASE_URL=postgres://shop:shop@localhost:5432/shop npx vitest run tests/security/m1-idor.spec.ts
```
Expected: first test FAILS (vulnerable app returns 200 with `totalCents`); second passes. The failure is the intended "red on vulnerable" — do NOT fix in `app/`.

- [ ] **Step 5: Author the reference fix and capture it as a patch (without leaving it on `main`)**

Apply this secure version to `orders.routes.ts` temporarily:
```ts
ordersRouter.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  const rows = await db.select().from(schema.orders).where(eq(schema.orders.id, id))
  const order = rows[0]
  // Fix: 404 whether it doesn't exist OR isn't yours — no existence leak.
  if (!order || order.userId !== req.user!.id) { res.status(404).json({ error: 'not found' }); return }
  res.json(order)
})
```
Then:
```bash
cd app && DATABASE_URL=postgres://shop:shop@localhost:5432/shop npx vitest run tests/security/m1-idor.spec.ts
# Expected: PASS (both tests). Now capture and revert:
cd .. && git diff app/src/modules/orders/orders.routes.ts > solutions/m1-idor.patch
git checkout -- app/src/modules/orders/orders.routes.ts
```
Verify `solutions/m1-idor.patch` is non-empty and `git apply --check solutions/m1-idor.patch` succeeds.

- [ ] **Step 6: Re-enable the deferred harness test from Task 8**

In `app/tests/functional/harness.spec.ts` the 401 test now has a mounted route to hit — confirm it passes:
```bash
cd app && DATABASE_URL=postgres://shop:shop@localhost:5432/shop npx vitest run tests/functional/harness.spec.ts
```
Expected: PASS (401 on missing header — Review Focus 1).

- [ ] **Step 7: Commit**

```bash
git add app/src/modules/orders/orders.routes.ts app/src/app.ts \
  app/tests/security/m1-idor.spec.ts solutions/m1-idor.patch labs/m1-access-control/.gitkeep
git commit -m "feat(m1): IDOR on GET /orders/:id (vulnerable) + worked test + fix patch"
```

---

## Task 11: M1 — mass assignment, over-fetching, role escalation (users module)

**Files:**
- Create: `app/src/modules/users/users.routes.ts`, `app/tests/security/m1-mass-assignment.spec.ts`, `app/tests/security/m1-overfetch.spec.ts`, `app/tests/security/m1-role-escalation.spec.ts`, `solutions/m1-mass-assignment.patch`, `solutions/m1-overfetch.patch`, `solutions/m1-role-escalation.patch`
- Modify: `app/src/app.ts` (mount users router)

**Interfaces:**
- Consumes: `requireAuth`, `requireRole`, `db`, `schema`, harness (`loginAs`, `tokenFor`, `userId`).
- Produces: `PATCH /api/users/me` (mass assignment), `GET /api/users` (over-fetch leaks `passwordHash`, ADMIN-gated), and a `GET /api/admin/summary` route the role claim can be forged to reach.

- [ ] **Step 1: Write vulnerable `app/src/modules/users/users.routes.ts`**

```ts
import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { db, schema } from '../../db/index.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'

export const usersRouter = Router()

// VULNERABLE (M1 mass assignment): whole body spread into .set(), role included.
usersRouter.patch('/me', requireAuth, async (req, res) => {
  const updated = await db.update(schema.users)
    .set({ ...req.body })
    .where(eq(schema.users.id, req.user!.id))
    .returning()
  res.json(updated[0])
})

// VULNERABLE (M1 over-fetch): select().from(users) returns passwordHash in JSON.
usersRouter.get('/', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  const rows = await db.select().from(schema.users)
  res.json(rows)
})
```

Add an admin summary route in `app/src/modules/admin/admin.routes.ts`:
```ts
import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth.js'

export const adminRouter = Router()
// Reachable by anyone whose JWT *claims* ADMIN — role is never re-checked in DB (M1).
adminRouter.get('/summary', requireAuth, requireRole('ADMIN'), (_req, res) => {
  res.json({ secret: 'chiffre-affaires-interne', totalCents: 1234567 })
})
```

- [ ] **Step 2: Mount both routers — modify `app/src/app.ts`**

```ts
import { usersRouter } from './modules/users/users.routes.js'
import { adminRouter } from './modules/admin/admin.routes.js'
// inside createApp, before errorHandler:
app.use('/api/users', usersRouter)
app.use('/api/admin', adminRouter)
```

- [ ] **Step 3: Write the three failing security tests**

`app/tests/security/m1-mass-assignment.spec.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { app, resetDb, loginAs } from './_harness.js'

describe('M1 mass assignment — PATCH /api/users/me', () => {
  beforeAll(async () => { await resetDb() })
  it('ignore les champs privilégiés (role)', async () => {
    const alice = await loginAs('alice@example.com')
    const res = await app.patch('/api/users/me').set(alice.auth).send({ name: 'Alice2', role: 'ADMIN' })
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('CUSTOMER')     // fails on vulnerable code (becomes ADMIN)
    expect(res.body.name).toBe('Alice2')
  })
})
```

`app/tests/security/m1-overfetch.spec.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { app, resetDb, loginAs } from './_harness.js'

describe('M1 over-fetch — GET /api/users', () => {
  beforeAll(async () => { await resetDb() })
  it('ne renvoie jamais passwordHash', async () => {
    const admin = await loginAs('admin@example.com')
    const res = await app.get('/api/users').set(admin.auth)
    expect(res.status).toBe(200)
    for (const u of res.body) expect(u).not.toHaveProperty('passwordHash') // fails on vulnerable
  })
})
```

`app/tests/security/m1-role-escalation.spec.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { app, resetDb, loginAs, tokenFor, userId } from './_harness.js'

describe('M1 role escalation — forged role claim', () => {
  beforeAll(async () => { await resetDb() })
  it('un CUSTOMER avec un claim role=ADMIN forgé est refusé', async () => {
    const aliceId = await userId('alice@example.com')
    const forged = tokenFor({ sub: aliceId, email: 'alice@example.com', role: 'ADMIN' })
    const res = await app.get('/api/admin/summary').set({ Authorization: `Bearer ${forged}` })
    expect(res.status).toBe(403)   // fails on vulnerable code (200): role trusted from claim
  })
  it('un vrai CUSTOMER est refusé, un vrai ADMIN passe', async () => {
    const alice = await loginAs('alice@example.com')
    expect((await app.get('/api/admin/summary').set(alice.auth)).status).toBe(403)
    const admin = await loginAs('admin@example.com')
    expect((await app.get('/api/admin/summary').set(admin.auth)).status).toBe(200)
  })
})
```

- [ ] **Step 4: Run all three, verify each FAILS on the vulnerable dimension**

Run:
```bash
cd app && DATABASE_URL=postgres://shop:shop@localhost:5432/shop npx vitest run tests/security/m1-mass-assignment.spec.ts tests/security/m1-overfetch.spec.ts tests/security/m1-role-escalation.spec.ts
```
Expected: mass-assignment (role→ADMIN) fails; over-fetch (passwordHash present) fails; role-escalation first test fails (200 not 403). These are the intended reds (Review Focus 2).

- [ ] **Step 5: Author fixes, capture patches, revert**

Mass assignment — allow-list fields:
```ts
const { name } = req.body ?? {}
const updated = await db.update(schema.users).set({ name })
  .where(eq(schema.users.id, req.user!.id)).returning()
```
Over-fetch — select explicit columns:
```ts
const rows = await db.select({
  id: schema.users.id, email: schema.users.email, name: schema.users.name, role: schema.users.role,
}).from(schema.users)
```
Role escalation — re-read role from DB in `requireRole` (or in an admin guard). For the patch, change `admin.routes.ts` guard to look up the user:
```ts
import { db, schema } from '../../db/index.js'
import { eq } from 'drizzle-orm'
adminRouter.get('/summary', requireAuth, async (req, res, next) => {
  const rows = await db.select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.id, req.user!.id))
  if (rows[0]?.role !== 'ADMIN') { res.status(403).json({ error: 'forbidden' }); return }
  next()
}, (_req, res) => res.json({ secret: 'chiffre-affaires-interne', totalCents: 1234567 }))
```
For each fix: apply, run the matching spec (expect PASS), run the functional suite (expect still PASS), then:
```bash
cd .. && git diff <file> > solutions/m1-<vuln>.patch && git checkout -- <file>
```
Do them one at a time so each patch is isolated (per architecture: one patch per vulnerability).

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/users app/src/modules/admin app/src/app.ts \
  app/tests/security/m1-mass-assignment.spec.ts app/tests/security/m1-overfetch.spec.ts \
  app/tests/security/m1-role-escalation.spec.ts \
  solutions/m1-mass-assignment.patch solutions/m1-overfetch.patch solutions/m1-role-escalation.patch
git commit -m "feat(m1): mass assignment, over-fetch, role escalation (vulnerable) + tests + patches"
```

---

## Task 12: M1 — SSRF (product image import)

**Files:**
- Create: `app/src/lib/http-client.ts`, `app/src/modules/products/products.routes.ts`, `app/tests/security/m1-ssrf.spec.ts`, `solutions/m1-ssrf.patch`
- Modify: `app/src/app.ts` (mount products router)

**Interfaces:**
- Consumes: `requireAuth`, harness.
- Produces: `POST /api/products/import-image` with `{ url }` that fetches server-side with no destination allow-list (SSRF). `productsRouter` also hosts M2 search/reviews (added in Task 13–14).

- [ ] **Step 1: Write `app/src/lib/http-client.ts`**

```ts
// Thin wrapper so the SSRF fix (allow-list) lives in one place.
export async function fetchImage(url: string): Promise<{ status: number; contentType: string | null }> {
  const res = await fetch(url, { redirect: 'follow' })
  return { status: res.status, contentType: res.headers.get('content-type') }
}
```

- [ ] **Step 2: Write vulnerable `app/src/modules/products/products.routes.ts`**

```ts
import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { fetchImage } from '../../lib/http-client.js'

export const productsRouter = Router()

// VULNERABLE (M1 SSRF): fetches any URL the client supplies, server-side.
productsRouter.post('/import-image', requireAuth, async (req, res) => {
  const { url } = req.body ?? {}
  if (typeof url !== 'string') { res.status(400).json({ error: 'url required' }); return }
  const result = await fetchImage(url)
  res.json({ imported: true, upstreamStatus: result.status, contentType: result.contentType })
})
```

Mount in `app/src/app.ts`:
```ts
import { productsRouter } from './modules/products/products.routes.js'
app.use('/api/products', productsRouter)
```

- [ ] **Step 3: Write failing security test `app/tests/security/m1-ssrf.spec.ts`**

The intended target is an internal metadata-style host; the test uses a private/loopback URL and asserts it is refused **before** any fetch. On vulnerable code the app attempts the fetch (and returns `imported: true` or a network error, never 400).

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { app, resetDb, loginAs } from './_harness.js'

describe('M1 SSRF — POST /api/products/import-image', () => {
  beforeAll(async () => { await resetDb() })
  it('refuse une URL vers une adresse interne/loopback', async () => {
    const carol = await loginAs('carol@example.com')
    const res = await app.post('/api/products/import-image').set(carol.auth)
      .send({ url: 'http://127.0.0.1:6379/' })
    expect(res.status).toBe(400)                 // fails on vulnerable code
    expect(res.body).not.toHaveProperty('upstreamStatus')
  })
})
```

- [ ] **Step 4: Run, verify FAIL**

Run:
```bash
cd app && DATABASE_URL=postgres://shop:shop@localhost:5432/shop npx vitest run tests/security/m1-ssrf.spec.ts
```
Expected: FAIL (no 400 — the vulnerable handler tries to fetch).

- [ ] **Step 5: Author fix (allow-list host + block private ranges), capture patch, revert**

Fix in `http-client.ts`:
```ts
import { lookup } from 'node:dns/promises'
import net from 'node:net'

const ALLOWED_HOSTS = new Set(['images.example.com'])

function isPrivate(ip: string): boolean {
  return /^(10\.|127\.|169\.254\.|192\.168\.|::1|fc|fd)/.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
}

export async function fetchImage(url: string): Promise<{ status: number; contentType: string | null }> {
  const u = new URL(url)
  if (u.protocol !== 'https:' || !ALLOWED_HOSTS.has(u.hostname)) throw Object.assign(new Error('blocked'), { status: 400 })
  const { address } = await lookup(u.hostname)
  if (net.isIP(address) && isPrivate(address)) throw Object.assign(new Error('blocked'), { status: 400 })
  const res = await fetch(url, { redirect: 'error' })
  return { status: res.status, contentType: res.headers.get('content-type') }
}
```
Handle the thrown `status:400` in the route (or let the error middleware's 400 branch catch it). Apply, run the spec (PASS), run functional suite (PASS), then:
```bash
cd .. && git diff app/src/lib/http-client.ts app/src/modules/products/products.routes.ts > solutions/m1-ssrf.patch
git checkout -- app/src/lib/http-client.ts app/src/modules/products/products.routes.ts
```

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/http-client.ts app/src/modules/products/products.routes.ts app/src/app.ts \
  app/tests/security/m1-ssrf.spec.ts solutions/m1-ssrf.patch
git commit -m "feat(m1): SSRF on import-image (vulnerable) + test + fix patch"
```

---

## Task 13: M2 — SQL injection (search) and injection via ORDER BY identifier

**Files:**
- Modify: `app/src/modules/products/products.routes.ts` (add search)
- Create: `app/tests/security/m2-sqli-search.spec.ts`, `app/tests/security/m2-sqli-sort.spec.ts`, `solutions/m2-sqli-search.patch`, `solutions/m2-sqli-sort.patch`, `labs/m2-injection/.gitkeep`

**Interfaces:**
- Consumes: `db`, `sql` from drizzle, harness.
- Produces: `GET /api/products/search?q=&sort=` — `q` interpolated via `sql.raw` (classic SQLi), `sort` interpolated into `ORDER BY` (the realistic identifier-injection case, architecture §3).

- [ ] **Step 1: Add vulnerable search to `products.routes.ts`**

```ts
import { sql } from 'drizzle-orm'
import { db } from '../../db/index.js'

// VULNERABLE (M2): q interpolated with sql.raw; sort interpolated into ORDER BY.
productsRouter.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '')
  const sort = String(req.query.sort ?? 'name')
  const rows = await db.execute(
    sql.raw(`SELECT id, name, price_cents FROM products WHERE name LIKE '%${q}%' ORDER BY ${sort}`),
  )
  res.json(rows.rows)
})
```

- [ ] **Step 2: Write failing tests**

`app/tests/security/m2-sqli-search.spec.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { app, resetDb } from './_harness.js'

describe('M2 SQLi — /api/products/search?q', () => {
  beforeAll(async () => { await resetDb() })
  it("neutralise une charge d'injection dans q", async () => {
    // UNION-style probe: on vulnerable code this errors (500) or leaks; secure code returns 200 [].
    const res = await app.get("/api/products/search").query({ q: "x' UNION SELECT email,password_hash,1 FROM users --" })
    expect(res.status).toBe(200)      // fails on vulnerable code (500 / leak)
    const bodyText = JSON.stringify(res.body)
    expect(bodyText).not.toContain('password_hash')
    expect(bodyText).not.toContain('@example.com')
  })
})
```

`app/tests/security/m2-sqli-sort.spec.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { app, resetDb } from './_harness.js'

describe('M2 SQLi — ORDER BY identifier', () => {
  beforeAll(async () => { await resetDb() })
  it("rejette un sort qui n'est pas une colonne autorisée", async () => {
    const res = await app.get('/api/products/search').query({ q: '', sort: '(SELECT 1)' })
    expect(res.status).toBe(400)      // fails on vulnerable code (200, injection executes)
  })
  it('accepte une colonne autorisée', async () => {
    const res = await app.get('/api/products/search').query({ q: '', sort: 'price_cents' })
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 3: Run, verify the injection cases FAIL**

Run:
```bash
cd app && DATABASE_URL=postgres://shop:shop@localhost:5432/shop npx vitest run tests/security/m2-sqli-search.spec.ts tests/security/m2-sqli-sort.spec.ts
```
Expected: search-injection test fails; sort test's first assertion fails (200 not 400).

- [ ] **Step 4: Author the fix, capture ONE combined patch, revert**

Implemented as a single `solutions/m2-sqli.patch` (two tests, one patch):
both fixes live in the same `/search` handler on adjacent lines, so two
separately-captured patches share diff context and cannot both apply to the
vulnerable baseline — which would break the Task 15 "apply all patches" gate.
The two tests still teach the two distinct lessons.

Fix (parameterize `q`; allow-list `sort`):
```ts
const ALLOWED_SORT = new Set(['name', 'price_cents'])
productsRouter.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '')
  const sort = String(req.query.sort ?? 'name')
  if (!ALLOWED_SORT.has(sort)) { res.status(400).json({ error: 'invalid sort' }); return }
  const rows = await db.execute(
    sql`SELECT id, name, price_cents FROM products WHERE name LIKE ${'%' + q + '%'} ORDER BY ${sql.raw(sort)}`,
  )
  res.json(rows.rows)
})
```
Capture each concern as its own patch by staging the relevant hunk:
```bash
# search parameterization patch
cd .. && git diff app/src/modules/products/products.routes.ts > /tmp/m2-both.patch
```
Since both fixes touch the same handler, split into two logical patches: create `solutions/m2-sqli-search.patch` (the `sql`-tag parameterization of `q`) and `solutions/m2-sqli-sort.patch` (the `ALLOWED_SORT` guard) by editing the handler in two stages, capturing a diff after each stage, and reverting between. Verify both specs PASS with both applied, and functional suite PASS. Revert `app/src` afterward.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/products/products.routes.ts app/tests/security/m2-sqli-search.spec.ts \
  app/tests/security/m2-sqli-sort.spec.ts solutions/m2-sqli-search.patch solutions/m2-sqli-sort.patch \
  labs/m2-injection/.gitkeep
git commit -m "feat(m2): SQLi via sql.raw and ORDER BY identifier (vulnerable) + tests + patches"
```

---

## Task 14: M2 — prototype pollution (coupon merge) and stored XSS (reviews)

**Files:**
- Create: `app/src/lib/merge.ts`, `app/src/modules/coupons/coupons.routes.ts`, `app/tests/security/m2-proto-pollution.spec.ts`, `app/tests/security/m2-stored-xss.spec.ts`, `solutions/m2-proto-pollution.patch`, `solutions/m2-stored-xss.patch`
- Modify: `app/src/modules/products/products.routes.ts` (review create + render), `app/src/app.ts` (mount coupons)

**Interfaces:**
- Consumes: `db`, `schema`, `requireAuth`, harness.
- Produces: `lib/merge.ts` `deepMerge(target, source)` (pollutable), `POST /api/coupons/:code/rules` (merges user JSON into rules), `POST /api/products/:id/reviews` + `GET /api/products/:id/reviews.html` (renders `body` unescaped).

- [ ] **Step 1: Write vulnerable `app/src/lib/merge.ts`**

```ts
// VULNERABLE (M2 prototype pollution): recurses into __proto__ / constructor.
export function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  for (const key of Object.keys(source)) {
    const sv = source[key]
    if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      target[key] = deepMerge((target[key] as any) ?? {}, sv as Record<string, unknown>)
    } else {
      target[key] = sv
    }
  }
  return target
}
```

- [ ] **Step 2: Write vulnerable `app/src/modules/coupons/coupons.routes.ts`**

```ts
import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { db, schema } from '../../db/index.js'
import { requireAuth } from '../../middleware/auth.js'
import { deepMerge } from '../../lib/merge.js'

export const couponsRouter = Router()

couponsRouter.post('/:code/rules', requireAuth, async (req, res) => {
  const rows = await db.select().from(schema.coupons).where(eq(schema.coupons.code, req.params.code))
  const coupon = rows[0]
  if (!coupon) { res.status(404).json({ error: 'not found' }); return }
  const merged = deepMerge({ ...(coupon.rules as Record<string, unknown>) }, req.body ?? {})
  await db.update(schema.coupons).set({ rules: merged }).where(eq(schema.coupons.id, coupon.id))
  // Probe: expose whether Object.prototype got polluted.
  res.json({ rules: merged, polluted: ({} as Record<string, unknown>).polluted ?? null })
})
```

Mount in `app.ts`: `app.use('/api/coupons', couponsRouter)`.

- [ ] **Step 3: Add vulnerable review create + HTML render to `products.routes.ts`**

```ts
import { eq } from 'drizzle-orm'
import { schema } from '../../db/index.js'

productsRouter.post('/:id/reviews', requireAuth, async (req, res) => {
  const productId = Number(req.params.id)
  const body = String(req.body?.body ?? '')
  await db.insert(schema.reviews).values({ productId, userId: req.user!.id, body })
  res.status(201).json({ ok: true })
})

// VULNERABLE (M2 stored XSS): body concatenated into HTML with no escaping.
productsRouter.get('/:id/reviews.html', async (req, res) => {
  const productId = Number(req.params.id)
  const rows = await db.select().from(schema.reviews).where(eq(schema.reviews.productId, productId))
  const html = rows.map((r) => `<li>${r.body}</li>`).join('')
  res.type('html').send(`<ul>${html}</ul>`)
})
```

- [ ] **Step 4: Write failing tests**

`app/tests/security/m2-proto-pollution.spec.ts`:
```ts
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { app, resetDb, loginAs } from './_harness.js'

describe('M2 prototype pollution — coupon rules merge', () => {
  beforeAll(async () => { await resetDb() })
  afterEach(() => { delete (Object.prototype as Record<string, unknown>).polluted })
  it("ne pollue pas Object.prototype", async () => {
    const alice = await loginAs('alice@example.com')
    await app.post('/api/coupons/WELCOME10/rules').set(alice.auth)
      .send(JSON.parse('{"__proto__":{"polluted":"yes"}}'))
    expect(({} as Record<string, unknown>).polluted).toBeUndefined() // fails on vulnerable code
  })
})
```

`app/tests/security/m2-stored-xss.spec.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { app, resetDb, loginAs } from './_harness.js'

describe('M2 stored XSS — product reviews', () => {
  beforeAll(async () => { await resetDb() })
  it('échappe le HTML des avis', async () => {
    const bob = await loginAs('bob@example.com')
    await app.post('/api/products/1/reviews').set(bob.auth).send({ body: '<script>alert(1)</script>' })
    const res = await app.get('/api/products/1/reviews.html')
    expect(res.text).not.toContain('<script>alert(1)</script>')  // fails on vulnerable code
    expect(res.text).toContain('&lt;script&gt;')
  })
})
```

- [ ] **Step 5: Run, verify both FAIL**

Run:
```bash
cd app && DATABASE_URL=postgres://shop:shop@localhost:5432/shop npx vitest run tests/security/m2-proto-pollution.spec.ts tests/security/m2-stored-xss.spec.ts
```
Expected: both FAIL (prototype polluted; `<script>` rendered raw).

- [ ] **Step 6: Author fixes, capture patches, revert**

Prototype pollution fix in `merge.ts`:
```ts
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype'])
// ...inside loop:
for (const key of Object.keys(source)) {
  if (FORBIDDEN.has(key)) continue
  // ...rest unchanged
}
```
Stored XSS fix — escape in the render:
```ts
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
const html = rows.map((r) => `<li>${esc(r.body)}</li>`).join('')
```
For each: apply, run matching spec (PASS), run functional suite (PASS), capture diff to `solutions/m2-proto-pollution.patch` / `solutions/m2-stored-xss.patch`, revert.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/merge.ts app/src/modules/coupons app/src/modules/products/products.routes.ts app/src/app.ts \
  app/tests/security/m2-proto-pollution.spec.ts app/tests/security/m2-stored-xss.spec.ts \
  solutions/m2-proto-pollution.patch solutions/m2-stored-xss.patch
git commit -m "feat(m2): prototype pollution + stored XSS (vulnerable) + tests + patches"
```

---

## Task 15: M2 — command injection (PDF invoice) + full-suite gate

**Files:**
- Create: `app/src/lib/pdf.ts`, `app/tests/security/m2-command-injection.spec.ts`, `solutions/m2-command-injection.patch`
- Modify: `app/src/modules/orders/orders.routes.ts` (invoice PDF route)

**Interfaces:**
- Consumes: `requireAuth`, harness.
- Produces: `GET /api/invoices/:id.pdf` generating a PDF via `exec('wkhtmltopdf ...')` with an interpolated filename/title (command injection). `lib/pdf.ts` `renderInvoicePdf(title)`.

- [ ] **Step 1: Write vulnerable `app/src/lib/pdf.ts`**

```ts
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
const run = promisify(exec)

// VULNERABLE (M2 command injection): title interpolated into a shell command.
export async function renderInvoicePdf(title: string): Promise<string> {
  // In the lab wkhtmltopdf may be absent; the injection is provable via the echo side-effect.
  const { stdout } = await run(`echo "rendering ${title}" && echo done`)
  return stdout
}
```

- [ ] **Step 2: Add the route to `orders.routes.ts`**

```ts
import { renderInvoicePdf } from '../../lib/pdf.js'

ordersRouter.get('/invoices/:id.pdf', requireAuth, async (req, res) => {
  const title = String(req.query.title ?? `invoice-${req.params.id}`)
  const out = await renderInvoicePdf(title)
  res.type('text/plain').send(out)
})
```

- [ ] **Step 3: Write failing test `app/tests/security/m2-command-injection.spec.ts`**

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { app, resetDb, loginAs } from './_harness.js'

describe('M2 command injection — invoice PDF title', () => {
  beforeAll(async () => { await resetDb() })
  it("ne permet pas d'exécuter une commande via title", async () => {
    const alice = await loginAs('alice@example.com')
    const res = await app.get('/api/orders/invoices/1.pdf')
      .query({ title: 'x"; echo INJECTED; echo "' }).set(alice.auth)
    expect(res.text).not.toContain('INJECTED')   // fails on vulnerable code
  })
})
```

- [ ] **Step 4: Run, verify FAIL**

Run:
```bash
cd app && DATABASE_URL=postgres://shop:shop@localhost:5432/shop npx vitest run tests/security/m2-command-injection.spec.ts
```
Expected: FAIL (`INJECTED` appears in output).

- [ ] **Step 5: Author fix (execFile, no shell), capture patch, revert**

```ts
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const run = promisify(execFile)
export async function renderInvoicePdf(title: string): Promise<string> {
  const { stdout } = await run('echo', [`rendering ${title}`]) // no shell, argv-separated
  return stdout + 'done\n'
}
```
Apply, run spec (PASS), run functional suite (PASS), capture to `solutions/m2-command-injection.patch`, revert.

- [ ] **Step 6: Full-suite gate — the whole thing must be green-functional / red-security on vulnerable `main`**

Run the entire suite against vulnerable code:
```bash
docker compose -f docker-compose.base.yml up -d --build
cd app && DATABASE_URL=postgres://shop:shop@localhost:5432/shop npx vitest run
```
Expected: **all `tests/functional/*` PASS**; **all `tests/security/*` FAIL** (each encodes the secure expectation the vulnerable app violates). Record the count. Then verify every patch applies cleanly and flips its spec to green:
```bash
cd .. && for p in solutions/m*.patch; do git apply "$p"; done
cd app && DATABASE_URL=postgres://shop:shop@localhost:5432/shop npx vitest run   # expect ALL green
cd .. && git checkout -- app/src   # restore vulnerable baseline
```
Expected: with all patches applied, the whole suite (functional + security) is green; after `git checkout`, security tests are red again.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/pdf.ts app/src/modules/orders/orders.routes.ts \
  app/tests/security/m2-command-injection.spec.ts solutions/m2-command-injection.patch
git commit -m "feat(m2): command injection in invoice PDF (vulnerable) + test + fix patch"
```

---

## Task 16: Senior tracks and module lab placeholders for M1/M2

**Files:**
- Create: `docs/modules/m1-access-control/idor/senior.md`, `docs/modules/m2-injection/sqli/senior.md`, `labs/m1-access-control/overlay.yml` (empty extends base), `labs/m2-injection/overlay.yml` (+ mailhog)

**Interfaces:**
- Consumes: nothing runtime.
- Produces: the `senior.md` track (required from P0 per CLAUDE.md / architecture §9) and the M2 overlay adding `mailhog`.

- [ ] **Step 1: Write `labs/m2-injection/overlay.yml`**

```yaml
services:
  mailhog:
    image: mailhog/mailhog:v1.0.1
    ports: ["8025:8025"]
```

- [ ] **Step 2: Write `labs/m1-access-control/overlay.yml`**

```yaml
# M1 needs no extra service; base stack suffices. File kept so `make up M=m1` is uniform.
services: {}
```

- [ ] **Step 3: Write `docs/modules/m1-access-control/idor/senior.md`**

```markdown
# Piste senior — IDOR

Une PR t'est soumise (faille non annoncée) : le handler renvoie 403 quand la
commande ne t'appartient pas. Pourquoi préférer 404 ? Écris le test qui
distingue les deux comportements et défends le choix en revue.

Bonus : l'`id` est un entier séquentiel. Discute UUID v7 vs. contrôle d'accès —
lequel résout réellement le problème, lequel ne fait que le masquer.
```

- [ ] **Step 4: Write `docs/modules/m2-injection/sqli/senior.md`**

```markdown
# Piste senior — SQLi par identifiant

Le développeur *a* utilisé le template tag et *a* paramétré `q`. Il est quand
même vulnérable via `?sort=`. Explique pourquoi un identifiant de colonne ne
peut pas être un paramètre lié, et pourquoi l'allow-list est la seule réponse
correcte (pas l'échappement). Étends l'allow-list au tri multi-colonnes sans
rouvrir la faille.
```

- [ ] **Step 5: Commit**

```bash
git add labs/m1-access-control/overlay.yml labs/m2-injection/overlay.yml docs/modules/
git commit -m "docs(m1,m2): senior tracks + module overlays"
```

---

## Self-Review

**1. Spec coverage (P0 rows of §3 map):**
- M1 IDOR (orders/:id) → Task 10 ✓
- M1 mass assignment (PATCH /users/me) → Task 11 ✓
- M1 over-fetch (passwordHash) → Task 11 ✓
- M1 horizontal escalation (role from claim) → Task 11 ✓
- M1 SSRF (import-image) → Task 12 ✓
- M2 SQLi (search via sql.raw) → Task 13 ✓
- M2 SQLi by identifier (ORDER BY) → Task 13 ✓
- M2 command injection (PDF) → Task 15 ✓
- M2 prototype pollution (coupon merge) → Task 14 ✓
- M2 stored XSS (review) → Task 14 ✓
- Compose base (§5), Makefile (§2), worked IDOR test + 4-step artifacts (§4), Drizzle over-fetch bonus (§3) → Tasks 8, 9, 10, 11 ✓
- Out of P0 scope (deferred to later plans): M3–M9, docs Docusaurus site, VPS, offline bundle, `make tools`/`make check` k8s tooling. Noted in CLAUDE.md build-order table.

**2. Placeholder scan:** No "TBD/handle appropriately". Fixes shown as concrete code. The only "author two patches from one handler" step (Task 13 Step 4) gives the exact staging procedure. `make tools` (k8s/trivy) is intentionally out of P0 — it belongs to P2 (M7).

**3. Type consistency:** `signToken`/`verifyToken`/`Claims`, `req.user = {id,email,role}`, `loginAs`→`{auth:{Authorization}}`, `tokenFor(claims)`, `seedOrderFor`/`userId`, `deepMerge`, `renderInvoicePdf`, `fetchImage` — names/signatures consistent across tasks. `SEED_PASSWORD_HASH` exported from seed and reused by auth login and harness.

**4. Review Focus:** unauth→Task 8/10 ✓; cross-role→Task 11 ✓; non-existent id→Task 10 ✓; malformed JSON→Task 7 ✓; double-applied patch→Task 9 ✓.

---

## Notes for later plans (not P0)

- P1 (M3/M4/M5) adds: real password hashing + session rotation + account enumeration (M3); OIDC BFF, `oidc/verify.ts`, in-memory `jose` IdP with `forgeIdToken`, Keycloak `nc-connect-sim` realm overlay (M4); OpenBao overlay + `bao-init.sh`, dynamic Postgres creds, JWT `kid` rotation, `gitleaks` leak hunt (M5).
- P2 adds M7 (k3d, `Dockerfile` multi-stage rewrite, RBAC/NetworkPolicy/PSS manifests, `make up M=m7` special path, `make tools` with pinned trivy/kubectl/k3d) and M6 (Verdaccio/Gitea, trapped `@secdev/price-utils`, unsigned webhook).
- The `make test` target already runs the whole suite, so later modules only add specs + patches.
