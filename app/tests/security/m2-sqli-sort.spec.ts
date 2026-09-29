import { describe, it, expect, beforeAll } from 'vitest'
import { app, resetDb } from './_harness.js'

describe('M2 SQLi — ORDER BY identifier', () => {
  beforeAll(async () => { await resetDb() })
  it("rejette un sort qui n'est pas une colonne autorisée", async () => {
    const res = await app.get('/api/products/search').query({ q: '', sort: '(SELECT 1)' })
    expect(res.status).toBe(400)      // fails on vulnerable code (200, injection executes)
  })
  it('accepte une colonne autorisée', async () => {
    const res = await app.get('/api/products/search').query({ q: '', sort: 'price_cents' })
    expect(res.status).toBe(200)
  })
})
