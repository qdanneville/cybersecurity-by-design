import { describe, it, expect, beforeAll } from 'vitest'
import { app, resetDb, loginAs } from './_harness.js'

describe('M1 mass assignment — PATCH /api/users/me', () => {
  beforeAll(async () => { await resetDb() })
  it('ignore les champs privilégiés (role)', async () => {
    const alice = await loginAs('alice@example.com')
    const res = await app.patch('/api/users/me').set(alice.auth).send({ name: 'Alice2', role: 'ADMIN' })
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('CUSTOMER')     // fails on vulnerable code (becomes ADMIN)
    expect(res.body.name).toBe('Alice2')
  })
})
