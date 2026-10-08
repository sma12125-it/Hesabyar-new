import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import express from 'express'
import type { Server } from 'node:http'
import { apiRouter } from '../server/apiRouter'
import { setMemoryData } from '../server/storage'
import type { AppData } from '../lib/cascade'

function createTestApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/v1', apiRouter)
  return app
}

function initialUserData(): AppData {
  return {
    accounts: [
      {
        id: 'acc-1',
        name: 'بانک ملت',
        type: 'bank',
        openingBalance: 10_000_000,
        balance: 10_000_000,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'acc-2',
        name: 'بانک صادرات',
        type: 'bank',
        openingBalance: 5_000_000,
        balance: 5_000_000,
        archived: false,
        createdAt: 1001,
        updatedAt: 1001,
      },
    ],
    transactions: [
      {
        id: 'tx-1',
        kind: 'expense',
        amount: 2_000_000,
        accountId: 'acc-1',
        categoryId: 'food',
        note: 'خرید میوه',
        date: '2026-03-01',
        createdAt: 2000,
      },
    ],
    plans: [],
    items: [],
  }
}

describe('Hesabyar API Backend & Security', () => {
  const app = createTestApp()
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number }
        baseUrl = `http://127.0.0.1:${addr.port}/api/v1`
        resolve()
      })
    })
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  beforeEach(() => {
    // Setup clean test data for User A and User B
    setMemoryData('test-user-a', initialUserData())
    setMemoryData('test-user-b', {
      accounts: [
        {
          id: 'acc-b',
          name: 'بانک ملی کاربر ب',
          type: 'bank',
          openingBalance: 50_000_000,
          balance: 50_000_000,
          archived: false,
          createdAt: 3000,
          updatedAt: 3000,
        },
      ],
      transactions: [],
      plans: [],
      items: [],
    })
  })

  async function apiFetch(
    path: string,
    options: { method?: string; token?: string; body?: any } = {},
  ) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`
    }

    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    const data = await res.json().catch(() => null)
    return { status: res.status, body: data }
  }

  it('1. GET /api/v1/health is public and returns 200', async () => {
    const res = await apiFetch('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.features).toContain('MCP_READY')
  })

  it('2. Protected endpoints reject requests without token (401)', async () => {
    const res = await apiFetch('/accounts')
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('3. GET /api/v1/accounts returns user-specific accounts with correct balances', async () => {
    const res = await apiFetch('/accounts', { token: 'test-user-a' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.count).toBe(2)
    const mellat = res.body.data.find((a: any) => a.id === 'acc-1')
    // 10M opening - 2M expense = 8M IRR
    expect(mellat.balance).toBe(8_000_000)
    expect(mellat.balanceToman).toBe(800_000)
  })

  it('4. Multi-user isolation: User A cannot see User B accounts', async () => {
    const resA = await apiFetch('/accounts', { token: 'test-user-a' })
    const resB = await apiFetch('/accounts', { token: 'test-user-b' })

    expect(resA.body.data.some((a: any) => a.name.includes('کاربر ب'))).toBe(false)
    expect(resB.body.data.some((a: any) => a.name.includes('بانک ملت'))).toBe(false)
    expect(resB.body.data[0].balance).toBe(50_000_000)
  })

  it('5. GET /api/v1/accounts/:id/balance retrieves balance by fuzzy name', async () => {
    const res = await apiFetch('/accounts/ملت/balance', { token: 'test-user-a' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.account.name).toBe('بانک ملت')
    expect(res.body.data.account.balanceToman).toBe(800_000)
  })

  it('6. POST /api/v1/transactions with dryRun=true previews without mutating', async () => {
    const res = await apiFetch('/transactions', {
      method: 'POST',
      token: 'test-user-a',
      body: {
        account: 'بانک ملت',
        amount: 300_000,
        currency: 'IRT',
        type: 'expense',
        category: 'خرید',
        description: 'تست پیش‌نمایش خرید',
        dryRun: true,
      },
    })

    expect(res.status).toBe(200)
    expect(res.body.dryRun).toBe(true)
    expect(res.body.preview.balanceBefore).toBe(8_000_000)
    expect(res.body.preview.balanceAfter).toBe(5_000_000) // 8M - 3M Rials (300k Tomans)

    // Verify database was NOT modified
    const listRes = await apiFetch('/transactions', { token: 'test-user-a' })
    expect(listRes.body.total).toBe(1)
  })

  it('7. POST /api/v1/transactions persists transaction and updates balance', async () => {
    const res = await apiFetch('/transactions', {
      method: 'POST',
      token: 'test-user-a',
      body: {
        account: 'بانک ملت',
        amount: 300_000,
        currency: 'IRT',
        type: 'expense',
        category: 'خرید',
        description: 'خرید نهایی',
      },
    })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)

    const listRes = await apiFetch('/transactions', { token: 'test-user-a' })
    expect(listRes.body.total).toBe(2)

    const balanceRes = await apiFetch('/accounts/acc-1/balance', { token: 'test-user-a' })
    expect(balanceRes.body.data.account.balance).toBe(5_000_000)
  })

  it('8. POST /api/v1/transfers creates double-entry transfer between accounts', async () => {
    const res = await apiFetch('/transfers', {
      method: 'POST',
      token: 'test-user-a',
      body: {
        fromAccount: 'بانک ملت',
        toAccount: 'بانک صادرات',
        amount: 100_000,
        currency: 'IRT',
        description: 'انتقال شتابی بین دو حساب',
      },
    })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.outLeg.kind).toBe('transferOut')
    expect(res.body.data.inLeg.kind).toBe('transferIn')

    const mellat = await apiFetch('/accounts/acc-1/balance', { token: 'test-user-a' })
    const saderat = await apiFetch('/accounts/acc-2/balance', { token: 'test-user-a' })

    // Mellat: 8M - 1M = 7M
    expect(mellat.body.data.account.balance).toBe(7_000_000)
    // Saderat: 5M + 1M = 6M
    expect(saderat.body.data.account.balance).toBe(6_000_000)
  })

  it('9. GET /api/v1/reports returns comprehensive financial metrics', async () => {
    const res = await apiFetch('/reports', { token: 'test-user-a' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.totalAssets.amountRial).toBeGreaterThan(0)
  })

  it('10. GET /api/v1/mcp/tools provides MCP tool schema for ChatGPT', async () => {
    const res = await apiFetch('/mcp/tools')
    expect(res.status).toBe(200)
    expect(res.body.tools).toBeInstanceOf(Array)
    const toolNames = res.body.tools.map((t: any) => t.name)
    expect(toolNames).toContain('get_account_balance')
    expect(toolNames).toContain('record_expense_or_income')
    expect(toolNames).toContain('transfer_money')
  })
})
