import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { db, schema } from '../../db/index.js'
import { requireAuth } from '../../middleware/auth.js'
import { deepMerge } from '../../lib/merge.js'

export const couponsRouter = Router()

couponsRouter.post('/:code/rules', requireAuth, async (req, res) => {
  const rows = await db.select().from(schema.coupons).where(eq(schema.coupons.code, String(req.params.code)))
  const coupon = rows[0]
  if (!coupon) { res.status(404).json({ error: 'not found' }); return }
  const merged = deepMerge({ ...(coupon.rules as Record<string, unknown>) }, req.body ?? {})
  await db.update(schema.coupons).set({ rules: merged }).where(eq(schema.coupons.id, coupon.id))
  // Probe: expose whether Object.prototype got polluted.
  res.json({ rules: merged, polluted: ({} as Record<string, unknown>).polluted ?? null })
})
