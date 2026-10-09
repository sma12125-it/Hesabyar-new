import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { hesabyarApi } from '../client/hesabyarApi'
import { currencySchema, dateSchema, dryRunSchema, formatErrorResponse, formatSuccessResponse } from '../schemas/common'

export function registerTransactionTools(server: McpServer) {
  // 1. get_transactions
  server.registerTool(
    'get_transactions',
    {
      title: 'فهرست و فیلتر تراکنش‌ها',
      description:
        'دریافت فهرست تراکنش‌های مالی کاربر با امکان فیلتر بر اساس حساب، دسته، نوع (expense/income)، بازه تاریخ، مبلغ و تعداد. برای پاسخ به سوالاتی مانند "تراکنش‌های این هفته من را نشان بده" استفاده می‌شود.',
      inputSchema: {
        accountId: z.string().optional().describe('شناسه حساب جهت فیلتر'),
        categoryId: z.string().optional().describe('شناسه دسته جهت فیلتر (مثلاً food, shopping)'),
        kind: z
          .enum(['expense', 'income', 'transferOut', 'transferIn'])
          .optional()
          .describe('نوع تراکنش: expense (هزینه)، income (درآمد)، transferOut (خروجی انتقال)، transferIn (ورودی انتقال)'),
        startDate: dateSchema.describe('تاریخ شروع بازه (YYYY-MM-DD)'),
        endDate: dateSchema.describe('تاریخ پایان بازه (YYYY-MM-DD)'),
        minAmount: z.number().optional().describe('حداقل مبلغ تراکنش'),
        maxAmount: z.number().optional().describe('حداکثر مبلغ تراکنش'),
        limit: z.number().int().optional().default(30).describe('حداکثر تعداد رکوردهای خروجی (پیش‌فرض ۳۰)'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const result = await hesabyarApi.get('/transactions', params)
        return formatSuccessResponse(result)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 2. get_transaction
  server.registerTool(
    'get_transaction',
    {
      title: 'مشاهده جزئیات یک تراکنش',
      description: 'مشاهده مشخصات و جزئیات دقیق یک تراکنش مشخص با استفاده از شناسه تراکنش.',
      inputSchema: {
        id: z.string().describe('شناسه تراکنش'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const tx = await hesabyarApi.get(`/transactions/${encodeURIComponent(id)}`)
        return formatSuccessResponse(tx)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 3. search_transactions
  server.registerTool(
    'search_transactions',
    {
      title: 'جستجوی هوشمند در تراکنش‌ها',
      description:
        'جستجوی متنی در تراکنش‌ها بر اساس عنوان، متن یادداشت، نام دسته‌بندی، برچسب‌ها یا نام حساب. برای مواردی مانند "جستجوی خرید سوپرمارکت" یا "هزینه‌های مربوط به سفر" کاربرد دارد.',
      inputSchema: {
        query: z.string().describe('عبارت مورد جستجو (مثلاً "سوپرمارکت"، "بنزین"، "پوشاک")'),
        limit: z.number().int().optional().default(20).describe('حداکثر نتایج جستجو'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ query, limit }) => {
      try {
        const results = await hesabyarApi.get('/transactions/search', { q: query, limit })
        return formatSuccessResponse(results)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 4. create_transaction
  server.registerTool(
    'create_transaction',
    {
      title: 'ثبت هزینه یا درآمد جدید',
      description:
        'ثبت یک تراکنش هزینه یا درآمد در حساب مالی مشخص. برای عملیات حساس یا مبالغ بزرگ، توصیه می‌شود ابتدا با dryRun: true اجرا شود تا تراز قبل و بعد به کاربر نمایش داده شده و تأییدیه گرفته شود.',
      inputSchema: {
        account: z.string().describe('نام یا شناسه حساب بانکی (مثلاً "بانک ملت" یا "کیف پول")'),
        amount: z.number().positive().describe('مبلغ تراکنش (عدد مثبت)'),
        currency: currencySchema,
        type: z.enum(['expense', 'income']).describe('نوع تراکنش: expense (هزینه) یا income (درآمد)'),
        category: z.string().optional().describe('دسته‌بندی (مثلاً "خرید"، "خوراک"، "حقوق"، "پوشاک")'),
        description: z.string().optional().describe('توضیحات و بابت چه چیزی'),
        date: dateSchema,
        dryRun: dryRunSchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const result = await hesabyarApi.post('/transactions', params)
        const isDry = Boolean(params.dryRun)
        const message = isDry
          ? 'پیش‌نمایش تراکنش با موفقیت ایجاد شد (تأیید کاربر لازم است)'
          : 'تراکنش با موفقیت ثبت شد'
        return formatSuccessResponse(result, message)
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 5. update_transaction
  server.registerTool(
    'update_transaction',
    {
      title: 'ویرایش تراکنش موجود',
      description: 'ویرایش اطلاعات، مبلغ، دسته‌بندی، یادداشت، حساب یا تاریخ یک تراکنش از پیش ثبت‌شده.',
      inputSchema: {
        id: z.string().describe('شناسه تراکنش مورد نظر برای ویرایش'),
        amount: z.number().positive().optional().describe('مبلغ جدید'),
        currency: currencySchema.optional(),
        account: z.string().optional().describe('حساب جدید'),
        category: z.string().optional().describe('دسته جدید'),
        description: z.string().optional().describe('یادداشت یا توضیحات جدید'),
        date: dateSchema,
        type: z.enum(['expense', 'income']).optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ id, ...patch }) => {
      try {
        const result = await hesabyarApi.patch(`/transactions/${encodeURIComponent(id)}`, patch)
        return formatSuccessResponse(result, 'تراکنش با موفقیت ویرایش شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )

  // 6. delete_transaction
  server.registerTool(
    'delete_transaction',
    {
      title: 'حذف تراکنش',
      description:
        'حذف قطعی یک تراکنش مالی. توجه: این یک عملیات مخرب (Destructive) است که تراز حساب مربوطه را تغییر می‌دهد.',
      inputSchema: {
        id: z.string().describe('شناسه تراکنش جهت حذف'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const result = await hesabyarApi.delete(`/transactions/${encodeURIComponent(id)}`)
        return formatSuccessResponse(result, 'تراکنش با موفقیت حذف شد')
      } catch (err) {
        return formatErrorResponse(err)
      }
    },
  )
}
