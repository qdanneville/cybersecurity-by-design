import { describe, it, expect, beforeAll } from 'vitest'
import { app, resetDb, loginAs } from './_harness.js'

describe('M1 over-fetch — GET /api/users', () => {
  beforeAll(async () => { await resetDb() })
  it('ne renvoie jamais passwordHash', async () => {
    const admin = await loginAs('admin@example.com')
    const res = await app.get('/api/users').set(admin.auth)
    expect(res.status).toBe(200)
    for (const u of res.body) expect(u).not.toHaveProperty('passwordHash') // fails on vulnerable
  })
})
