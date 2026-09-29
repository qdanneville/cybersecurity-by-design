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
