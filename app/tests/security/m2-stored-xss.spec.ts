import { describe, it, expect, beforeAll } from 'vitest'
import { app, resetDb, loginAs } from './_harness.js'

describe('M2 stored XSS — product reviews', () => {
  beforeAll(async () => { await resetDb() })
  it('échappe le HTML des avis', async () => {
    const bob = await loginAs('bob@example.com')
    await app.post('/api/products/1/reviews').set(bob.auth).send({ body: '<script>alert(1)</script>' })
    const res = await app.get('/api/products/1/reviews.html')
    expect(res.text).not.toContain('<script>alert(1)</script>')  // fails on vulnerable code
    expect(res.text).toContain('&lt;script&gt;')
  })
})
