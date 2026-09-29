import express, { type Express } from 'express'
import { authRouter } from './modules/auth/auth.routes.js'
import { ordersRouter } from './modules/orders/orders.routes.js'
import { errorHandler } from './middleware/errors.js'

export function createApp(): Express {
  const app = express()
  app.use(express.json())
  app.get('/api/health', (_req, res) => res.json({ ok: true }))
  app.use('/api/auth', authRouter)
  app.use('/api/orders', ordersRouter)
  // Further module routers are mounted here by later tasks (users, products).
  app.use(errorHandler)
  return app
}
