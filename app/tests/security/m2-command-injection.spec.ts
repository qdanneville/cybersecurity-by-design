import { describe, it, expect, beforeAll } from 'vitest'
import { app, resetDb, loginAs } from './_harness.js'

describe('M2 command injection — invoice PDF title', () => {
  beforeAll(async () => { await resetDb() })
  it("ne permet pas d'exécuter une commande via title", async () => {
    const alice = await loginAs('alice@example.com')
    // Split marker: only a shell that runs command substitution assembles "PWNED".
    // Echoed literally (safe execFile) the bytes never form the contiguous token.
    const res = await app.get('/api/orders/invoices/1.pdf')
      .query({ title: '$(printf PW)$(printf NED)' }).set(alice.auth)
    expect(res.text).not.toContain('PWNED')   // fails on vulnerable code (shell runs substitution)
  })
})
