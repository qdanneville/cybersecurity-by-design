import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth.js'

export const adminRouter = Router()
// Reachable by anyone whose JWT *claims* ADMIN — role is never re-checked in DB (M1).
adminRouter.get('/summary', requireAuth, requireRole('ADMIN'), (_req, res) => {
  res.json({ secret: 'chiffre-affaires-interne', totalCents: 1234567 })
})
