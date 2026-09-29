import { describe, it, expect, beforeAll } from 'vitest'
import { app, resetDb, loginAs } from './_harness.js'

describe('M1 SSRF — POST /api/products/import-image', () => {
  beforeAll(async () => { await resetDb() })
  it('refuse une URL vers une adresse interne/loopback', async () => {
    const carol = await loginAs('carol@example.com')
    const res = await app.post('/api/products/import-image').set(carol.auth)
      .send({ url: 'http://127.0.0.1:6379/' })
    expect(res.status).toBe(400)                 // fails on vulnerable code
    expect(res.body).not.toHaveProperty('upstreamStatus')
  })
})
