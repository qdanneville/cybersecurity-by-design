import { describe, it, expect, beforeAll } from 'vitest'
import { app, resetDb, loginAs, seedOrderFor } from './_harness.js'

describe('M1 IDOR — GET /api/orders/:id', () => {
  beforeAll(async () => { await resetDb() })

  it("refuse l'accès à la commande d'un autre client", async () => {
    const alice = await loginAs('alice@example.com')
    const bobOrderId = await seedOrderFor('bob@example.com')

    const res = await app.get(`/api/orders/${bobOrderId}`).set(alice.auth)

    expect(res.status).toBe(404)         // 404, pas 403 : pas de fuite d'existence
    expect(res.body).not.toHaveProperty('totalCents')
  })

  it('renvoie 404 pour une commande inexistante', async () => {
    const alice = await loginAs('alice@example.com')
    const res = await app.get('/api/orders/999999').set(alice.auth)
    expect(res.status).toBe(404)
  })
})
