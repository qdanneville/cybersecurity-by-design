import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { db, schema } from '../../db/index.js'
import { signToken } from '../../lib/jwt.js'
import { SEED_PASSWORD, SEED_PASSWORD_HASH } from '../../db/seed.js'

export const authRouter = Router()

// P0 login: all seeded users share one marker hash / password. Real per-user
// password hashing (and its weaknesses) arrive in M5; enumeration nuance in M3.
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
