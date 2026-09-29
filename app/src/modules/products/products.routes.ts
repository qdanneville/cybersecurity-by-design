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
