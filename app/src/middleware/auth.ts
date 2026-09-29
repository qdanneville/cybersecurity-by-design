import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../lib/jwt.js'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { user?: { id: number; email: string; role: string } }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthenticated' })
    return
  }
  try {
    const claims = verifyToken(header.slice('Bearer '.length))
    // NOTE: role trusted straight from the claim, never re-checked against the DB.
    req.user = { id: claims.sub, email: claims.email, role: claims.role }
    next()
  } catch {
    res.status(401).json({ error: 'invalid token' })
  }
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.user?.role !== role) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    next()
  }
}
