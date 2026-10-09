import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import express from 'express'
import type { Server } from 'node:http'
import { apiRouter } from '../server/apiRouter'
import { setMemoryData } from '../server/storage'
import { createHesabyarMcpServer, createMcpRouter } from '../../mcp/server'
import { HesabyarApiClient } from '../../mcp/client/hesabyarApi'
import type { AppData } from '../lib/cascade'

describe('HesabYar MCP Server & Tools Integration Suite', () => {
  let server: Server
  let baseUrl: string
  const testUserId = 'test-user-mcp-1'
  const testToken = 'test-user-mcp-1'

  const initialData: AppData = {
    accounts: [
      {
        id: 'acc-mellat',
        name: 'بانک ملت',
        type: 'bank',
        classification: 'credit',
        archived: false,
        openingBalance: 15_000_000,
        balance: 15_000_000,
        createdAt: 1000,
        updatedAt: 1000,
      },
    ],
    transactions: [],
    plans: [],
    items: [],
    cheques: [
      {
        id: 'chq-1',
        sayadId: '1234567890123456',
        bankName: 'بانک ملی',
        amount: 50_000_000,
        dueDate: '2026-11-01',
        party: 'آقای رضایی',
        direction: 'payable',
        status: 'pending',
        note: 'بابت اجاره',
        createdAt: 1000,
      },
    ],
    debts: [
      {
        id: 'debt-1',
        direction: 'lent',
        party: 'علی محمدی',
        amount: 20_000_000,
        status: 'active',
        note: 'قرض‌الحسنه',
        createdAt: 1000,
      },
    ],
    cards: [
      {
        id: 'card-1',
        bankName: 'بانک ملت',
        holder: 'محمد احمدی',
        pan: '6104337812345678',
        expiry: '05/08',
        cvv: '123',
        sheba: 'IR120120000000001234567890',
        note: 'کارت حقوق',
        createdAt: 1000,
      },
    ],
    goals: [
      {
        id: 'goal-1',
        name: 'خرید لپ‌تاپ',
        target: 800_000_000,
        saved: 200_000_000,
        market: 'bank',
        createdAt: 1000,
      },
    ],
    investments: [
      {
        id: 'inv-1',
        name: 'سکه تمام بهار',
        market: 'gold',
        purchaseAmount: 400_000_000,
        currentValue: 480_000_000,
        createdAt: 1000,
      },
    ],
    reminders: {
      enabled: true,
      leadDays: 5,
    },
  }

  beforeAll(async () => {
    setMemoryData(testUserId, JSON.parse(JSON.stringify(initialData)))

    const app = express()
    app.use(express.json())
    app.use('/api/v1', apiRouter)
    app.use('/mcp', createMcpRouter())

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 3000
    baseUrl = `http://127.0.0.1:${port}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
  })

  it('creates McpServer instance with registered tools in all domains', () => {
    const mcp = createHesabyarMcpServer()
    expect(mcp).toBeDefined()
    const tools = (mcp as any)._registeredTools || {}
    const toolNames = Object.keys(tools)

    // Verify key tools across domains
    expect(toolNames).toContain('get_accounts')
    expect(toolNames).toContain('get_account_balance')
    expect(toolNames).toContain('create_account')
    expect(toolNames).toContain('get_transactions')
    expect(toolNames).toContain('create_transaction')
    expect(toolNames).toContain('create_transfer')
    expect(toolNames).toContain('get_categories')
    expect(toolNames).toContain('get_installment_plans')
    expect(toolNames).toContain('get_financial_report')
    expect(toolNames).toContain('get_cheques')
    expect(toolNames).toContain('create_cheque')
    expect(toolNames).toContain('get_debts')
    expect(toolNames).toContain('create_debt')
    expect(toolNames).toContain('get_cards')
    expect(toolNames).toContain('create_card')
    expect(toolNames).toContain('get_shared_ledgers')
    expect(toolNames).toContain('get_savings_goals')
    expect(toolNames).toContain('get_investments')
    expect(toolNames).toContain('get_upcoming_reminders')
  })

  it('queries HesabyarApiClient for cheques, debts, cards, savings, investments, and reminders', async () => {
    const client = new HesabyarApiClient(`${baseUrl}/api/v1`)
    const options = { token: testToken }

    // Cheques
    const cheques = await client.get<any[]>('/cheques', undefined, options)
    expect(cheques).toHaveLength(1)
    expect(cheques[0].sayadId).toBe('1234567890123456')

    // Debts
    const debts = await client.get<any[]>('/debts', undefined, options)
    expect(debts).toHaveLength(1)
    expect(debts[0].party).toBe('علی محمدی')

    // Cards
    const cards = await client.get<any[]>('/cards', undefined, options)
    expect(cards).toHaveLength(1)
    expect(cards[0].bankName).toBe('بانک ملت')

    // Savings
    const savings = await client.get<any[]>('/savings', undefined, options)
    expect(savings).toHaveLength(1)
    expect(savings[0].name).toBe('خرید لپ‌تاپ')

    // Investments
    const investments = await client.get<any[]>('/investments', undefined, options)
    expect(investments).toHaveLength(1)
    expect(investments[0].market).toBe('gold')

    // Reminders
    const upcoming = await client.get<any[]>('/reminders/upcoming', { leadDays: 30 }, options)
    expect(Array.isArray(upcoming)).toBe(true)
  })

  it('handles MCP health check endpoint', async () => {
    const res = await fetch(`${baseUrl}/mcp/health`)
    expect(res.ok).toBe(true)
    const json = (await res.json()) as any
    expect(json.status).toBe('ok')
    expect(json.mcp).toBe('HesabYar MCP Server')
    expect(json.toolsCount).toBeGreaterThan(15)
  })
})
