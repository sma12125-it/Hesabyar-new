import { Router, type Request, type Response } from 'express'
import {
  archiveAccount,
  archiveInstallmentPlan,
  createAccount,
  createCard,
  createCheque,
  createDebt,
  createInstallmentPlan,
  createInvestment,
  createSavingsGoal,
  createTransaction,
  createTransfer,
  deleteCard,
  deleteCheque,
  deleteDebt,
  deleteInstallmentItem,
  deleteInstallmentPlan,
  deleteInvestment,
  deleteSavingsGoal,
  deleteTransaction,
  getAccountBalance,
  getAccounts,
  getCard,
  getCards,
  getCategories,
  getCheque,
  getCheques,
  getDebt,
  getDebts,
  getInstallmentItems,
  getInstallmentPlan,
  getInstallmentPlans,
  getInvestment,
  getInvestments,
  getRemindersSettings,
  getReports,
  getSavingsGoal,
  getSavingsGoals,
  getTransactions,
  getUpcomingReminders,
  linkCardToAccount,
  payInstallment,
  restoreAccount,
  restoreInstallmentPlan,
  searchTransactions,
  settleDebt,
  unpayInstallment,
  unsettleDebt,
  updateAccount,
  updateChequeStatus,
  updateInstallmentPlan,
  updateInvestment,
  updateRemindersSettings,
  updateSavingsGoal,
  updateTransaction,
} from '../lib/business/hesabyarBusiness'
import type { ChequeDirection, ChequeStatus, CurrencyUnit, DebtLoanDirection, DebtLoanStatus } from '../types'
import { requireAuth } from './auth'
import { loadUserData, saveUserData } from './storage'

export const apiRouter = Router()

/**
 * Health check endpoint (public)
 */
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'HesabYar API Backend',
    version: '0.2.0',
    timestamp: new Date().toISOString(),
    features: ['MCP_READY', 'REST_API', 'MULTI_USER', 'SUPABASE_SYNC', 'CONFIRMATION_FLOW'],
  })
})

/**
 * OpenAPI 3.1.0 specification for ChatGPT Actions & MCP Servers
 */
apiRouter.get('/openapi.json', (req: Request, res: Response) => {
  const host = req.get('host') || 'localhost:3000'
  const protocol = req.protocol
  const baseUrl = `${protocol}://${host}/api/v1`

  res.json({
    openapi: '3.1.0',
    info: {
      title: 'HesabYar Accounting API (حسابیار)',
      description: 'API و لایه منطقی حسابیار برای اتصال به ChatGPT، MCP Server و کلاینت‌های خارجی.',
      version: '1.0.0',
    },
    servers: [{ url: baseUrl }],
    paths: {
      '/accounts': {
        get: {
          summary: 'دریافت فهرست تمام حساب‌های مالی کاربر به همراه موجودی ریال و تومان',
          operationId: 'getAccounts',
          responses: {
            '200': { description: 'موفقیت‌آمیز' },
          },
        },
      },
      '/accounts/{id}/balance': {
        get: {
          summary: 'دریافت موجودی دقیق یک حساب با استفاده از شناسه یا نام حساب (مثلاً بانک ملت)',
          operationId: 'getAccountBalance',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'شناسه یا نام حساب (مثلاً بانک ملت)',
            },
          ],
          responses: {
            '200': { description: 'موفقیت‌آمیز' },
          },
        },
      },
      '/transactions': {
        get: {
          summary: 'دریافت تراکنش‌ها با امکان فیلتر بر اساس حساب، دسته، نوع، تاریخ و مبلغ',
          operationId: 'getTransactions',
          parameters: [
            { name: 'accountId', in: 'query', schema: { type: 'string' } },
            { name: 'categoryId', in: 'query', schema: { type: 'string' } },
            { name: 'kind', in: 'query', schema: { type: 'string', enum: ['expense', 'income', 'transferOut', 'transferIn'] } },
            { name: 'startDate', in: 'query', schema: { type: 'string' } },
            { name: 'endDate', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          ],
          responses: { '200': { description: 'موفقیت‌آمیز' } },
        },
        post: {
          summary: 'ثبت هزینه یا درآمد جدید با اعتبارسنجی موجودی و امکان پیش‌نمایش قبل از تأیید',
          operationId: 'createTransaction',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['account', 'amount', 'type'],
                  properties: {
                    account: { type: 'string', description: 'نام یا شناسه حساب (مثلاً بانک ملت)' },
                    amount: { type: 'number', description: 'مبلغ تراکنش' },
                    currency: { type: 'string', enum: ['IRR', 'IRT'], default: 'IRR', description: 'واحد پول: IRR (ریال) یا IRT (تومان)' },
                    type: { type: 'string', enum: ['expense', 'income'] },
                    category: { type: 'string', description: 'دسته تراکنش (مثلاً خرید، خوراک، حقوق)' },
                    description: { type: 'string', description: 'یادداشت یا بابت چه چیزی' },
                    date: { type: 'string', description: 'تاریخ میلادی YYYY-MM-DD (پیش‌فرض امروز)' },
                    dryRun: { type: 'boolean', description: 'اگر true باشد، فقط پیش‌نمایش و موجودی قبل/بعد را برمی‌گرداند بدون ثبت نهایی' },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'ثبت شد' } },
        },
      },
      '/transfers': {
        post: {
          summary: 'انتقال وجه دوطرفه بین دو حساب کاربر با اعتبارسنجی موجودی کافی و امکان پیش‌نمایش',
          operationId: 'createTransfer',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['fromAccount', 'toAccount', 'amount'],
                  properties: {
                    fromAccount: { type: 'string', description: 'حساب مبدأ' },
                    toAccount: { type: 'string', description: 'حساب مقصد' },
                    amount: { type: 'number', description: 'مبلغ انتقال' },
                    currency: { type: 'string', enum: ['IRR', 'IRT'], default: 'IRR' },
                    description: { type: 'string', description: 'توضیحات انتقال' },
                    date: { type: 'string' },
                    dryRun: { type: 'boolean', description: 'پیش‌نمایش قبل از تأیید نهایی' },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'انتقال انجام شد' } },
        },
      },
      '/categories': {
        get: {
          summary: 'دریافت فهرست تمام دسته‌بندی‌های هزینه و درآمد',
          operationId: 'getCategories',
          responses: { '200': { description: 'موفقیت‌آمیز' } },
        },
      },
      '/reports': {
        get: {
          summary: 'دریافت گزارش مالی جامع، مجموع درآمد و هزینه، دارایی‌ها و نمودار ماهانه',
          operationId: 'getReports',
          responses: { '200': { description: 'موفقیت‌آمیز' } },
        },
      },
    },
  })
})

/**
 * Model Context Protocol (MCP) Tools Manifest for ChatGPT MCP Server
 */
apiRouter.get('/mcp/tools', (_req: Request, res: Response) => {
  res.json({
    tools: [
      {
        name: 'get_account_balance',
        description: 'بررسی موجودی حساب یا بانک‌های کاربر در حسابیار (مانند موجودی حساب بانک ملت، بانک ملی، پول نقد و غیره)',
        inputSchema: {
          type: 'object',
          properties: {
            account: { type: 'string', description: 'نام یا شناسه حساب (مثلاً "بانک ملت")' },
          },
          required: ['account'],
        },
      },
      {
        name: 'list_accounts',
        description: 'مشاهده لیست تمام حساب‌های مالی کاربر به همراه موجودی ریال و تومان',
        inputSchema: {
          type: 'object',
          properties: {
            includeArchived: { type: 'boolean', description: 'شامل حساب‌های بایگانی‌شده' },
          },
        },
      },
      {
        name: 'record_expense_or_income',
        description: 'ثبت یک هزینه یا درآمد جدید در حساب مشخص. از پارامتر dryRun=true برای پیش‌نمایش و گرفتن تأیید از کاربر قبل از ثبت قطعی استفاده کنید.',
        inputSchema: {
          type: 'object',
          properties: {
            account: { type: 'string', description: 'نام یا شناسه حساب' },
            amount: { type: 'number', description: 'مبلغ' },
            currency: { type: 'string', enum: ['IRT', 'IRR'], default: 'IRT', description: 'واحد پول (پیش‌فرض تومان IRT)' },
            type: { type: 'string', enum: ['expense', 'income'], description: 'نوع: هزینه (expense) یا درآمد (income)' },
            category: { type: 'string', description: 'دسته مانند خرید، سوپرمارکت، حقوق، هدیه' },
            description: { type: 'string', description: 'توضیحات و بابت چه چیزی' },
            dryRun: { type: 'boolean', description: 'آیا فقط پیش‌نمایش است و تأیید کاربر نیاز دارد؟' },
          },
          required: ['account', 'amount', 'type'],
        },
      },
      {
        name: 'transfer_money',
        description: 'انتقال وجه بین دو حساب مالی کاربر. با dryRun=true پیش‌نمایش موجودی‌های جدید را نشان می‌دهد.',
        inputSchema: {
          type: 'object',
          properties: {
            fromAccount: { type: 'string', description: 'حساب مبدأ' },
            toAccount: { type: 'string', description: 'حساب مقصد' },
            amount: { type: 'number', description: 'مبلغ' },
            currency: { type: 'string', enum: ['IRT', 'IRR'], default: 'IRT' },
            description: { type: 'string', description: 'توضیحات انتقال' },
            dryRun: { type: 'boolean' },
          },
          required: ['fromAccount', 'toAccount', 'amount'],
        },
      },
      {
        name: 'search_transactions',
        description: 'جستجوی تراکنش‌ها و هزینه‌ها بر اساس کلمه، تاریخ، دسته یا توضیحات',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'عبارت جستجو' },
            limit: { type: 'integer', default: 20 },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_financial_reports',
        description: 'دریافت گزارش‌های مالی، مجموع هزینه‌ها، درآمدها، پس‌انداز و تقسیم‌بندی دسته‌ها',
        inputSchema: {
          type: 'object',
          properties: {
            month: { type: 'string', description: 'کد ماه شمسی یا تاریخ میلادی اختیاری' },
          },
        },
      },
    ],
  })
})

/**
 * Human-readable API Documentation & Interactive Console
 */
apiRouter.get('/docs', (_req: Request, res: Response) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>مستندات API حسابیار (HesabYar)</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Vazirmatn', sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; margin: 0; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; background: #1e293b; padding: 2rem; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h1 { color: #38bdf8; border-bottom: 2px solid #334155; padding-bottom: 0.5rem; }
    h2 { color: #a5f3fc; margin-top: 1.5rem; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 0.8rem; margin-left: 8px; }
    .get { background: #0284c7; color: white; }
    .post { background: #16a34a; color: white; }
    .patch { background: #d97706; color: white; }
    .delete { background: #dc2626; color: white; }
    .endpoint { background: #0f172a; padding: 12px 16px; border-radius: 8px; margin: 10px 0; border: 1px solid #334155; font-family: monospace; font-size: 0.95rem; }
    code { background: #0f172a; padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #f43f5e; }
    pre { background: #0f172a; padding: 1rem; border-radius: 8px; overflow-x: auto; color: #38bdf8; border: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="container">
    <h1>💳 مستندات RESTful API و اتصال به ChatGPT حسابیار</h1>
    <p>این API اتصال امن، چندکاربره و استانداردی را بین حساب‌های شخصی شما در حسابیار و ChatGPT یا سایر ابزارهای هوش مصنوعی (MCP) فراهم می‌سازد.</p>

    <h2>احراز هویت (Authentication)</h2>
    <p>تمام درخواست‌ها باید شامل هدر <code>Authorization: Bearer &lt;TOKEN&gt;</code> باشند. توکن احراز هویت مستقیماً با سرور Supabase بررسی شده و شناسه کاربری به صورت امن استخراج می‌شود.</p>

    <h2>فهرست Endpointها</h2>
    <div class="endpoint"><span class="badge get">GET</span> /api/v1/accounts - لیست تمام حساب‌ها و موجودی</div>
    <div class="endpoint"><span class="badge get">GET</span> /api/v1/accounts/:id/balance - موجودی حساب مشخص بر حسب نام یا شناسه</div>
    <div class="endpoint"><span class="badge get">GET</span> /api/v1/transactions - دریافت و فیلتر تراکنش‌ها</div>
    <div class="endpoint"><span class="badge get">GET</span> /api/v1/transactions/search?q=... - جستجوی هوشمند در تراکنش‌ها</div>
    <div class="endpoint"><span class="badge post">POST</span> /api/v1/transactions - ثبت هزینه یا درآمد (با پشتیبانی از dryRun برای گرفتن تأیید)</div>
    <div class="endpoint"><span class="badge patch">PATCH</span> /api/v1/transactions/:id - ویرایش تراکنش</div>
    <div class="endpoint"><span class="badge delete">DELETE</span> /api/v1/transactions/:id - حذف تراکنش با به‌روزرسانی خودکار تراز</div>
    <div class="endpoint"><span class="badge post">POST</span> /api/v1/transfers - انتقال وجه دوطرفه بین حساب‌ها</div>
    <div class="endpoint"><span class="badge get">GET</span> /api/v1/categories - فهرست دسته‌بندی‌ها</div>
    <div class="endpoint"><span class="badge get">GET</span> /api/v1/reports - گزارش‌های مالی، پس‌انداز و هزینه‌ها</div>
    <div class="endpoint"><span class="badge get">GET</span> /api/v1/mcp/tools - مشخصات ابزارهای ChatGPT MCP Server</div>
    <div class="endpoint"><span class="badge get">GET</span> /api/v1/openapi.json - مشخصات کامل OpenAPI 3.1.0</div>

    <h2>نمونه درخواست ثبت هزینه با واحد تومان</h2>
    <pre>POST /api/v1/transactions
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "account": "بانک ملت",
  "amount": 2000000,
  "currency": "IRT",
  "type": "expense",
  "category": "خرید",
  "description": "خرید پوشاک عید"
}</pre>
  </div>
</body>
</html>`)
})

// ============================================================================
// RESTFUL SECURE ENDPOINTS (Require Authentication)
// ============================================================================

/**
 * GET /api/v1/accounts
 */
apiRouter.get('/accounts', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const includeArchived = req.query.includeArchived === 'true'
    const accounts = getAccounts(data, { includeArchived })
    res.json({ success: true, count: accounts.length, data: accounts })
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'خطای سرور' })
  }
})

/**
 * GET /api/v1/accounts/:id/balance
 */
apiRouter.get('/accounts/:id/balance', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const result = getAccountBalance(data, String(req.params.id))
    res.json({ success: true, data: result })
  } catch (err) {
    res.status(404).json({ success: false, error: err instanceof Error ? err.message : 'حساب پیدا نشد' })
  }
})

/**
 * GET /api/v1/accounts/:id
 */
apiRouter.get('/accounts/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const result = getAccountBalance(data, String(req.params.id))
    res.json({ success: true, data: result.account })
  } catch (err) {
    res.status(404).json({ success: false, error: err instanceof Error ? err.message : 'حساب پیدا نشد' })
  }
})

/**
 * GET /api/v1/transactions/search
 */
apiRouter.get('/transactions/search', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const q = typeof req.query.q === 'string' ? req.query.q : ''
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 30
    const results = searchTransactions(data, q, limit)
    res.json({ success: true, count: results.length, data: results })
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'خطای سرور' })
  }
})

/**
 * GET /api/v1/transactions
 */
apiRouter.get('/transactions', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const { total, transactions } = getTransactions(data, {
      accountId: typeof req.query.accountId === 'string' ? req.query.accountId : undefined,
      categoryId: typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined,
      kind: typeof req.query.kind === 'string' ? (req.query.kind as any) : undefined,
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
      minAmount: typeof req.query.minAmount === 'string' ? Number(req.query.minAmount) : undefined,
      maxAmount: typeof req.query.maxAmount === 'string' ? Number(req.query.maxAmount) : undefined,
      limit: typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined,
      offset: typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : undefined,
    })
    res.json({ success: true, total, data: transactions })
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'خطای سرور' })
  }
})

/**
 * GET /api/v1/transactions/:id
 */
apiRouter.get('/transactions/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const tx = data.transactions.find((t) => t.id === req.params.id)
    if (!tx) {
      res.status(404).json({ success: false, error: 'تراکنش پیدا نشد' })
      return
    }
    const { transactions } = getTransactions(data, { limit: 1 })
    const decorated = transactions.find((t) => t.id === req.params.id) || tx
    res.json({ success: true, data: decorated })
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'خطای سرور' })
  }
})

/**
 * POST /api/v1/transactions
 */
apiRouter.post('/transactions', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {}
    if (!body.account || body.amount == null || !body.type) {
      res.status(400).json({
        success: false,
        error: 'فیلدهای الزامی: account (نام یا شناسه حساب)، amount (مبلغ) و type (expense یا income)',
      })
      return
    }

    const data = await loadUserData(req.user!)
    const dryRun = Boolean(body.dryRun)

    const result = createTransaction(
      data,
      {
        account: String(body.account),
        amount: Number(body.amount),
        currency: (body.currency as CurrencyUnit) || 'IRR',
        type: body.type === 'income' ? 'income' : 'expense',
        category: body.category ? String(body.category) : undefined,
        description: body.description ? String(body.description) : body.note ? String(body.note) : undefined,
        date: body.date ? String(body.date) : undefined,
        source: body.source || 'api',
        receiptPhoto: body.receiptPhoto,
        tags: Array.isArray(body.tags) ? body.tags : undefined,
      },
      { dryRun },
    )

    if (!dryRun) {
      await saveUserData(req.user!, result.nextData)
    }

    res.status(dryRun ? 200 : 201).json({
      success: true,
      dryRun,
      message: dryRun
        ? 'پیش‌نمایش تراکنش با موفقیت ایجاد شد (تأیید کاربر لازم است)'
        : 'تراکنش با موفقیت ثبت شد',
      data: result.transaction,
      preview: result.previewData,
    })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در ثبت تراکنش' })
  }
})

/**
 * PATCH /api/v1/transactions/:id
 */
apiRouter.patch('/transactions/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const body = req.body || {}
    const dryRun = Boolean(body.dryRun)

    const result = updateTransaction(
      data,
      String(req.params.id),
      {
        amount: body.amount != null ? Number(body.amount) : undefined,
        currency: body.currency,
        account: body.account,
        category: body.category,
        description: body.description ?? body.note,
        date: body.date,
        type: body.type,
        fromAccount: body.fromAccount,
        toAccount: body.toAccount,
        receiptPhoto: body.receiptPhoto,
        tags: body.tags,
      },
      { dryRun },
    )

    if (!dryRun) {
      await saveUserData(req.user!, result.nextData)
    }

    res.json({
      success: true,
      dryRun,
      message: 'تراکنش با موفقیت ویرایش شد',
      data: result.transaction,
    })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در ویرایش تراکنش' })
  }
})

/**
 * DELETE /api/v1/transactions/:id
 */
apiRouter.delete('/transactions/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const dryRun = Boolean(req.query.dryRun === 'true' || req.body?.dryRun)

    const result = deleteTransaction(data, String(req.params.id), { dryRun })

    if (!dryRun) {
      await saveUserData(req.user!, result.nextData)
    }

    res.json({
      success: true,
      dryRun,
      message: 'تراکنش با موفقیت حذف شد',
      data: result.deletedTransaction,
    })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در حذف تراکنش' })
  }
})

/**
 * POST /api/v1/transfers
 */
apiRouter.post('/transfers', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {}
    if (!body.fromAccount || !body.toAccount || body.amount == null) {
      res.status(400).json({
        success: false,
        error: 'فیلدهای الزامی: fromAccount (حساب مبدأ)، toAccount (حساب مقصد) و amount (مبلغ)',
      })
      return
    }

    const data = await loadUserData(req.user!)
    const dryRun = Boolean(body.dryRun)

    const result = createTransfer(
      data,
      {
        fromAccount: String(body.fromAccount),
        toAccount: String(body.toAccount),
        amount: Number(body.amount),
        currency: (body.currency as CurrencyUnit) || 'IRR',
        date: body.date ? String(body.date) : undefined,
        description: body.description ? String(body.description) : body.note ? String(body.note) : undefined,
        source: body.source || 'api',
      },
      { dryRun },
    )

    if (!dryRun) {
      await saveUserData(req.user!, result.nextData)
    }

    res.status(dryRun ? 200 : 201).json({
      success: true,
      dryRun,
      message: dryRun
        ? 'پیش‌نمایش انتقال با موفقیت ایجاد شد (تأیید کاربر لازم است)'
        : 'انتقال با موفقیت انجام شد',
      data: {
        outLeg: result.outLeg,
        inLeg: result.inLeg,
      },
      preview: result.previewData,
    })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در انتقال وجه' })
  }
})

/**
 * GET /api/v1/categories
 */
apiRouter.get('/categories', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const cats = getCategories()
    res.json({ success: true, data: cats })
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'خطای سرور' })
  }
})

/**
 * GET /api/v1/reports
 */
apiRouter.get('/reports', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const endIso = typeof req.query.date === 'string' ? req.query.date : undefined
    const reports = getReports(data, { endIso })
    res.json({ success: true, data: reports })
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'خطای سرور' })
  }
})

// ============================================================================
// INSTALLMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/installments/plans
 */
apiRouter.get('/installments/plans', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const plans = getInstallmentPlans(data)
    res.json({ success: true, count: plans.length, data: plans })
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'خطای سرور' })
  }
})

/**
 * GET /api/v1/installments/plans/:id
 */
apiRouter.get('/installments/plans/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const result = getInstallmentPlan(data, String(req.params.id))
    res.json({ success: true, data: result })
  } catch (err) {
    res.status(404).json({ success: false, error: err instanceof Error ? err.message : 'برنامه پیدا نشد' })
  }
})

/**
 * POST /api/v1/installments/plans
 */
apiRouter.post('/installments/plans', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {}
    const data = await loadUserData(req.user!)
    const result = createInstallmentPlan(data, {
      name: String(body.name),
      installmentAmount: Number(body.installmentAmount),
      totalCount: Number(body.totalCount),
      startDate: String(body.startDate),
      defaultAccountId: String(body.defaultAccountId),
      kind: body.kind,
      principal: body.principal != null ? Number(body.principal) : undefined,
      annualRatePercent: body.annualRatePercent != null ? Number(body.annualRatePercent) : undefined,
    })
    await saveUserData(req.user!, result.nextData)
    res.status(201).json({ success: true, data: result.plan, itemsCount: result.items.length })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در ایجاد برنامه اقساط' })
  }
})

/**
 * PATCH /api/v1/installments/plans/:id
 */
apiRouter.patch('/installments/plans/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {}
    const data = await loadUserData(req.user!)
    const result = updateInstallmentPlan(data, String(req.params.id), {
      name: body.name ? String(body.name) : undefined,
      defaultAccountId: body.defaultAccountId ? String(body.defaultAccountId) : undefined,
    })
    await saveUserData(req.user!, result.nextData)
    res.json({ success: true, data: result.plan })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در ویرایش برنامه اقساط' })
  }
})

/**
 * DELETE /api/v1/installments/plans/:id
 */
apiRouter.delete('/installments/plans/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const result = deleteInstallmentPlan(data, String(req.params.id))
    await saveUserData(req.user!, result.nextData)
    res.json({ success: true, message: 'برنامه اقساط با موفقیت حذف شد' })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در حذف برنامه اقساط' })
  }
})

/**
 * POST /api/v1/installments/plans/:id/archive
 */
apiRouter.post('/installments/plans/:id/archive', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const result = archiveInstallmentPlan(data, String(req.params.id))
    await saveUserData(req.user!, result.nextData)
    res.json({ success: true, data: result.plan })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در بایگانی' })
  }
})

/**
 * POST /api/v1/installments/plans/:id/restore
 */
apiRouter.post('/installments/plans/:id/restore', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const result = restoreInstallmentPlan(data, String(req.params.id))
    await saveUserData(req.user!, result.nextData)
    res.json({ success: true, data: result.plan })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در بازگردانی' })
  }
})

/**
 * GET /api/v1/installments/items
 */
apiRouter.get('/installments/items', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const planId = typeof req.query.planId === 'string' ? req.query.planId : undefined
    const items = getInstallmentItems(data, planId)
    res.json({ success: true, count: items.length, data: items })
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'خطای سرور' })
  }
})

/**
 * POST /api/v1/installments/items/:id/pay
 */
apiRouter.post('/installments/items/:id/pay', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {}
    if (!body.accountId) {
      res.status(400).json({ success: false, error: 'حساب پرداخت الزامی است (accountId)' })
      return
    }
    const data = await loadUserData(req.user!)
    const result = payInstallment(data, String(req.params.id), String(body.accountId), body.note)
    await saveUserData(req.user!, result.nextData)
    res.json({ success: true, message: 'قسط با موفقیت پرداخت شد', data: result.item, expense: result.expense })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در پرداخت قسط' })
  }
})

/**
 * POST /api/v1/installments/items/:id/unpay
 */
apiRouter.post('/installments/items/:id/unpay', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const result = unpayInstallment(data, String(req.params.id))
    await saveUserData(req.user!, result.nextData)
    res.json({ success: true, message: 'وضعیت پرداخت قسط با موفقیت لغو شد' })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در لغو پرداخت قسط' })
  }
})

/**
 * DELETE /api/v1/installments/items/:id
 */
apiRouter.delete('/installments/items/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const result = deleteInstallmentItem(data, String(req.params.id))
    await saveUserData(req.user!, result.nextData)
    res.json({ success: true, message: 'قسط با موفقیت حذف شد' })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در حذف قسط' })
  }
})

// ============================================================================
// ACCOUNT MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * POST /api/v1/accounts
 */
apiRouter.post('/accounts', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {}
    if (!body.name) {
      res.status(400).json({ success: false, error: 'نام حساب الزامی است (name)' })
      return
    }
    const data = await loadUserData(req.user!)
    const result = createAccount(data, {
      name: String(body.name),
      type: body.type === 'bank' ? 'bank' : 'cash',
      classification: body.classification,
      initialBalance: Number(body.initialBalance || 0),
      currency: (body.currency as CurrencyUnit) || 'IRT',
      accountNumber: body.accountNumber ? String(body.accountNumber) : undefined,
      cardId: body.cardId ? String(body.cardId) : undefined,
    })
    await saveUserData(req.user!, result.nextData)
    res.status(201).json({ success: true, data: result.account })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در ایجاد حساب' })
  }
})

/**
 * PATCH /api/v1/accounts/:id
 */
apiRouter.patch('/accounts/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {}
    const data = await loadUserData(req.user!)
    const result = updateAccount(data, String(req.params.id), {
      name: body.name ? String(body.name) : undefined,
      type: body.type,
      accountNumber: body.accountNumber,
    })
    await saveUserData(req.user!, result.nextData)
    res.json({ success: true, data: result.account })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در ویرایش حساب' })
  }
})

/**
 * POST /api/v1/accounts/:id/archive
 */
apiRouter.post('/accounts/:id/archive', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const result = archiveAccount(data, String(req.params.id))
    await saveUserData(req.user!, result.nextData)
    res.json({ success: true, data: result.account })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در بایگانی حساب' })
  }
})

/**
 * POST /api/v1/accounts/:id/restore
 */
apiRouter.post('/accounts/:id/restore', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const result = restoreAccount(data, String(req.params.id))
    await saveUserData(req.user!, result.nextData)
    res.json({ success: true, data: result.account })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در بازگردانی حساب' })
  }
})

// ============================================================================
// CHEQUES ENDPOINTS (چک‌ها)
// ============================================================================

/**
 * GET /api/v1/cheques
 */
apiRouter.get('/cheques', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const status = typeof req.query.status === 'string' ? (req.query.status as ChequeStatus) : undefined
    const direction = typeof req.query.direction === 'string' ? (req.query.direction as ChequeDirection) : undefined
    const cheques = getCheques(data, { status, direction })
    res.json({ success: true, count: cheques.length, data: cheques })
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'خطای سرور' })
  }
})

/**
 * GET /api/v1/cheques/:id
 */
apiRouter.get('/cheques/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const cheque = getCheque(data, String(req.params.id))
    res.json({ success: true, data: cheque })
  } catch (err) {
    res.status(404).json({ success: false, error: err instanceof Error ? err.message : 'چک پیدا نشد' })
  }
})

/**
 * POST /api/v1/cheques
 */
apiRouter.post('/cheques', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {}
    if (!body.sayadId || !body.bankName || !body.amount || !body.dueDate || !body.party || !body.direction) {
      res.status(400).json({
        success: false,
        error: 'فیلدهای الزامی: sayadId, bankName, amount, dueDate, party, direction',
      })
      return
    }
    const data = await loadUserData(req.user!)
    const result = createCheque(data, {
      direction: body.direction,
      sayadId: String(body.sayadId),
      bankName: String(body.bankName),
      amount: Number(body.amount),
      dueDate: String(body.dueDate),
      party: String(body.party),
      note: body.note ? String(body.note) : undefined,
      accountId: body.accountId ? String(body.accountId) : undefined,
      currency: (body.currency as CurrencyUnit) || 'IRT',
    })
    await saveUserData(req.user!, result.nextData)
    res.status(201).json({ success: true, data: result.cheque })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در ثبت چک' })
  }
})

/**
 * PATCH /api/v1/cheques/:id/status
 */
apiRouter.patch('/cheques/:id/status', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {}
    if (!body.status) {
      res.status(400).json({ success: false, error: 'وضعیت جدید الزامی است (status: pending | cleared | bounced)' })
      return
    }
    const data = await loadUserData(req.user!)
    const result = updateChequeStatus(data, String(req.params.id), body.status as ChequeStatus, body.clearedDate)
    await saveUserData(req.user!, result.nextData)
    res.json({ success: true, data: result.cheque })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در تغییر وضعیت چک' })
  }
})

/**
 * DELETE /api/v1/cheques/:id
 */
apiRouter.delete('/cheques/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const result = deleteCheque(data, String(req.params.id))
    await saveUserData(req.user!, result.nextData)
    res.json({ success: true, message: 'چک با موفقیت حذف شد' })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در حذف چک' })
  }
})

// ============================================================================
// DEBTS & LOANS ENDPOINTS (بدهی و طلب)
// ============================================================================

/**
 * GET /api/v1/debts
 */
apiRouter.get('/debts', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const status = typeof req.query.status === 'string' ? (req.query.status as DebtLoanStatus) : undefined
    const direction = typeof req.query.direction === 'string' ? (req.query.direction as DebtLoanDirection) : undefined
    const debts = getDebts(data, { status, direction })
    res.json({ success: true, count: debts.length, data: debts })
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'خطای سرور' })
  }
})

/**
 * GET /api/v1/debts/:id
 */
apiRouter.get('/debts/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const debt = getDebt(data, String(req.params.id))
    res.json({ success: true, data: debt })
  } catch (err) {
    res.status(404).json({ success: false, error: err instanceof Error ? err.message : 'طلب یا بدهی پیدا نشد' })
  }
})

/**
 * POST /api/v1/debts
 */
apiRouter.post('/debts', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {}
    if (!body.direction || !body.party || !body.amount) {
      res.status(400).json({ success: false, error: 'فیلدهای الزامی: direction (borrowed | lent), party, amount' })
      return
    }
    const data = await loadUserData(req.user!)
    const result = createDebt(data, {
      direction: body.direction,
      party: String(body.party),
      amount: Number(body.amount),
      dueDate: body.dueDate ? String(body.dueDate) : undefined,
      note: body.note ? String(body.note) : undefined,
      accountId: body.accountId ? String(body.accountId) : undefined,
      currency: (body.currency as CurrencyUnit) || 'IRT',
    })
    await saveUserData(req.user!, result.nextData)
    res.status(201).json({ success: true, data: result.debt })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در ثبت طلب یا بدهی' })
  }
})

/**
 * POST /api/v1/debts/:id/settle
 */
apiRouter.post('/debts/:id/settle', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const result = settleDebt(data, String(req.params.id), req.body?.accountId)
    await saveUserData(req.user!, result.nextData)
    res.json({ success: true, message: 'با موفقیت تسویه شد', data: result.debt })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در تسویه' })
  }
})

/**
 * POST /api/v1/debts/:id/unsettle
 */
apiRouter.post('/debts/:id/unsettle', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const result = unsettleDebt(data, String(req.params.id))
    await saveUserData(req.user!, result.nextData)
    res.json({ success: true, message: 'وضعیت تسویه لغو شد', data: result.debt })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در لغو تسویه' })
  }
})

/**
 * DELETE /api/v1/debts/:id
 */
apiRouter.delete('/debts/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const result = deleteDebt(data, String(req.params.id))
    await saveUserData(req.user!, result.nextData)
    res.json({ success: true, message: 'مورد با موفقیت حذف شد' })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در حذف' })
  }
})

// ============================================================================
// BANK CARDS ENDPOINTS (کارت‌های بانکی)
// ============================================================================

/**
 * GET /api/v1/cards
 */
apiRouter.get('/cards', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const cards = getCards(data)
    res.json({ success: true, count: cards.length, data: cards })
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'خطای سرور' })
  }
})

/**
 * GET /api/v1/cards/:id
 */
apiRouter.get('/cards/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const card = getCard(data, String(req.params.id))
    res.json({ success: true, data: card })
  } catch (err) {
    res.status(404).json({ success: false, error: err instanceof Error ? err.message : 'کارت پیدا نشد' })
  }
})

/**
 * POST /api/v1/cards
 */
apiRouter.post('/cards', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {}
    if (!body.bankName || !body.holder || !body.pan) {
      res.status(400).json({ success: false, error: 'فیلدهای الزامی: bankName, holder, pan (شماره ۱۶ رقمی)' })
      return
    }
    const data = await loadUserData(req.user!)
    const result = createCard(data, {
      bankName: String(body.bankName),
      holder: String(body.holder),
      pan: String(body.pan),
      expiry: body.expiry ? String(body.expiry) : undefined,
      cvv: body.cvv ? String(body.cvv) : undefined,
      sheba: body.sheba ? String(body.sheba) : undefined,
      note: body.note ? String(body.note) : undefined,
      accountId: body.accountId ? String(body.accountId) : undefined,
      color: body.color ? String(body.color) : undefined,
    })
    await saveUserData(req.user!, result.nextData)
    res.status(201).json({ success: true, data: result.card })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در ثبت کارت' })
  }
})

/**
 * POST /api/v1/cards/:id/link
 */
apiRouter.post('/cards/:id/link', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {}
    if (!body.accountId) {
      res.status(400).json({ success: false, error: 'شناسه حساب الزامی است (accountId)' })
      return
    }
    const data = await loadUserData(req.user!)
    const result = linkCardToAccount(data, String(req.params.id), String(body.accountId))
    await saveUserData(req.user!, result.nextData)
    res.json({ success: true, message: 'کارت به حساب متصل شد', data: result.card })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در اتصال کارت' })
  }
})

/**
 * DELETE /api/v1/cards/:id
 */
apiRouter.delete('/cards/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const result = deleteCard(data, String(req.params.id))
    await saveUserData(req.user!, result.nextData)
    res.json({ success: true, message: 'کارت با موفقیت حذف شد' })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در حذف کارت' })
  }
})

// ============================================================================
// SAVINGS GOALS ENDPOINTS (اهداف پس‌انداز و قلک)
// ============================================================================

/**
 * GET /api/v1/savings
 */
apiRouter.get('/savings', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const goals = getSavingsGoals(data)
    res.json({ success: true, count: goals.length, data: goals })
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'خطای سرور' })
  }
})

/**
 * GET /api/v1/savings/:id
 */
apiRouter.get('/savings/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const goal = getSavingsGoal(data, String(req.params.id))
    res.json({ success: true, data: goal })
  } catch (err) {
    res.status(404).json({ success: false, error: err instanceof Error ? err.message : 'هدف پس‌انداز پیدا نشد' })
  }
})

/**
 * POST /api/v1/savings
 */
apiRouter.post('/savings', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {}
    if (!body.name || !body.target) {
      res.status(400).json({ success: false, error: 'فیلدهای الزامی: name, target' })
      return
    }
    const data = await loadUserData(req.user!)
    const result = createSavingsGoal(data, {
      name: String(body.name),
      target: Number(body.target),
      saved: body.saved != null ? Number(body.saved) : 0,
      market: body.market,
      targetDate: body.targetDate ? String(body.targetDate) : undefined,
      icon: body.icon ? String(body.icon) : undefined,
      note: body.note ? String(body.note) : undefined,
      currency: (body.currency as CurrencyUnit) || 'IRT',
    })
    await saveUserData(req.user!, result.nextData)
    res.status(201).json({ success: true, data: result.goal })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در ثبت هدف پس‌انداز' })
  }
})

/**
 * PATCH /api/v1/savings/:id
 */
apiRouter.patch('/savings/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {}
    const data = await loadUserData(req.user!)
    const result = updateSavingsGoal(data, String(req.params.id), {
      name: body.name ? String(body.name) : undefined,
      target: body.target != null ? Number(body.target) : undefined,
      saved: body.saved != null ? Number(body.saved) : undefined,
      currency: (body.currency as CurrencyUnit) || 'IRT',
    })
    await saveUserData(req.user!, result.nextData)
    res.json({ success: true, data: result.goal })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در ویرایش هدف پس‌انداز' })
  }
})

/**
 * DELETE /api/v1/savings/:id
 */
apiRouter.delete('/savings/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const result = deleteSavingsGoal(data, String(req.params.id))
    await saveUserData(req.user!, result.nextData)
    res.json({ success: true, message: 'هدف پس‌انداز حذف شد' })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در حذف هدف پس‌انداز' })
  }
})

// ============================================================================
// INVESTMENTS ENDPOINTS (دارایی‌ها و سرمایه‌گذاری)
// ============================================================================

/**
 * GET /api/v1/investments
 */
apiRouter.get('/investments', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const assets = getInvestments(data)
    res.json({ success: true, count: assets.length, data: assets })
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'خطای سرور' })
  }
})

/**
 * GET /api/v1/investments/:id
 */
apiRouter.get('/investments/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const asset = getInvestment(data, String(req.params.id))
    res.json({ success: true, data: asset })
  } catch (err) {
    res.status(404).json({ success: false, error: err instanceof Error ? err.message : 'دارایی پیدا نشد' })
  }
})

/**
 * POST /api/v1/investments
 */
apiRouter.post('/investments', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {}
    if (!body.name || !body.market || body.purchaseAmount == null || body.currentValue == null) {
      res.status(400).json({ success: false, error: 'فیلدهای الزامی: name, market, purchaseAmount, currentValue' })
      return
    }
    const data = await loadUserData(req.user!)
    const result = createInvestment(data, {
      name: String(body.name),
      market: body.market,
      purchaseAmount: Number(body.purchaseAmount),
      currentValue: Number(body.currentValue),
      quantity: body.quantity != null ? Number(body.quantity) : undefined,
      unitPrice: body.unitPrice != null ? Number(body.unitPrice) : undefined,
      currentUnitPrice: body.currentUnitPrice != null ? Number(body.currentUnitPrice) : undefined,
      purchaseDate: body.purchaseDate ? String(body.purchaseDate) : undefined,
      note: body.note ? String(body.note) : undefined,
      currency: (body.currency as CurrencyUnit) || 'IRT',
    })
    await saveUserData(req.user!, result.nextData)
    res.status(201).json({ success: true, data: result.asset })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در ثبت دارایی' })
  }
})

/**
 * PATCH /api/v1/investments/:id
 */
apiRouter.patch('/investments/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {}
    const data = await loadUserData(req.user!)
    const result = updateInvestment(data, String(req.params.id), {
      currentValue: body.currentValue != null ? Number(body.currentValue) : undefined,
      currentUnitPrice: body.currentUnitPrice != null ? Number(body.currentUnitPrice) : undefined,
      note: body.note ? String(body.note) : undefined,
      currency: (body.currency as CurrencyUnit) || 'IRT',
    })
    await saveUserData(req.user!, result.nextData)
    res.json({ success: true, data: result.asset })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در به‌روزرسانی دارایی' })
  }
})

/**
 * DELETE /api/v1/investments/:id
 */
apiRouter.delete('/investments/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const result = deleteInvestment(data, String(req.params.id))
    await saveUserData(req.user!, result.nextData)
    res.json({ success: true, message: 'دارایی حذف شد' })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در حذف دارایی' })
  }
})

// ============================================================================
// REMINDERS & DUE DATES ENDPOINTS (یادآورها)
// ============================================================================

/**
 * GET /api/v1/reminders
 */
apiRouter.get('/reminders', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const settings = getRemindersSettings(data)
    res.json({ success: true, data: settings })
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'خطای سرور' })
  }
})

/**
 * PUT /api/v1/reminders
 */
apiRouter.put('/reminders', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {}
    const data = await loadUserData(req.user!)
    const result = updateRemindersSettings(data, {
      enabled: Boolean(body.enabled),
      leadDays: Number(body.leadDays) || 2,
    })
    await saveUserData(req.user!, result.nextData)
    res.json({ success: true, data: result.settings })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در تنظیم یادآور' })
  }
})

/**
 * GET /api/v1/reminders/upcoming
 */
apiRouter.get('/reminders/upcoming', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await loadUserData(req.user!)
    const leadDays = req.query.leadDays ? Number(req.query.leadDays) : 7
    const list = getUpcomingReminders(data, leadDays)
    res.json({ success: true, count: list.length, data: list })
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'خطای سرور' })
  }
})

// ============================================================================
// SHARED LEDGERS ENDPOINTS (دفاتر حساب اشتراکی)
// ============================================================================

/**
 * GET /api/v1/sharing
 */
apiRouter.get('/sharing', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://yiluruldxtgfuxqwosri.supabase.co'
    const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tHV7NoCAC-3czs4yMG1Z7Q_bg05S1MI'

    const response = await fetch(`${SUPABASE_URL}/rest/v1/shared_ledgers?select=id,code,title,account_id,updated_at`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${req.user!.token}`,
      },
    })
    const list = (await response.json().catch(() => [])) as unknown[]
    res.json({ success: true, count: Array.isArray(list) ? list.length : 0, data: list })
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'خطای سرور' })
  }
})

/**
 * POST /api/v1/sharing
 */
apiRouter.post('/sharing', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {}
    if (!body.accountId || !body.title) {
      res.status(400).json({ success: false, error: 'فیلدهای الزامی: accountId, title' })
      return
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://yiluruldxtgfuxqwosri.supabase.co'
    const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tHV7NoCAC-3czs4yMG1Z7Q_bg05S1MI'

    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_shared_ledger`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${req.user!.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_account_id: String(body.accountId),
        p_title: String(body.title),
        p_payload: body.payload || {},
      }),
    })

    if (!rpcRes.ok) {
      const errText = await rpcRes.text()
      res.status(400).json({ success: false, error: errText })
      return
    }

    const created = (await rpcRes.json()) as unknown
    res.status(201).json({ success: true, data: created })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در ایجاد دفتر مشترک' })
  }
})

/**
 * POST /api/v1/sharing/join
 */
apiRouter.post('/sharing/join', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {}
    if (!body.code) {
      res.status(400).json({ success: false, error: 'کد اشتراک الزامی است (code)' })
      return
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://yiluruldxtgfuxqwosri.supabase.co'
    const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tHV7NoCAC-3czs4yMG1Z7Q_bg05S1MI'

    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/join_shared_code`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${req.user!.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_code: String(body.code),
      }),
    })

    if (!rpcRes.ok) {
      const errText = await rpcRes.text()
      res.status(400).json({ success: false, error: errText })
      return
    }

    const ledgerId = (await rpcRes.json()) as unknown
    res.json({ success: true, message: 'با موفقیت به دفتر مشترک پیوستید', ledgerId })
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'خطا در پیوستن به دفتر مشترک' })
  }
})
