import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { hesabyarApi } from '../client/hesabyarApi'
import { currencySchema, dateSchema, formatErrorResponse, formatSuccessResponse } from '../schemas/common'

export function registerInvestmentTools(server: McpServer) {
  // 1. get_investments
  server.registerTool(
    'get_investments',
    {
      title: 'فهرست دارایی‌ها و سبد سرمایه‌گذاری',
      description: 'مشاهده لیست دارایی‌های سرمایه‌گذاری کاربر شامل طلا، سکه، ارز، بورس، صندوق، مسکن و سود/زیان هر کدام.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const investments = await hesabyarApi.get('/investments')
        return formatSuccessResponse(investments)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 2. get_investment
  server.registerTool(
    'get_investment',
    {
      title: 'مشاهده جزئیات یک دارایی سرمایه‌گذاری',
      description: 'دریافت مشخصات کامل یک دارایی سرمایه‌گذاری بر اساس شناسه آن.',
      inputSchema: {
        id: z.string().describe('شناسه دارایی'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const asset = await hesabyarApi.get(`/investments/${encodeURIComponent(id)}`)
        return formatSuccessResponse(asset)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 3. create_investment
  server.registerTool(
    'create_investment',
    {
      title: 'ثبت دارایی سرمایه‌گذاری جدید',
      description: 'ثبت یک دارایی جدید مانند سکه طلا، دلار، سهام یا صندوق به همراه مبلغ خرید و ارزش روز.',
      inputSchema: {
        name: z.string().describe('نام دارایی (مثلاً "سکه تمام بهار"، "دلار آمریکا"، "صندوق درآمد ثابت")'),
        market: z.enum(['gold', 'stock', 'fund', 'crypto', 'bank', 'property', 'other']).describe('دسته‌بندی بازار سرمایه'),
        purchaseAmount: z.number().positive().describe('مبلغ کل خریداری‌شده (بهای تمام‌شده)'),
        currentValue: z.number().positive().describe('ارزش فعلی کل دارایی به قیمت روز'),
        currency: currencySchema,
        quantity: z.number().optional().describe('تعداد یا مقدار دارایی (مثلاً ۵ عدد یا ۲۰ گرم)'),
        unitPrice: z.number().optional().describe('قیمت واحد هنگام خرید'),
        currentUnitPrice: z.number().optional().describe('قیمت واحد روز'),
        purchaseDate: dateSchema.describe('تاریخ خرید (اختیاری YYYY-MM-DD)'),
        note: z.string().optional().describe('یادداشت'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const result = await hesabyarApi.post('/investments', params)
        return formatSuccessResponse(result, 'دارایی با موفقیت در سبد سرمایه‌گذاری ثبت شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 4. update_investment
  server.registerTool(
    'update_investment',
    {
      title: 'به‌روزرسانی ارزش روز دارایی',
      description: 'به‌روزرسانی ارزش روز یک دارایی سرمایه‌گذاری بر اساس آخرین قیمت‌های بازار.',
      inputSchema: {
        id: z.string().describe('شناسه دارایی'),
        currentValue: z.number().positive().describe('ارزش روز جدید دارایی'),
        currentUnitPrice: z.number().optional().describe('قیمت واحد روز جدید (اختیاری)'),
        currency: currencySchema,
        note: z.string().optional().describe('یادداشت'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ id, ...patch }) => {
      try {
        const result = await hesabyarApi.patch(`/investments/${encodeURIComponent(id)}`, patch)
        return formatSuccessResponse(result, 'ارزش دارایی با موفقیت به‌روزرسانی شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 5. delete_investment
  server.registerTool(
    'delete_investment',
    {
      title: 'حذف دارایی از سبد سرمایه‌گذاری',
      description: 'حذف یک دارایی سرمایه‌گذاری از سامانه.',
      inputSchema: {
        id: z.string().describe('شناسه دارایی'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const result = await hesabyarApi.delete(`/investments/${encodeURIComponent(id)}`)
        return formatSuccessResponse(result, 'دارایی با موفقیت حذف شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  const txKind = z.enum(['buy', 'sell', 'issue', 'redeem']).describe('خرید، فروش، صدور یا ابطال')

  server.registerTool(
    'add_investment_transaction',
    {
      title: 'ثبت خرید، فروش، صدور یا ابطال',
      description:
        'ثبت یک معامله روی دارایی. بهای تمام‌شده با میانگین موزون محاسبه می‌شود و فروش یا ابطال بیش از موجودی رد می‌شود. برای صندوق از صدور و ابطال استفاده کنید.',
      inputSchema: {
        id: z.string().describe('شناسه دارایی'),
        kind: txKind,
        quantity: z.number().positive().describe('تعداد واحد'),
        unitPrice: z.number().positive().describe('قیمت هر واحد'),
        currency: currencySchema,
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'فرمت تاریخ باید YYYY-MM-DD باشد').describe('تاریخ معامله'),
        note: z.string().optional().describe('یادداشت'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ id, ...body }) => {
      try {
        const result = await hesabyarApi.post(`/investments/${encodeURIComponent(id)}/transactions`, body)
        return formatSuccessResponse(result, 'معامله ثبت شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  server.registerTool(
    'update_investment_transaction',
    {
      title: 'ویرایش معامله دارایی',
      description: 'ویرایش تعداد، قیمت، تاریخ یا نوع یک معامله. اگر بعد از ویرایش موجودی منفی شود، درخواست رد می‌شود.',
      inputSchema: {
        id: z.string().describe('شناسه دارایی'),
        transactionId: z.string().describe('شناسه معامله'),
        kind: txKind.optional(),
        quantity: z.number().positive().optional(),
        unitPrice: z.number().positive().optional(),
        currency: currencySchema,
        date: dateSchema,
        note: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ id, transactionId, ...body }) => {
      try {
        const result = await hesabyarApi.patch(
          `/investments/${encodeURIComponent(id)}/transactions/${encodeURIComponent(transactionId)}`,
          body,
        )
        return formatSuccessResponse(result, 'معامله ویرایش شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  server.registerTool(
    'delete_investment_transaction',
    {
      title: 'حذف معامله دارایی',
      description: 'حذف یک خرید، فروش، صدور یا ابطال. اگر حذف باعث شود فروش بعدی بیش از موجودی شود، درخواست رد می‌شود.',
      inputSchema: {
        id: z.string().describe('شناسه دارایی'),
        transactionId: z.string().describe('شناسه معامله'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ id, transactionId }) => {
      try {
        const result = await hesabyarApi.delete(
          `/investments/${encodeURIComponent(id)}/transactions/${encodeURIComponent(transactionId)}`,
        )
        return formatSuccessResponse(result, 'معامله حذف شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )
}
