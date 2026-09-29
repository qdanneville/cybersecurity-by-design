import { describe, it, expect, beforeAll } from 'vitest'
import { app, resetDb } from './_harness.js'

describe('M2 SQLi — /api/products/search?q', () => {
  beforeAll(async () => { await resetDb() })
  it("neutralise une charge d'injection dans q", async () => {
    // UNION-style probe: on vulnerable code this errors (500) or leaks; secure code returns 200 [].
    const res = await app.get('/api/products/search').query({ q: "x' UNION SELECT email,password_hash,1 FROM users --" })
    expect(res.status).toBe(200)      // fails on vulnerable code (500 / leak)
    const bodyText = JSON.stringify(res.body)
    expect(bodyText).not.toContain('password_hash')
    expect(bodyText).not.toContain('@example.com')
  })
})
