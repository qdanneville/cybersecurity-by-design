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
