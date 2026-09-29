import { describe, it, expect, beforeAll } from 'vitest'
import { app, resetDb, loginAs, tokenFor, userId } from './_harness.js'

describe('M1 role escalation — forged role claim', () => {
  beforeAll(async () => { await resetDb() })
  it('un CUSTOMER avec un claim role=ADMIN forgé est refusé', async () => {
    const aliceId = await userId('alice@example.com')
    const forged = tokenFor({ sub: aliceId, email: 'alice@example.com', role: 'ADMIN' })
    const res = await app.get('/api/admin/summary').set({ Authorization: `Bearer ${forged}` })
    expect(res.status).toBe(403)   // fails on vulnerable code (200): role trusted from claim
  })
  it('un vrai CUSTOMER est refusé, un vrai ADMIN passe', async () => {
    const alice = await loginAs('alice@example.com')
    expect((await app.get('/api/admin/summary').set(alice.auth)).status).toBe(403)
    const admin = await loginAs('admin@example.com')
    expect((await app.get('/api/admin/summary').set(admin.auth)).status).toBe(200)
  })
})
