import { Router } from 'express'
import { sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { requireAuth } from '../../middleware/auth.js'
import { fetchImage } from '../../lib/http-client.js'

export const productsRouter = Router()

// VULNERABLE (M2): q interpolated with sql.raw; sort interpolated into ORDER BY.
productsRouter.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '')
  const sort = String(req.query.sort ?? 'name')
  const rows = await db.execute(
    sql.raw(`SELECT id, name, price_cents FROM products WHERE name LIKE '%${q}%' ORDER BY ${sort}`),
  )
  res.json(rows.rows)
})

// VULNERABLE (M1 SSRF): fetches any URL the client supplies, server-side.
productsRouter.post('/import-image', requireAuth, async (req, res) => {
  const { url } = req.body ?? {}
  if (typeof url !== 'string') { res.status(400).json({ error: 'url required' }); return }
  const result = await fetchImage(url)
  res.json({ imported: true, upstreamStatus: result.status, contentType: result.contentType })
})
