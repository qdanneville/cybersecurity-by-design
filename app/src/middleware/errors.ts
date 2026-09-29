import type { Request, Response, NextFunction } from 'express'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // Malformed JSON from express.json() arrives here as a SyntaxError with status 400.
  const e = err as { status?: number; type?: string; stack?: string; message?: string }
  if (e?.status === 400 || e?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'invalid request body' })
    return
  }
  // Stack trace leaked in the HTTP response — intentional M8 finding.
  res.status(500).json({ error: e?.message ?? 'error', stack: e?.stack })
}
