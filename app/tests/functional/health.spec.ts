import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'

describe('health', () => {
  it('returns ok', async () => {
    const res = await request(createApp()).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('returns 400 (not 500) on malformed JSON', async () => {
    const res = await request(createApp())
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ not json')
    expect(res.status).toBe(400)
  })
})
