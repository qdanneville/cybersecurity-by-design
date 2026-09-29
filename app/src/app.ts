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
