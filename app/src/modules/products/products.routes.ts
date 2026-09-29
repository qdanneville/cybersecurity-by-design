import { Router } from 'express'
import { sql, eq } from 'drizzle-orm'
import { db, schema } from '../../db/index.js'
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
