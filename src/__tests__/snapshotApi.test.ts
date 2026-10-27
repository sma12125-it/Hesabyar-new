import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import express from 'express'
import type { Server } from 'node:http'
import { apiRouter } from '../server/apiRouter'

let server: Server
let base = ''

beforeAll(async () => {
  const app = express()
  app.use(express.json())
  app.use('/api/v1', apiRouter)
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve())
  })
  const address = server.address()
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/v1`
})

afterAll(() => {
  server?.close()
})

describe('app server snapshot endpoint', () => {
  it('refuses reads without a signed-in user (no shared/latest snapshot)', async () => {
    const res = await fetch(`${base}/sync/snapshot?userId=default`, { headers: { 'x-user-id': 'default' } })
    expect(res.status).toBe(401)
  })

  it('refuses writes without a signed-in user', async () => {
    const res = await fetch(`${base}/sync/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'someone' },
      body: JSON.stringify({ userId: 'someone', data: { transactions: [] } }),
    })
    expect(res.status).toBe(401)
  })
})
