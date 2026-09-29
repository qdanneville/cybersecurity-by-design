import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { app, resetDb, loginAs } from './_harness.js'

describe('M2 prototype pollution — coupon rules merge', () => {
  beforeAll(async () => { await resetDb() })
  afterEach(() => { delete (Object.prototype as Record<string, unknown>).polluted })
  it("ne pollue pas Object.prototype", async () => {
    const alice = await loginAs('alice@example.com')
    // Send raw JSON: supertest's object serializer drops a `__proto__` own key,
    // so the payload must go over the wire as a string to reach the merge.
    await app.post('/api/coupons/WELCOME10/rules').set(alice.auth)
      .set('Content-Type', 'application/json')
      .send('{"__proto__":{"polluted":"yes"}}')
    expect(({} as Record<string, unknown>).polluted).toBeUndefined() // fails on vulnerable code
  })
})
