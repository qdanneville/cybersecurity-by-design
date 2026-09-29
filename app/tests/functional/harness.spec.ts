import { describe, it, expect, beforeAll } from 'vitest'
import { app, resetDb, loginAs } from '../security/_harness.js'

describe('harness', () => {
  beforeAll(async () => { await resetDb() })

  it('logs a seeded user in', async () => {
    const alice = await loginAs('alice@example.com')
    expect(alice.auth.Authorization).toMatch(/^Bearer /)
  })

  // Enabled in Task 10 once the orders router is mounted (before that the path 404s).
  it.todo('rejects a missing Authorization header with 401')
})
