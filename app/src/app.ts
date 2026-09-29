import express, { type Express } from 'express'
import { authRouter } from './modules/auth/auth.routes.js'
import { ordersRouter } from './modules/orders/orders.routes.js'
import { usersRouter } from './modules/users/users.routes.js'
import { adminRouter } from './modules/admin/admin.routes.js'
import { errorHandler } from './middleware/errors.js'

export function createApp(): Express {
  const app = express()
  app.use(express.json())
  app.get('/api/health', (_req, res) => res.json({ ok: true }))
  app.use('/api/auth', authRouter)
  app.use('/api/orders', ordersRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/admin', adminRouter)
  // Further module routers are mounted here by later tasks (products).
  app.use(errorHandler)
  return app
}
