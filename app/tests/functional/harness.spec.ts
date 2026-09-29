import { describe, it, expect, beforeAll } from 'vitest'
import { app, resetDb, loginAs } from '../security/_harness.js'

describe('harness', () => {
  beforeAll(async () => { await resetDb() })

  it('logs a seeded user in', async () => {
    const alice = await loginAs('alice@example.com')
    expect(alice.auth.Authorization).toMatch(/^Bearer /)
  })

  it('rejects a missing Authorization header with 401', async () => {
    const res = await app.get('/api/orders/1')
    expect(res.status).toBe(401)
  })
})
